interface AccessDependencies<Policy> {
  canRefresh: () => boolean;
  isAllowed: () => boolean;
  fetchPolicy: () => Promise<Policy>;
  applyPolicy: (policy: Policy) => void;
  activate: (policy: Policy) => Promise<void>;
  deactivate: () => Promise<void>;
  setAllowed: (allowed: boolean) => void;
  isAuthorizationError: (error: unknown) => boolean;
  unavailable: (error: unknown) => void;
  settled: () => void;
}

/** Network failures preserve the last decision; explicit denials still stop AI. */
export function createTutoringAccessRefresher<Policy>(
  deps: AccessDependencies<Policy>,
) {
  let running = false;
  return async () => {
    if (running || !deps.canRefresh()) return;
    running = true;
    try {
      let policy: Policy;
      try {
        policy = await deps.fetchPolicy();
      } catch (error) {
        if (deps.isAuthorizationError(error)) {
          deps.setAllowed(false);
          await deps.deactivate();
        }
        deps.unavailable(error);
        return;
      }
      const wasAllowed = deps.isAllowed();
      deps.applyPolicy(policy);
      if (!deps.isAllowed()) {
        await deps.deactivate();
      } else if (!wasAllowed) {
        try {
          await deps.activate(policy);
        } catch (error) {
          // Retry activation on the next poll; never start with missing credentials.
          deps.setAllowed(false);
          await deps.deactivate();
          throw error;
        }
      }
    } catch (error) {
      deps.unavailable(error);
    } finally {
      running = false;
      deps.settled();
    }
  };
}
