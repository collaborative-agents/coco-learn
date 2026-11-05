/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IpcMain } from 'electron';
import type { CocoGatewayClient } from './gateway-client';
import trackAgent101 from './agent101-tracking';

it('persists offline milestones, retries, backfills completions and isolates accounts', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent101-'));
  const handlers: Record<string, (...args: any[]) => any> = {};
  const ipc = {
    handle: (name: string, fn: any) => {
      handlers[name] = fn;
    },
  } as IpcMain;
  let user = 'alice';
  const requestJson = jest.fn().mockRejectedValue(new Error('offline'));
  const gateway = { requestJson } as unknown as CocoGatewayClient;
  const options = {
    ipc,
    root: () => root,
    user: () => user,
    gateway: () => gateway,
    warn: jest.fn(),
  };
  let tracker = trackAgent101(options);
  try {
    tracker.ipc.handle('tool-chapter-start', () => ({ sessionId: 'one' }));
    tracker.ipc.handle('context-chapter-start', () => {
      throw new Error('locked');
    });
    tracker.ipc.handle('tool-chapter-progress', () => ({
      completedAt: '2026-10-01T12:00:00Z',
    }));
    await expect(handlers['context-chapter-start']({})).rejects.toThrow(
      'locked',
    );
    expect(requestJson).not.toHaveBeenCalled();
    expect(await handlers['tool-chapter-start']({})).toEqual({
      sessionId: 'one',
    });
    await handlers['tool-chapter-progress']({});
    await tracker.flush();
    tracker.dispose();
    tracker = trackAgent101(options);
    requestJson.mockResolvedValue({ ok: true });
    requestJson.mockClear();
    user = 'bob';
    await tracker.flush();
    expect(requestJson).not.toHaveBeenCalled();
    user = 'alice';
    await tracker.flush();
    expect(requestJson).toHaveBeenCalledTimes(2);
    expect(requestJson).toHaveBeenCalledWith(
      '/api/study/agent101/events',
      'POST',
      {
        chapter: 'tool',
        phase: 'completed',
        occurred_at: '2026-10-01T12:00:00Z',
      },
    );
    await tracker.flush();
    expect(requestJson).toHaveBeenCalledTimes(2);
  } finally {
    tracker.dispose();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it('does not attribute a completed request to an account switched mid-request', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent101-'));
  let listener: any;
  let user = 'alice';
  let finish: (value: unknown) => void = () => undefined;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const requestJson = jest.fn();
  const tracker = trackAgent101({
    ipc: {
      handle: (_name: string, fn: any) => {
        listener = fn;
      },
    } as IpcMain,
    root: () => root,
    user: () => user,
    gateway: () => ({ requestJson }) as unknown as CocoGatewayClient,
    warn: jest.fn(),
  });
  try {
    tracker.ipc.handle('tool-chapter-start', () => pending);
    const result = listener({});
    user = 'bob';
    finish({});
    await result;
    expect(requestJson).not.toHaveBeenCalled();
  } finally {
    tracker.dispose();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
