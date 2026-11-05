import { createTutoringAccessRefresher } from './tutoring-access';

function setup(initiallyAllowed = false) {
  let allowed = initiallyAllowed;
  const deps = {
    canRefresh: () => true,
    isAllowed: () => allowed,
    fetchPolicy: jest.fn(async () => true),
    applyPolicy: (policy: boolean) => {
      allowed = policy;
    },
    activate: jest.fn(async (_policy: boolean) => {}),
    deactivate: jest.fn(async () => {}),
    setAllowed: (value: boolean) => {
      allowed = value;
    },
    isAuthorizationError: (error: unknown) => error === 'unauthorized',
    unavailable: jest.fn(),
    settled: jest.fn(),
  };
  return { deps, refresh: createTutoringAccessRefresher(deps) };
}

it.each([false, true])(
  'preserves access=%s on a network failure and retries',
  async (allowed) => {
    const { deps, refresh } = setup(allowed);
    deps.fetchPolicy.mockRejectedValueOnce(new Error('network timeout'));
    await refresh();
    expect(deps.isAllowed()).toBe(allowed);
    expect(deps.deactivate).not.toHaveBeenCalled();
    expect(deps.activate).not.toHaveBeenCalled();
    await refresh();
    expect(deps.isAllowed()).toBe(true);
    expect(deps.fetchPolicy).toHaveBeenCalledTimes(2);
    expect(deps.activate).toHaveBeenCalledTimes(allowed ? 0 : 1);
  },
);

it('stops tutoring for an explicit policy denial and resumes after approval', async () => {
  const { deps, refresh } = setup(true);
  deps.fetchPolicy.mockResolvedValueOnce(false);
  await refresh();
  expect(deps.isAllowed()).toBe(false);
  expect(deps.deactivate).toHaveBeenCalledTimes(1);
  await refresh();
  expect(deps.activate).toHaveBeenCalledTimes(1);
});

it('revokes access when the server rejects authentication', async () => {
  const { deps, refresh } = setup(true);
  deps.fetchPolicy.mockRejectedValueOnce('unauthorized');
  await refresh();
  expect(deps.isAllowed()).toBe(false);
  expect(deps.deactivate).toHaveBeenCalledTimes(1);
});

it('continues polling after cleanup fails', async () => {
  const { deps, refresh } = setup(true);
  deps.fetchPolicy.mockResolvedValueOnce(false);
  deps.deactivate.mockRejectedValueOnce(new Error('cleanup failed'));
  await refresh();
  await refresh();
  expect(deps.fetchPolicy).toHaveBeenCalledTimes(2);
  expect(deps.isAllowed()).toBe(true);
  expect(deps.activate).toHaveBeenCalledTimes(1);
});

it('retries credential activation instead of enabling incomplete services', async () => {
  const { deps, refresh } = setup();
  deps.activate.mockRejectedValueOnce(new Error('credential request failed'));
  await refresh();
  expect(deps.isAllowed()).toBe(false);
  await refresh();
  expect(deps.activate).toHaveBeenCalledTimes(2);
  expect(deps.isAllowed()).toBe(true);
});

it('does not overlap access checks', async () => {
  const { deps, refresh } = setup(true);
  let resolve!: (policy: boolean) => void;
  deps.fetchPolicy.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const pending = refresh();
  await refresh();
  expect(deps.fetchPolicy).toHaveBeenCalledTimes(1);
  resolve(true);
  await pending;
  await refresh();
  expect(deps.fetchPolicy).toHaveBeenCalledTimes(2);
});
