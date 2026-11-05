/** @jest-environment node */
import axios from 'axios';
import registerReactiveChat from './reactive-chat';
import { consumeTutorStream } from './services/tutor-stream';
import type { TutorStreamEvent } from './services/tutor-stream';
jest.mock('axios');
jest.mock('electron-log', () => ({ warn: jest.fn(), error: jest.fn() }));
jest.mock('./services/tutor-stream', () => ({
  ...jest.requireActual('./services/tutor-stream'),
  consumeTutorStream: jest.fn(),
}));
function setup() {
  const handlers: Record<string, (...args: any[]) => Promise<any>> = {};
  const requests = new Map<string, { stopped: boolean }>();
  const run = jest.fn(
    async (input: { emit: (event: TutorStreamEvent) => void }) => {
      input.emit({ type: 'text_delta', text: 'Hello' });
      input.emit({ type: 'done', llm_metrics: { model: 'test-model' } });
    },
  );
  const usage = jest.fn();
  const gateway = { addMessage: jest.fn() };
  const reminder = { update: jest.fn(), dispose: jest.fn() };
  const workflowGet = jest.fn(() => null as any);
  const workflowRun = jest.fn(async () => ({ streamed: true }));
  const state = { id: 'session', model: 'model', active: true };
  const deps = {
    ipc: {
      removeHandler: jest.fn(),
      handle: (channel: string, handler: any) => {
        handlers[channel] = handler;
      },
    },
    session: () => state,
    user: () => 'alice',
    authenticated: () => true,
    allowed: () => true,
    isChatSender: () => true,
    runs: {
      begin: jest.fn((sid, id) => {
        requests.set(id, { stopped: false });
      }),
      finish: jest.fn((id) => {
        requests.delete(id);
      }),
      requests,
      get: () => ({ run }),
    },
    activeRequests: new Set<string>(),
    interactions: { trackTurn: async (turn: () => Promise<unknown>) => turn() },
    streams: { begin: jest.fn(), finish: jest.fn() },
    gateway: () => gateway,
    training: {
      modelTraining: { get: () => null },
      workflowTraining: { get: workflowGet, runtimeSkills: () => [] },
      toolTraining: { training: () => undefined, observe: () => jest.fn() },
      contextTraining: {
        get: () => null,
        training: () => undefined,
        observe: () => jest.fn(),
      },
      tokenTraining: {
        get: () => null,
        training: () => undefined,
        observe: () => usage,
      },
      runWorkflowChatTurn: workflowRun,
    },
    context: () => ({}),
    directory: () => '/workspace',
    resume: jest.fn(async () => false),
    startSession: jest.fn(async () => 'session'),
    dismissNotification: jest.fn(),
    approvalRules: () => ({}),
    token: 'bridge-token',
    profile: () => ({ scenario: 'ai_upskilling', aiTools: ['coco'] }),
    emit: jest.fn(),
    settle: jest.fn(),
    reminders: {
      start: () => reminder,
      clear: jest.fn(),
      reply: jest.fn(async () => {}),
    },
  };
  registerReactiveChat(
    deps as unknown as Parameters<typeof registerReactiveChat>[0],
  );
  return {
    handlers,
    deps,
    run,
    usage,
    gateway,
    reminder,
    event: { sender: {} },
    state,
    workflowGet,
    workflowRun,
  };
}
afterEach(() => jest.clearAllMocks());
it.each(['text', 'voice'])(
  'stores and streams a %s reply and cleans up its request',
  async (kind) => {
    const t = setup();
    const payload =
      kind === 'text'
        ? { userText: 'Question', displayText: 'Shown' }
        : { audioData: 'audio' };
    await expect(
      t.handlers[kind === 'text' ? 'send-chat-message' : 'send-audio-message'](
        t.event,
        { requestId: 'r', ...payload },
      ),
    ).resolves.toEqual({ streamed: true });
    expect(t.deps.settle).toHaveBeenCalledWith(
      'session',
      'r',
      expect.objectContaining({
        text: 'Hello',
        tutorMetrics: { model: 'test-model' },
      }),
      kind === 'text' ? 'Shown' : undefined,
    );
    expect(t.gateway.addMessage).toHaveBeenCalledWith(
      'session',
      'coco',
      'Hello',
      expect.any(Object),
      expect.objectContaining({
        messageKind: kind === 'text' ? 'user_response' : 'voice_response',
      }),
    );
    expect(t.deps.emit).toHaveBeenCalledWith(
      t.event.sender,
      expect.objectContaining({
        type: 'done',
        sessionId: 'session',
        requestId: 'r',
      }),
    );
    expect(t.deps.activeRequests.size).toBe(0);
    expect(t.deps.runs.requests.size).toBe(0);
    expect(t.deps.streams.finish).toHaveBeenCalledWith('r');
    expect(t.reminder.dispose).toHaveBeenCalledTimes(1);
  },
);
it('preserves screenshot context separately from displayed text', async () => {
  const t = setup();
  await t.handlers['send-chat-message'](t.event, {
    requestId: 'r',
    userText: 'Question',
    displayText: 'Shown',
    images: ['image'],
    hotkeyImages: ['image'],
    screenContext: 'Visible report',
  });
  expect(t.run).toHaveBeenCalledWith(
    expect.objectContaining({
      images: ['image'],
      text: expect.stringContaining('<hotkey_screenshot_context>'),
    }),
  );
  expect(t.run.mock.calls[0][0]).toEqual(
    expect.objectContaining({
      text: expect.stringContaining('Visible report'),
    }),
  );
  expect(t.gateway.addMessage).toHaveBeenCalledWith('session', 'user', 'Shown');
});
it('records voice transcription once and activates the existing draft', async () => {
  const t = setup();
  t.state.active = false;
  t.run.mockImplementationOnce(async ({ emit }) => {
    emit({ type: 'transcription', text: 'Hello' });
    emit({ type: 'transcription', text: 'Hello again' });
    emit({ type: 'done', guidance: 'Reply' });
  });
  await t.handlers['send-audio-message'](t.event, {
    requestId: 'r',
    audioData: 'audio',
  });
  expect(t.deps.dismissNotification).toHaveBeenCalledTimes(1);
  expect(t.deps.startSession).toHaveBeenCalledWith(
    'session',
    '[Voice message]',
  );
  expect(
    t.gateway.addMessage.mock.calls.filter((call) => call[1] === 'user'),
  ).toEqual([
    ['session', 'user', 'Hello', undefined, { messageKind: 'voice_input' }],
  ]);
});
it.each(['text', 'voice'])(
  'retains failed metrics and releases %s requests on failure',
  async (kind) => {
    const t = setup();
    t.run.mockRejectedValueOnce(
      Object.assign(new Error('backend failed'), {
        llm_metrics: { model: 'failed-model' },
      }),
    );
    const result = await t.handlers[
      kind === 'text' ? 'send-chat-message' : 'send-audio-message'
    ](t.event, { requestId: 'r', userText: 'Question', audioData: 'audio' });
    expect(result.error).toBeTruthy();
    expect(t.usage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        llm_metrics: { model: 'failed-model' },
      }),
    );
    expect(t.deps.settle).toHaveBeenCalledWith(
      'session',
      'r',
      expect.objectContaining({
        isError: true,
        tutorMetrics: { model: 'failed-model' },
      }),
      undefined,
    );
    expect(t.deps.activeRequests.size).toBe(0);
    expect(t.deps.runs.requests.size).toBe(0);
    expect(t.reminder.dispose).toHaveBeenCalledTimes(1);
  },
);
it('transcribes workflow voice before routing to the skill workshop', async () => {
  const t = setup();
  t.workflowGet.mockReturnValue({ savedSkillId: null });
  jest
    .mocked(axios.post)
    .mockResolvedValueOnce({ data: { text: ' Make a skill ' } });
  await t.handlers['send-audio-message'](t.event, {
    requestId: 'r',
    audioData: 'audio',
  });
  expect(t.workflowRun).toHaveBeenCalledWith(
    t.event,
    'session',
    'r',
    'Make a skill',
  );
  expect(t.run).not.toHaveBeenCalled();
});
it('keeps practice suggestions on the legacy stream', async () => {
  const t = setup();
  jest.mocked(axios.post).mockResolvedValue({ data: {} });
  jest
    .mocked(consumeTutorStream)
    .mockImplementationOnce(async (_url, _body, emit) => {
      emit({ type: 'done', guidance: 'Practice' });
    });
  await t.handlers['send-chat-message'](t.event, {
    requestId: 'r',
    userText: '',
    requestKind: 'practice_suggestions',
  });
  expect(t.deps.runs.begin).toHaveBeenCalledWith('session', 'r', true);
  expect(t.run).not.toHaveBeenCalled();
  expect(t.deps.startSession).not.toHaveBeenCalled();
  expect(t.gateway.addMessage).toHaveBeenCalledWith(
    'session',
    'coco',
    'Practice',
    expect.any(Object),
    expect.objectContaining({ messageKind: 'practice_suggestion' }),
  );
  expect(t.deps.reminders.reply).not.toHaveBeenCalled();
});
