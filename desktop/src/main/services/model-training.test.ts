/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IpcMain } from 'electron';
import registerModelTraining, { type ModelQuestRun } from './model-training';
import { TokenStore } from './token-training';
import { TUTOR_MODEL_PRESETS } from '../../shared/model-catalog';

jest.mock('electron-log', () => ({ warn: jest.fn() }));
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'model-quest-'));
  let user = 'alice';
  const handlers: Record<string, (...args: any[]) => any> = {};
  const run = jest.fn(async (request: ModelQuestRun) => {
    request.emit({ type: 'text_delta', text: 'An idea.' });
    request.emit({
      type: 'done',
      guidance: 'An idea.',
      llm_metrics: { model: request.model, input_tokens: 10, output_tokens: 3 },
    });
  });
  const options = {
    canSkipPrerequisites: jest.fn(() => false),
    ipc: {
      handle: (name: string, handler: any) => {
        handlers[name] = handler;
      },
    } as unknown as IpcMain,
    root: () => root,
    user: () => user,
    currentUser: () => user,
    models: () => TUTOR_MODEL_PRESETS,
    changed: jest.fn(),
    open: jest.fn(),
    run,
    stop: jest.fn(async () => {}),
  };
  const service = registerModelTraining(options);
  const call = (name: string, ...args: unknown[]) =>
    handlers[name]({}, ...args);
  const unlockToken = () => {
    const store = new TokenStore(path.join(root, 'token-chapter'));
    store.save(user, {
      ...store.read(user),
      completedAt: new Date().toISOString(),
    });
  };
  return {
    root,
    options,
    service,
    call,
    unlockToken,
    setUser: (value: string) => {
      user = value;
    },
  };
}

test('requires Token, compares the fixed models, records timing, and persists the unlock without requiring a reflection', async () => {
  const t = setup();
  try {
    expect(() => t.call('model-chapter-start')).toThrow('Chapter 3');
    expect(t.service.canPick('alice')).toBe(false);
    t.unlockToken();
    const session = t.call('model-chapter-start');
    expect(t.call('model-chapter-start').sessionId).toBe(session.sessionId);
    await t.call(
      'model-chapter-run',
      session.sessionId,
      'Rewrite this sentence.',
    );
    expect(t.options.run.mock.calls.map(([request]) => request.model)).toEqual([
      'openai/gpt-5.6-luna',
      'openai/gpt-5.6-sol',
    ]);
    expect(t.options.run.mock.calls.map(([request]) => request.prompt)).toEqual(
      ['Rewrite this sentence.', 'Rewrite this sentence.'],
    );
    expect(() =>
      t.call('model-chapter-complete', session.sessionId, 'both', 'Useful'),
    ).toThrow('both comparisons');
    await t.call(
      'model-chapter-run',
      session.sessionId,
      'Suggest three ideas.',
    );
    const saved = t.call('model-chapter-session', session.sessionId);
    expect(saved.rounds.map((round: any) => round.kind)).toEqual([
      'rewrite',
      'ideas',
    ]);
    expect(saved.rounds[0].responses[0]).toMatchObject({
      status: 'done',
      firstResponseMs: expect.any(Number),
      finishedMs: expect.any(Number),
    });
    expect(
      new Set(t.options.run.mock.calls.map(([request]) => request.sessionId))
        .size,
    ).toBe(4);
    expect(() => t.call('model-chapter-complete', session.sessionId)).toThrow(
      'Choose one',
    );
    t.call('model-chapter-complete', session.sessionId, session.models[0].id);
    expect(
      t.call('model-chapter-session', session.sessionId).selectedModelId,
    ).toBe(session.models[0].id);
    expect(t.service.canPick('alice')).toBe(true);
    const restarted = registerModelTraining(t.options);
    expect(restarted.canPick('alice')).toBe(true);
    t.setUser('bob');
    expect(t.call('model-chapter-session', session.sessionId)).toBeNull();
    expect(restarted.canPick('bob')).toBe(false);
    await expect(
      t.call('model-chapter-run', session.sessionId, 'hello'),
    ).rejects.toThrow('this account');
  } finally {
    fs.rmSync(t.root, { recursive: true, force: true });
  }
});

