/** Counts work time, excluding any interval spent waiting for user approval. */
export default class ActiveRunClock {
  private pending = new Set<string>();
  private alarms: {
    remaining: number;
    action: () => void;
    timer?: ReturnType<typeof setTimeout>;
    started: number;
  }[];
  constructor(alarms: { after: number; action: () => void }[]) {
    this.alarms = alarms.map(({ after, action }) => ({
      remaining: after,
      action,
      started: Date.now(),
    }));
    this.resume();
  }
  permission(id: string, pending: boolean) {
    if (pending) {
      if (!this.pending.size) this.pause();
      this.pending.add(id);
    } else {
      const removed = this.pending.delete(id);
      if (removed && !this.pending.size) this.resume();
    }
  }
  private pause() {
    for (const alarm of this.alarms) {
      if (!alarm.timer) continue;
      clearTimeout(alarm.timer);
      alarm.timer = undefined;
      alarm.remaining = Math.max(
        0,
        alarm.remaining - (Date.now() - alarm.started),
      );
    }
  }
  private resume() {
    for (const alarm of this.alarms) {
      if (alarm.remaining < 0) continue;
      alarm.started = Date.now();
      alarm.timer = setTimeout(() => {
        alarm.timer = undefined;
        alarm.remaining = -1;
        alarm.action();
      }, alarm.remaining);
    }
  }
  extendDeadline(milliseconds: number) {
    this.pause();
    const last = this.alarms[this.alarms.length - 1];
    if (last && last.remaining >= 0) last.remaining += milliseconds;
    if (!this.pending.size) this.resume();
  }
  stop() {
    this.pause();
    this.alarms = [];
  }
}
