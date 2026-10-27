import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import type AgentRuns from './agent-runs';
import type { ToolTrainingSession } from '../../shared/tool-exploration';
import registerToolExploration from './tool-exploration';

it('opens paired normal conversations, restores their policy, and saves actual learning progress', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-chat-'));
  const handlers: Record<string, (...args: any[]) => any> = {};
  let user = 'alice';
  const created: ToolTrainingSession[] = [];
  const openConversation = jest.fn();
  const changed = jest.fn();
  let verdict = false;
  const runs = {
    begin: jest.fn(),
    finish: jest.fn(),
    release: jest.fn(),
    get: () => ({
      run: async (input: any) => {
        input.emit({
          type: 'done',
          guidance: JSON.stringify({ needsExternalInformation: verdict }),
        });
      },
    }),
  } as unknown as AgentRuns;
  const options = {
    ipc: {
      handle: (name: string, handler: any) => {
        handlers[name] = handler;
      },
    } as unknown as IpcMain,
    runs,
    root: () => root,
    user: () => user,
    currentUser: () => user,
    connection: () => ({ tutorUrl: 'http://localhost', token: 'test' }),
    changed,
    createConversation: (session: ToolTrainingSession) => created.push(session),
    openConversation,
  };
  const service = registerToolExploration(options);
  const event = {} as IpcMainInvokeEvent;
  const context = {
    model: 'test',
    scenario: '',
    problem: '',
    user_name: '',
    ai_tools: [],
    memory: '',
    messages: [],
  };
  try {
    const session = handlers['tool-chapter-start'](event);
    expect(created.map((item) => item.mode)).toEqual(['with', 'without']);
    expect(openConversation).toHaveBeenCalledWith(session);
    expect(service.training(session.sessionId, user)).toMatchObject({
      tools: 'bash',
      persist: true,
    });
    expect(service.training(session.peerSessionId, user)?.tools).toBe('none');
    expect(service.training(session.sessionId, 'bob')).toBeUndefined();
    handlers['tool-chapter-switch'](event, session.sessionId);
    expect(openConversation).toHaveBeenLastCalledWith(created[1]);
    expect(
      registerToolExploration(options).training(session.peerSessionId, user)
        ?.tools,
    ).toBe('none');
    const observe = service.observe(
      session.sessionId,
      user,
      context,
      'Explain gravity',
    );
    observe({
      type: 'agent_activity',
      activity: [
        {
          kind: 'permission',
          request: { id: 'workspace', kind: 'workspace', status: 'allowed' },
        },
      ],
    });
    expect(handlers['tool-chapter-progress'](event).approved).toBe(false);
    observe({
      type: 'agent_activity',
      activity: [
        {
          kind: 'permission',
          request: {
            id: 'allow',
            kind: 'action',
            tool: 'bash',
            status: 'allowed',
          },
        },
        {
          kind: 'permission',
          request: {
            id: 'deny',
            kind: 'action',
            tool: 'bash',
            status: 'denied',
          },
        },
      ],
    });
    observe({ type: 'done' });
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(handlers['tool-chapter-progress'](event)).toMatchObject({
      approved: true,
      denied: true,
      externalInformation: false,
      completedAt: null,
    });
    verdict = true;
    service.observe(
      session.sessionId,
      user,
      context,
      'How many tasks are in notes.txt?',
    )({ type: 'done' });
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(handlers['tool-chapter-progress'](event).completedAt).toEqual(
      expect.any(String),
    );
    user = 'bob';
    expect(
      handlers['tool-chapter-session'](event, session.sessionId),
    ).toBeNull();
    expect(() =>
      handlers['tool-chapter-switch'](event, session.sessionId),
    ).toThrow('not found');
    expect(handlers['tool-chapter-progress'](event).completedAt).toBeNull();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
