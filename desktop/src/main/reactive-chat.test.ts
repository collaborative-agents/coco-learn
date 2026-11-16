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

it.each(['text','voice'])('routes a real %s agent turn through tutorial preparation and validation', async kind => {
  const t=setup();
  const runner={begin:jest.fn(()=> 'Actually edit and test the game.'),finish:jest.fn(async()=>{})};
  Object.assign(t.deps,{runner});
  const payload=kind==='text'?{requestId:'runner-test',userText:'Make the fox pink'}:{requestId:'runner-test',audioData:'audio'};
  await t.handlers[kind==='text'?'send-chat-message':'send-audio-message'](t.event,payload);
  expect(runner.begin).toHaveBeenCalledWith('session','runner-test', ...(kind==='text'?['Make the fox pink']:[]));
  expect(t.run).toHaveBeenCalledWith(expect.objectContaining({instructions:'Actually edit and test the game.'}));
  expect(runner.finish).toHaveBeenCalledWith('session',true,undefined);
});
it('rolls the tutorial back when the real agent turn fails',async()=>{
  const t=setup();const runner={begin:jest.fn(()=> 'Make it.'),finish:jest.fn(async()=>{})};
  Object.assign(t.deps,{runner});t.run.mockRejectedValueOnce(Error('provider unavailable'));
  await t.handlers['send-chat-message'](t.event,{requestId:'failed-game',userText:'Change the world'});
  expect(runner.finish).toHaveBeenCalledWith('session',false,'provider unavailable');
});

it('waits for game validation before delivering the final completion',async()=>{
  const t=setup();let release:(value:boolean)=>void=()=>{};
  const validated=new Promise<boolean>(resolve=>{release=resolve});
  Object.assign(t.deps,{runner:{begin:()=> 'Edit the real game.',finish:()=>validated}});
  const pending=t.handlers['send-chat-message'](t.event,{requestId:'validating-game',userText:'Make it pink'});
  await new Promise(resolve=>setImmediate(resolve));
  expect(t.deps.emit.mock.calls.some(([,event]:any)=>event.type==='done')).toBe(false);
  release(false);await pending;
  expect(t.deps.emit).toHaveBeenCalledWith(t.event.sender,expect.objectContaining({type:'error',error:expect.stringContaining('previous game')}));
});

it('repairs a validation failure up to twice before publishing',async()=>{
 const t=setup();const check=jest.fn().mockRejectedValueOnce(Error('bad grid')).mockRejectedValueOnce(Error('bad palette')).mockResolvedValue({changed:true});
 const runner={begin:()=> 'Edit the theme.',check,repair:jest.fn(()=> 'Repair the reported theme problem.'),finish:jest.fn(async()=>true),summary:()=> 'I painted the sky.'};Object.assign(t.deps,{runner});
 await t.handlers['send-chat-message'](t.event,{requestId:'repair',userText:'make it daylight'});
 expect(t.run).toHaveBeenCalledTimes(3);expect(runner.repair).toHaveBeenCalledTimes(2);expect(runner.finish).toHaveBeenCalledWith('session',true,undefined);
});
it('stops after two repairs and reports the actual validation diagnostic',async()=>{
 const t=setup();const runner={begin:()=> 'Edit the theme.',check:jest.fn(async()=>{throw Error('bad grid')}),repair:()=> 'Repair grid.',finish:jest.fn(async()=>false),failure:()=> 'The sprite grid is not rectangular. Previous game retained.'};Object.assign(t.deps,{runner});
 await t.handlers['send-chat-message'](t.event,{requestId:'repair-failed',userText:'make it daylight'});
 expect(t.run).toHaveBeenCalledTimes(3);expect(runner.finish).toHaveBeenCalledWith('session',false,'bad grid');expect(t.deps.emit).toHaveBeenCalledWith(t.event.sender,expect.objectContaining({type:'error',error:expect.stringContaining('not rectangular')}));
});

it('retries an empty model response instead of asking the user for a smaller idea',async()=>{
 const t=setup();t.run.mockRejectedValueOnce(Error('The model returned no reply or action'));
 const runner={begin:()=> 'Edit theme.',check:jest.fn().mockRejectedValueOnce(Error('No change')).mockResolvedValue({changed:true}),repair:()=> 'Finish the original request.',finish:jest.fn(async()=>true),summary:()=> 'I painted the sky.'};Object.assign(t.deps,{runner});
 await t.handlers['send-chat-message'](t.event,{requestId:'empty',userText:'make it cuter'});
 expect(t.run).toHaveBeenCalledTimes(2);expect(runner.finish).toHaveBeenCalledWith('session',true,undefined);
});
it('can publish actual validated edits even if the model explanation cuts off',async()=>{
 const t=setup();t.run.mockRejectedValueOnce(Error('The model returned no reply or action'));
 const runner={begin:()=> 'Edit theme.',check:jest.fn(async()=>({changed:true})),finish:jest.fn(async()=>true),summary:()=> 'I drew your cat.'};Object.assign(t.deps,{runner});
 await t.handlers['send-chat-message'](t.event,{requestId:'cutoff',userText:'make a cat'});
 expect(t.run).toHaveBeenCalledTimes(1);expect(runner.finish).toHaveBeenCalledWith('session',true,undefined);
 expect(t.deps.emit).toHaveBeenCalledWith(t.event.sender,expect.objectContaining({type:'done',guidance:'I drew your cat.'}));
});

it.each(['text', 'voice'])('uses normal chat for %s onboarding questions that need no game preparation', async kind => {
  const t = setup();
  const runner = { begin: jest.fn(() => null), tools: jest.fn(), finish: jest.fn() };
  Object.assign(t.deps, { runner });
  await t.handlers[kind === 'text' ? 'send-chat-message' : 'send-audio-message'](t.event,
    kind === 'text' ? {requestId:'intro-question',userText:'who are you'} : {requestId:'intro-question',audioData:'audio'});
  expect(t.run).toHaveBeenCalledWith(expect.objectContaining({ game: undefined }));
  expect(runner.tools).not.toHaveBeenCalled();
  expect(runner.finish).not.toHaveBeenCalled();
});
