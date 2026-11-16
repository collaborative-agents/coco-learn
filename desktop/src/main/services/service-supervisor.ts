export interface SupervisedService { id: string; enabled: () => boolean; }
interface Attempt { startedAt: number; retryAt: number; failures: number; attempts: number; wasHealthy: boolean; }
/** A process existing is not readiness: probe the actual HTTP service and recover hangs. */
export default class ServiceSupervisor {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private attempts = new Map<string, Attempt>();
  constructor(private deps: {
    services: SupervisedService[];
    probe: (id: string) => Promise<boolean>;
    start: (id: string) => void;
    stop: (id: string) => Promise<unknown>;
    report: (id: string, detail: string) => void;
    now?: () => number;
  }) {}
  start() {
    if (this.timer) return;
    void this.tick();
    this.timer = setInterval(() => { void this.tick(); }, 3000);
    this.timer.unref?.();
  }
  dispose() { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
  async retry() {
    this.attempts.clear();
    await this.tick(true);
  }
  async tick(force = false) {
    if (this.busy) return;
    this.busy = true;
    try {
      await Promise.all(this.deps.services.map(async service => {
        if (!service.enabled()) { this.attempts.delete(service.id); return; }
        const state = this.attempts.get(service.id) ?? { startedAt: 0, retryAt: 0, failures: 0, attempts: 0, wasHealthy: false };
        this.attempts.set(service.id, state);
        try {
          if (await this.deps.probe(service.id)) { state.wasHealthy = true; state.failures = 0; state.attempts = 0; state.startedAt = 0; state.retryAt = 0; return; }
        } catch { /* A failed probe must lead to recovery, not a healthy state. */ }
        state.failures += 1;
        // One slow health request must not interrupt a working model turn.
        // First launch and explicit Retry remain immediate; established services
        // recover only after three consecutive failed probes.
        if (!force && state.wasHealthy && state.failures < 3) {
          this.deps.report(service.id, 'The local service did not respond. Checking again.');
          return;
        }
        const now = this.deps.now?.() ?? Date.now();
        // Cold Python imports can exceed 20 seconds. Keep probing, but do not
        // repeatedly kill a service before it has had a chance to finish loading.
        if (!force && (now < state.retryAt || (state.startedAt && now - state.startedAt < 60000))) return;
        try {
          await this.deps.stop(service.id);
          if (!service.enabled()) return;
          this.deps.start(service.id);
          state.wasHealthy = false;
          state.startedAt = now; state.attempts += 1;
          state.retryAt = now + Math.min(3000 * 2 ** (state.attempts - 1), 30000);
          this.deps.report(service.id, 'Starting Coco’s local service.');
        } catch (error) {
          state.retryAt = now + 10000;
          this.deps.report(service.id, error instanceof Error ? error.message : 'Coco could not start this service. Retry to try again.');
        }
      }));
    } finally { this.busy = false; }
  }
}
