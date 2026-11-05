import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import type { IpcMain } from 'electron';
import type { CocoGatewayClient } from './gateway-client';

type ProgressEvent = {
  chapter: string;
  phase: 'started' | 'completed';
  occurred_at: string;
  sent?: boolean;
};
type Ledger = Record<string, ProgressEvent>;

/** Small durable per-account outbox; never upload quest content. */
export default function trackAgent101(options: {
  ipc: IpcMain;
  root: () => string;
  user: () => string | null;
  gateway: () => CocoGatewayClient | null;
  warn: (error: unknown) => void;
}) {
  const file = (user: string) =>
    path.join(
      options.root(),
      'agent101-tracking',
      `${createHash('sha256').update(user).digest('hex')}.json`,
    );
  const read = (user: string): Ledger => {
    try {
      return JSON.parse(fs.readFileSync(file(user), 'utf8'));
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return {};
      throw error;
    }
  };
  const write = (user: string, ledger: Ledger) => {
    const target = file(user);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(`${target}.tmp`, JSON.stringify(ledger));
    fs.renameSync(`${target}.tmp`, target);
  };
  let flushing = false;
  const flush = async () => {
    if (flushing) return;
    const user = options.user();
    const client = options.gateway();
    if (!user || !client) return;
    flushing = true;
    try {
      // Upload sequentially so account identity is checked before each request.
      // eslint-disable-next-line no-restricted-syntax
      for (const [key, event] of Object.entries(read(user))) {
        if (options.user() !== user || options.gateway() !== client) break;
        if (!event.sent) {
          const { chapter, phase, occurred_at: occurredAt } = event;
          // eslint-disable-next-line no-await-in-loop
          await client.requestJson('/api/study/agent101/events', 'POST', {
            chapter,
            phase,
            occurred_at: occurredAt,
          });
          // Read again: another chapter may have progressed during the upload.
          const ledger = read(user);
          ledger[key] = { ...event, sent: true };
          write(user, ledger);
        }
      }
    } catch (error) {
      options.warn(error);
    } finally {
      flushing = false;
    }
  };
  const record = (user: string, event: ProgressEvent) => {
    try {
      const ledger = read(user);
      const key = `${event.chapter}.${event.phase}`;
      if (!ledger[key]) {
        ledger[key] = event;
        write(user, ledger);
      }
      flush().catch(options.warn);
    } catch (error) {
      options.warn(error);
    }
  };
  const handle: IpcMain['handle'] = (channel, listener) => {
    const match =
      /^(tool|context|token|model|workflow)-chapter-(start|progress)$/.exec(
        channel,
      );
    if (!match) {
      options.ipc.handle(channel, listener);
      return;
    }
    const [, chapter, action] = match;
    options.ipc.handle(channel, async (event, ...args) => {
      const user = options.user();
      const occurredAt = new Date().toISOString();
      const result = await listener(event, ...args);
      if (user && options.user() === user) {
        if (action === 'start')
          record(user, { chapter, phase: 'started', occurred_at: occurredAt });
        if (
          action === 'progress' &&
          typeof result?.completedAt === 'string' &&
          Number.isFinite(Date.parse(result.completedAt))
        ) {
          record(user, {
            chapter,
            phase: 'completed',
            occurred_at: result.completedAt,
          });
        }
      }
      return result;
    });
  };
  const timer = setInterval(() => {
    flush().catch(options.warn);
  }, 30000);
  timer.unref();
  return {
    ipc: new Proxy(options.ipc, {
      get: (target, property) =>
        property === 'handle' ? handle : Reflect.get(target, property),
    }),
    flush,
    dispose: () => clearInterval(timer),
  };
}
