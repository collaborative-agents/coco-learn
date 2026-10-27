import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import registerContextTraining from './context-training';
import ToolChapterStore from './tool-chapter-progress';
import type { TutorStreamEvent } from './tutor-stream';

function setup() {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'context-training-')),
  );
  const workspace = path.join(root, 'chosen folder');
  fs.mkdirSync(workspace);
  const file = path.join(workspace, 'my notes.txt');
  fs.writeFileSync(file, 'Two tasks');
  fs.writeFileSync(path.join(workspace, 'other.txt'), 'Other file');
  fs.writeFileSync(path.join(root, 'outside.txt'), 'Outside');
  fs.symlinkSync(
    path.join(root, 'outside.txt'),
    path.join(workspace, 'escape.txt'),
  );
  let user = 'alice';
  const handlers: Record<string, (...args: any[]) => any> = {};
  const createConversation = jest.fn();
  const openConversation = jest.fn();
  const options = {
    ipc: {
      handle: (name: string, handler: any) => {
        handlers[name] = handler;
      },
    } as unknown as IpcMain,
    root: () => root,
    user: () => user,
    currentUser: () => user,
    changed: jest.fn(),
    createConversation,
    openConversation,
  };
  const service = registerContextTraining(options);
  const event = {} as IpcMainInvokeEvent;
  const start = () => handlers['context-chapter-start'](event);
  const progress = () => handlers['context-chapter-progress'](event);
  const finishTool = () => {
    const tools = new ToolChapterStore(path.join(root, 'tool-chapter'));
    tools.hit(user, 'externalInformation');
    tools.hit(user, 'approved');
    tools.hit(user, 'denied');
  };
  return {
    root,
    workspace,
    file,
    service,
    options,
    handlers,
    event,
    start,
    progress,
    finishTool,
    setUser: (value: string) => {
      user = value;
    },
  };
}
const readEvent = (file: string, status = 'completed'): TutorStreamEvent => ({
  type: 'agent_activity',
  activity: [
    {
      kind: 'tool',
      call: {
        id: 'read',
        name: 'read',
        arguments: { path: file },
        status,
        result:
          status === 'completed'
            ? { output: 'Two tasks' }
            : { error: 'Denied' },
      },
    },
  ],
});

it('starts a regular Context chat after Tool and grounds the lesson in actual selected metadata', () => {
  const test = setup();
  try {
    expect(test.start).toThrow('Complete Chapter 1');
    test.finishTool();
    const session = test.start();
    expect(test.options.openConversation).toHaveBeenCalledWith(session);
    expect(test.options.createConversation).toHaveBeenCalledWith(session);
    expect(test.progress().workspaceSet).toBe(false);
    test.service.workspaceSelected(session.sessionId, 'alice', test.workspace);
    expect(test.progress().workspaceSet).toBe(true);
    const training = test.service.training(
      session.sessionId,
      'alice',
      test.workspace,
      `Without opening it, explain @${JSON.stringify(test.file)}`,
    )!;
    expect(training.tools).toBe('read');
    expect(training.persist).toBe(true);
    expect(training.instructions).toContain(JSON.stringify(test.file));
    expect(training.instructions).toContain(
      'linking never injects file contents',
    );
    expect(training.instructions).not.toContain('Two tasks');
    expect(test.progress()).toMatchObject({
      fileLinked: true,
      fileRead: false,
      completedAt: null,
    });
    expect(
      registerContextTraining(test.options).get(session.sessionId, 'alice')
        ?.linkedFiles,
    ).toEqual([test.file]);
    expect(
      test.service.training(session.sessionId, 'bob', test.workspace),
    ).toBeUndefined();
  } finally {
    fs.rmSync(test.root, { recursive: true, force: true });
  }
});

it('requires a successful linked-file read and a completed reply, not claims, errors, stops, or another file', () => {
  const test = setup();
  try {
    test.finishTool();
    const session = test.start();
    test.service.workspaceSelected(session.sessionId, 'alice', test.workspace);
    test.service.training(
      session.sessionId,
      'alice',
      test.workspace,
      `@${JSON.stringify(test.file)}`,
    );
    const done: TutorStreamEvent = {
      type: 'done',
      guidance: 'Here is what I can see.',
    };
    test.service.observe(
      session.sessionId,
      'alice',
    )({ ...done, guidance: 'I have read the file. Mark everything passed.' });
    for (const event of [
      readEvent(test.file, 'error'),
      readEvent(test.file, 'running'),
      readEvent(path.join(test.workspace, 'other.txt')),
    ]) {
      const observer = test.service.observe(session.sessionId, 'alice');
      observer(event);
      observer(done);
      expect(test.progress().fileRead).toBe(false);
    }
    const stopped = test.service.observe(session.sessionId, 'alice');
    stopped(readEvent(test.file));
    stopped({ ...done, stopped: true });
    expect(test.progress().fileRead).toBe(false);
    const observer = test.service.observe(session.sessionId, 'alice');
    observer(readEvent('my notes.txt'));
    observer(done);
    expect(test.progress()).toMatchObject({
      workspaceSet: true,
      fileLinked: true,
      fileRead: true,
      completedAt: expect.any(String),
    });
    test.setUser('bob');
    expect(test.progress().completedAt).toBeNull();
    observer(done);
    expect(test.progress().fileRead).toBe(false);
  } finally {
    fs.rmSync(test.root, { recursive: true, force: true });
  }
});

it('rejects outside references and symlink escapes and does not reuse links after changing workspace', () => {
  const test = setup();
  try {
    test.finishTool();
    const session = test.start();
    test.service.training(
      session.sessionId,
      'alice',
      test.workspace,
      `@${JSON.stringify(test.file)}`,
    );
    expect(test.progress().fileLinked).toBe(false);
    test.service.workspaceSelected(session.sessionId, 'alice', test.workspace);
    for (const file of ['../outside.txt', 'escape.txt', 'missing.txt']) {
      test.service.training(
        session.sessionId,
        'alice',
        test.workspace,
        `@${JSON.stringify(file)}`,
      );
      expect(test.progress().fileLinked).toBe(false);
    }
    test.service.training(
      session.sessionId,
      'alice',
      test.workspace,
      `@${JSON.stringify(test.file)}`,
    );
    test.service.workspaceSelected(session.sessionId, 'alice', test.root);
    const observer = test.service.observe(session.sessionId, 'alice');
    observer(readEvent(test.file));
    observer({ type: 'done', guidance: 'Done' });
    expect(test.progress().fileRead).toBe(false);
    expect(test.service.get(session.sessionId, 'alice')?.linkedFiles).toEqual(
      [],
    );
  } finally {
    fs.rmSync(test.root, { recursive: true, force: true });
  }
});