test('starts both requests concurrently, blocks duplicate sends, and excludes a stopped comparison', async () => {
  const t = setup();
  try {
    t.unlockToken();
    const session = t.call('model-chapter-start');
    const pending: { request: ModelQuestRun; resolve: () => void }[] = [];
    t.options.run.mockImplementation(
      (request) =>
        new Promise<void>((resolve) => {
          pending.push({ request, resolve });
        }),
    );
    const sent = t.call('model-chapter-run', session.sessionId, 'Question');
    expect(pending).toHaveLength(2);
    await expect(
      t.call('model-chapter-run', session.sessionId, 'Again'),
    ).rejects.toThrow('Wait for both');
    await t.call('model-chapter-stop', session.sessionId);
    expect(t.options.stop).toHaveBeenCalledTimes(2);
    pending[0].request.emit({
      type: 'done',
      guidance: 'Stopped',
      stopped: true,
    });
    pending[1].request.emit({ type: 'done', guidance: 'Finished' });
    pending.forEach((item) => item.resolve());
    await sent;
    expect(() =>
      t.call(
        'model-chapter-complete',
        session.sessionId,
        'both',
        'Both useful',
      ),
    ).toThrow('both comparisons');
    const next = t.call('model-chapter-run', session.sessionId, 'Retry');
    pending.slice(2).forEach((item) => {
      item.request.emit({ type: 'done', guidance: 'Okay' });
      item.resolve();
    });
    await next;
    expect(
      t.call('model-chapter-session', session.sessionId).rounds[1].kind,
    ).toBe('rewrite');
  } finally {
    fs.rmSync(t.root, { recursive: true, force: true });
  }
});

test('surfaces missing model configuration and request errors without granting completion', async () => {
  const t = setup();
  try {
    t.unlockToken();
    registerModelTraining({ ...t.options, models: () => [] });
    expect(() => t.call('model-chapter-start')).toThrow('Configure GPT');
    registerModelTraining(t.options);
    const session = t.call('model-chapter-start');
    t.options.run.mockRejectedValue(new Error('Provider unavailable'));
    await t.call('model-chapter-run', session.sessionId, 'Question');
    expect(
      t
        .call('model-chapter-session', session.sessionId)
        .rounds[0].responses.every(
          (response: any) => response.status === 'error',
        ),
    ).toBe(true);
    expect(t.service.canPick('alice')).toBe(false);
  } finally {
    fs.rmSync(t.root, { recursive: true, force: true });
  }
});

test('gives both models identical shared context on a follow-up', async () => {
  const t = setup();
  try {
    t.unlockToken();
    const session = t.call('model-chapter-start');
    await t.call('model-chapter-run', session.sessionId, 'Rewrite');
    await t.call('model-chapter-run', session.sessionId, 'Ideas');
    await t.call(
      'model-chapter-run',
      session.sessionId,
      'What assumptions could change these?',
    );
    const left = t.options.run.mock.calls[4][0];
    const right = t.options.run.mock.calls[5][0];
    expect(left.prompt).toBe(right.prompt);
    expect(left.prompt).toContain('Ideas');
    expect(left.prompt).toContain('An idea.');
    expect(left.prompt).toContain('What assumptions could change these?');
  } finally {
    fs.rmSync(t.root, { recursive: true, force: true });
  }
});

test('admin mode can start without prerequisites, while student mode still requires them', () => {
  const t = setup();
  try {
    expect(() => t.call('model-chapter-start')).toThrow('first');
    t.options.canSkipPrerequisites.mockReturnValue(true);
    expect(t.call('model-chapter-start').sessionId).toBeTruthy();
    t.options.canSkipPrerequisites.mockReturnValue(false);
    expect(() => t.call('model-chapter-start')).toThrow('first');
  } finally {
    fs.rmSync(t.root, { recursive: true, force: true });
  }
});
