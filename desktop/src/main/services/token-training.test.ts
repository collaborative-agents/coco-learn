import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IpcMain } from 'electron';
import registerTokenTraining from './token-training';
import { ContextChapterStore } from './context-training';

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'token-quest-'));
  let user = 'alice';
  const handlers: Record<string, (...args: any[]) => any> = {};
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
    changed: jest.fn(),
    createConversation: jest.fn(),
    openConversation: jest.fn(),
  };
  const service = registerTokenTraining(options);
  const call = (name: string, ...args: unknown[]) =>
    handlers[name]({}, ...args);
  const unlock = () => {
    const store = new ContextChapterStore(path.join(root, 'context-chapter'));
    store.hit(user, 'workspaceSet');
    store.hit(user, 'fileLinked');
    store.hit(user, 'fileRead');
  };
  const done = (session: string, id: string, extra = {}) =>
    service.observe(
      session,
      id,
      user,
    )({
      type: 'done',
      guidance: 'Answer',
      llm_metrics: {
        model: 'model-a',
        prompt_tokens: 100,
        completion_tokens: 20,
      },
      ...extra,
    });
  return {
    root,
    options,
    service,
    call,
    unlock,
    done,
    setUser: (value: string) => {
      user = value;
    },
  };
}

test('requires Context, two measured replies in the quest, and a correct answer; resumes and persists completion', () => {
  const t = setup();
  try {
    expect(() => t.call('token-chapter-start')).toThrow('Chapter 2');
    t.unlock();
    const session = t.call('token-chapter-start');
    expect(t.call('token-chapter-start').sessionId).toBe(session.sessionId);
    expect(t.options.createConversation).toHaveBeenCalledTimes(1);
    expect(() => t.call('token-usage')).toThrow('Chapter 3');
    t.done('ordinary-chat', 'other');
    t.done(session.sessionId, 'missing', { llm_metrics: undefined });
    t.done(session.sessionId, 'stopped', { stopped: true });
    t.done(session.sessionId, 'failed', {
      llm_metrics: { success: false, input_tokens: 100, output_tokens: 20 },
    });
    expect(() =>
      t.call('token-chapter-answer', session.sessionId, 'context'),
    ).toThrow('two requests');
    t.done(session.sessionId, 'one');
    t.done(session.sessionId, 'one');
    expect(
      t.call('token-chapter-session', session.sessionId).requests,
    ).toHaveLength(1);
    t.done(session.sessionId, 'two');
    expect(t.call('token-chapter-answer', session.sessionId, 'words')).toEqual({
      correct: false,
    });
    expect(t.call('token-chapter-progress').completedAt).toBeNull();
    expect(
      t.call('token-chapter-answer', session.sessionId, 'context'),
    ).toEqual({ correct: true });
    const { completedAt } = t.call('token-chapter-progress');
    registerTokenTraining(t.options);
    expect(t.call('token-chapter-progress').completedAt).toBe(completedAt);
    const usage = t.call('token-usage');
    expect(usage.requests).toHaveLength(6);
    expect(
      usage.requests.find((request: any) => request.requestId === 'missing')
        .input,
    ).toBeNull();
  } finally {
    fs.rmSync(t.root, { recursive: true, force: true });
  }
});

test('isolates accounts and ignores events from a previous signed-in user', () => {
  const t = setup();
  try {
    t.unlock();
    const session = t.call('token-chapter-start');
    const observe = t.service.observe(session.sessionId, 'late', 'alice');
    t.setUser('bob');
    observe({
      type: 'done',
      guidance: 'Answer',
      llm_metrics: { input_tokens: 5, output_tokens: 4 },
    });
    expect(t.call('token-chapter-session', session.sessionId)).toBeNull();
    expect(() =>
      t.call('token-chapter-answer', session.sessionId, 'context'),
    ).toThrow();
    expect(t.call('token-chapter-progress').completedAt).toBeNull();
    expect(t.service.get('../../outside', 'bob')).toBeNull();
    t.setUser('alice');
    expect(
      t.call('token-chapter-session', session.sessionId).requests,
    ).toHaveLength(0);
  } finally {
    fs.rmSync(t.root, { recursive: true, force: true });
  }
});

test('admin mode can start without prerequisites, while student mode still requires them', () => {
  const t = setup();
  try {
    expect(() => t.call('token-chapter-start')).toThrow('first');
    t.options.canSkipPrerequisites.mockReturnValue(true);
    expect(t.call('token-chapter-start').sessionId).toBeTruthy();
    t.options.canSkipPrerequisites.mockReturnValue(false);
    expect(() => t.call('token-chapter-start')).toThrow('first');
  } finally {
    fs.rmSync(t.root, { recursive: true, force: true });
  }
});
