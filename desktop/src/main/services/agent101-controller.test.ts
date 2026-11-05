/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import createAgent101Controller from './agent101-controller';
import type AgentRuns from './agent-runs';
import type CommandApprovalRules from './command-approval-rules';

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent101-controller-'));
  const handlers: Record<string, (...args: any[]) => any> = {};
  const event = { sender: {} } as IpcMainInvokeEvent;
  const state = { user: 'alice', allowed: true, model: 'model-a' };
  const deps = {
    ipc: {
      handle: (name: string, handler: any) => {
        handlers[name] = handler;
      },
    } as unknown as IpcMain,
    root: () => root,
    currentUser: () => state.user,
    authenticated: () => true,
    allowed: () => state.allowed,
    isChatSender: (request: IpcMainInvokeEvent) =>
      request.sender === event.sender,
    canSkipPrerequisites: () => true,
    gateway: () => null,
    models: () => null,
    runs: { legacyBusy: false, requests: new Map() } as unknown as AgentRuns,
    activeRequests: new Set<string>(),
    interactions: { trackTurn: async <T>(turn: () => Promise<T>) => turn() },
    directory: () => root,
    token: 'test-token',
    approvalRules: () => ({}) as CommandApprovalRules,
    stream: jest.fn(),
    notify: jest.fn(),
    reveal: async () => '',
    warn: jest.fn(),
    conversations: {
      read: () => [],
      save: jest.fn(),
      saveDirectory: jest.fn(),
      model: () => state.model,
      open: jest.fn(),
    },
  };
  const controller = createAgent101Controller(deps);
  return {
    state,
    deps,
    controller,
    handlers,
    event,
    dispose: () => {
      controller.dispose();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

it('opens chapter conversations with live account and model state', async () => {
  const test = setup();
  try {
    const first = await test.handlers['context-chapter-start'](test.event);
    expect(first.user).toBe('alice');
    expect(test.deps.conversations.open).toHaveBeenCalledWith(
      first.sessionId,
      'Chapter 2 · Context',
    );
    expect(test.deps.conversations.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ tutorModelId: 'model-a' }),
    );
    test.state.user = 'bob';
    test.state.model = 'model-b';
    const second = await test.handlers['context-chapter-start'](test.event);
    expect(second.user).toBe('bob');
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(test.deps.conversations.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ tutorModelId: 'model-b' }),
    );
    expect(
      test.controller.contextTraining.get(first.sessionId, 'bob'),
    ).toBeNull();
  } finally {
    test.dispose();
  }
});

it('keeps chapter IPC restricted to the chat window and current access', async () => {
  const test = setup();
  try {
    await expect(
      test.handlers['context-chapter-start']({ sender: {} }),
    ).rejects.toThrow('Sign in');
    test.state.allowed = false;
    await expect(
      test.handlers['context-chapter-start'](test.event),
    ).rejects.toThrow('AI tutoring');
    expect(test.deps.conversations.open).not.toHaveBeenCalled();
    test.state.allowed = true;
    await test.handlers['context-chapter-start'](test.event);
    expect(test.deps.conversations.open).toHaveBeenCalledTimes(1);
  } finally {
    test.dispose();
  }
});

it('restores the saved tutor model when opening a Tool practice conversation', async () => {
  const test = setup();
  try {
    const session = await test.handlers['tool-chapter-start'](test.event);
    expect(test.deps.conversations.open).toHaveBeenCalledWith(
      session.sessionId,
      expect.stringContaining('Chapter 1'),
      true,
    );
    expect(test.deps.conversations.saveDirectory).toHaveBeenCalledWith(
      session.sessionId,
      session.directory,
    );
  } finally {
    test.dispose();
  }
});

it('streams stopped workflow turns and propagates other errors', async () => {
  const test = setup();
  try {
    const chat = jest
      .spyOn(test.controller.workflowTraining, 'chat')
      .mockRejectedValue(new Error('cancelled'));
    test.deps.runs.requests.set('request', {
      sessionId: 'session',
      stopped: true,
      legacy: false,
    });
    await expect(
      test.controller.runWorkflowChatTurn(
        test.event,
        'session',
        'request',
        'hello',
      ),
    ).resolves.toEqual({ streamed: true });
    expect(test.deps.stream).toHaveBeenCalledWith(
      test.event.sender,
      expect.objectContaining({
        type: 'done',
        stopped: true,
        requestId: 'request',
      }),
    );
    test.deps.runs.requests.clear();
    await expect(
      test.controller.runWorkflowChatTurn(
        test.event,
        'session',
        'next',
        'hello',
      ),
    ).rejects.toThrow('cancelled');
    expect(chat).toHaveBeenCalledTimes(2);
  } finally {
    test.dispose();
  }
});
