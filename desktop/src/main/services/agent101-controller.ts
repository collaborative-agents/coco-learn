import { randomUUID } from 'crypto';
import type { IpcMain, IpcMainInvokeEvent, WebContents } from 'electron';
import aggregateCallMetrics from '../../shared/aggregate-call-metrics';
import type { LLMCallMetrics } from '../../renderer/components/observation-types';
import type { TutorStreamEvent } from './tutor-stream';
import type AgentRuns from './agent-runs';
import type { InteractionTracker } from '../interaction-tracker';
import type { CocoGatewayClient } from './gateway-client';
import type { readModelConfiguration } from '../model-config-store';
import type {
  StoredConversation,
  saveConversation,
  saveConversationDirectory,
} from '../conversation-store';
import type CommandApprovalRules from './command-approval-rules';
import registerContextTraining from './context-training';
import registerTokenTraining from './token-training';
import registerModelTraining from './model-training';
import registerWorkflowTraining from './workflow-training';
import registerToolExploration from './tool-exploration';
import trackAgent101 from './agent101-tracking';

interface Agent101Dependencies {
  ipc: IpcMain;
  root: () => string;
  currentUser: () => string | null;
  authenticated: () => boolean;
  allowed: () => boolean;
  isChatSender: (event: IpcMainInvokeEvent) => boolean;
  canSkipPrerequisites: () => boolean;
  gateway: () => CocoGatewayClient | null;
  models: typeof readModelConfiguration;
  runs: AgentRuns;
  activeRequests: Set<string>;
  interactions: Pick<InteractionTracker, 'trackTurn'>;
  directory: (sessionId: string) => string;
  token: string;
  approvalRules: () => CommandApprovalRules;
  stream: (sender: WebContents, payload: Record<string, unknown>) => void;
  notify: (channel: string, payload: null) => void;
  reveal: (directory: string) => Promise<string>;
  warn: (error: unknown) => void;
  conversations: {
    read: () => StoredConversation[];
    save: typeof saveConversation;
    saveDirectory: typeof saveConversationDirectory;
    model: () => string | null;
    open: (sessionId: string, label: string, restoreModel?: boolean) => void;
  };
}

/** Owns Agent 101 chapter wiring, practice runs, and workflow chat turns.
 * Application state is read through callbacks so account/model changes stay live.
 */
export default function createAgent101Controller(deps: Agent101Dependencies) {
  const requireUser = (
    event: IpcMainInvokeEvent,
    run: boolean,
    message: string,
  ) => {
    const user = deps.currentUser();
    if (!deps.isChatSender(event) || !deps.authenticated() || !user)
      throw new Error(message);
    if (run && !deps.allowed())
      throw new Error('AI tutoring is not available for this account yet.');
    return user;
  };
  const agent101Tracking = trackAgent101({
    ipc: deps.ipc,
    root: deps.root,
    user: () => (deps.authenticated() ? deps.currentUser() : null),
    gateway: deps.gateway,
    warn: (error) => deps.warn(error),
  });

  const contextTraining = registerContextTraining({
    canSkipPrerequisites: deps.canSkipPrerequisites,
    ipc: agent101Tracking.ipc,
    root: deps.root,
    user: (event, run = false) =>
      requireUser(event, run, 'Sign in to use Agent 101.'),
    currentUser: deps.currentUser,
    changed: () => deps.notify('context-chapter-progress-changed', null),
    createConversation: (session) => {
      deps.conversations.save({
        sessionId: session.sessionId,
        problem: 'Chapter 2 · Context',
        tutorModelId: deps.conversations.model() ?? undefined,
        messages: [
          {
            role: 'tutor',
            text: 'Let’s explore what I can see. Choose a working folder below, then ask me about it.',
            id: randomUUID(),
            ts: Date.now(),
          },
        ],
      });
    },
    openConversation: (session) => {
      if (deps.runs.legacyBusy)
        throw new Error('Wait for the practice suggestion to finish.');
      deps.conversations.open(session.sessionId, 'Chapter 2 · Context');
    },
  });

  const tokenTraining = registerTokenTraining({
    canSkipPrerequisites: deps.canSkipPrerequisites,
    ipc: agent101Tracking.ipc,
    root: deps.root,
    user: (event, run = false) =>
      requireUser(event, run, 'Sign in to use Agent 101.'),
    currentUser: deps.currentUser,

    changed: () => deps.notify('token-chapter-progress-changed', null),
    createConversation: (session) => {
      deps.conversations.save({
        sessionId: session.sessionId,
        problem: 'Chapter 3 · Token',
        tutorModelId: deps.conversations.model() ?? undefined,
        messages: [
          {
            role: 'tutor',
            text: 'Let’s see what a request uses. Send the one-sentence question below, then compare it with a more detailed follow-up.',
            id: randomUUID(),
            ts: Date.now(),
          },
        ],
      });
    },
    openConversation: (session) => {
      if (deps.runs.legacyBusy)
        throw new Error('Wait for the practice suggestion to finish.');
      deps.conversations.open(session.sessionId, 'Chapter 3 · Token');
    },
  });

  const modelTraining = registerModelTraining({
    canSkipPrerequisites: deps.canSkipPrerequisites,
    ipc: agent101Tracking.ipc,
    root: deps.root,
    user: (event, run = false) =>
      requireUser(event, run, 'Sign in to use Agent 101.'),
    currentUser: deps.currentUser,
    models: () => deps.models()?.tutors ?? [],
    changed: (completion) => {
      deps.notify('model-chapter-session-changed', null);

      if (completion) deps.notify('model-chapter-progress-changed', null);
    },
    open: (session, created) => {
      if (deps.runs.legacyBusy)
        throw new Error('Wait for the current practice suggestion to finish.');
      if (created)
        deps.conversations.save({
          sessionId: session.sessionId,
          problem: 'Chapter 4 · Models',
          messages: [],
        });
      deps.conversations.open(session.sessionId, 'Chapter 4 · Models');
    },
    stop: (id) => deps.runs.abort(id),
    run: async (request) => {
      if (
        deps.currentUser() !== request.user ||
        !deps.authenticated() ||
        !deps.allowed()
      )
        throw new Error('Your account changed. Reopen the quest to continue.');
      deps.runs.begin(request.sessionId, request.requestId);
      deps.activeRequests.add(request.requestId);
      const recordUsage = tokenTraining.observe(
        request.questSessionId,
        request.requestId,
        request.user,
      );
      const emit = (event: TutorStreamEvent) => {
        recordUsage(event);
        request.emit(event);
      };
      try {
        await deps.interactions.trackTurn(() =>
          deps.runs.get(request.sessionId).run({
            requestId: request.requestId,
            sessionId: request.sessionId,
            directory: deps.directory(request.questSessionId),
            tutorUrl: `http://127.0.0.1:${process.env.TUTOR_PORT || '8081'}`,
            token: deps.token,
            text: request.prompt,
            images: [],
            context: {
              model: request.model,
              scenario: '',
              problem: 'Model comparison',
              user_name: '',
              ai_tools: [],
              memory: '',
              messages: [],
            },
            training: {
              tools: 'none',
              instructions:
                'Answer the user’s request directly. Follow the requested format. Keep prose concise, at most 160 words; code is exempt from this limit. Do not add a quiz or claim quest completion. No tools are available.',
            },
            emit,
          }),
        );
      } catch (error) {
        recordUsage({
          type: 'error',
          llm_metrics: (error as { llm_metrics?: LLMCallMetrics })?.llm_metrics,
        });
        throw error;
      } finally {
        deps.activeRequests.delete(request.requestId);
        deps.runs.finish(request.requestId);
        await deps.runs.release(request.sessionId);
      }
    },
  });

  const workflowChatTurns = new Map<
    string,
    {
      requestId: string;
      images: string[];
      metrics: LLMCallMetrics[];
      sender: WebContents;
    }
  >();
  const workflowTraining = registerWorkflowTraining({
    ipc: agent101Tracking.ipc,
    root: deps.root,
    currentUser: deps.currentUser,
    user: (event, run = false) =>
      requireUser(event, run, 'Sign in to use your skills.'),
    canStart: (user) =>
      deps.canSkipPrerequisites() || modelTraining.canPick(user),

    changed: () => deps.notify('workflow-chapter-progress-changed', null),
    reveal: (directory) => deps.reveal(directory),
    open: (session, created) => {
      if (deps.runs.legacyBusy)
        throw new Error('Wait for the current request to finish.');
      const existing = deps.conversations
        .read()
        .find((item) => item.sessionId === session.sessionId);
      if (created || !existing?.messages.length)
        deps.conversations.save({
          sessionId: session.sessionId,
          problem: 'Chapter 5 · Build your own skill',
          messages: [
            {
              role: 'tutor',
              text: 'Let’s create a skill that works the way you do. What’s a task you do repeatedly that you’d like my help with?',
              id: randomUUID(),
              ts: Date.now(),
            },
            ...(session.messages ?? []).map((message) => ({
              role:
                message.role === 'assistant'
                  ? ('tutor' as const)
                  : ('user' as const),
              text: message.text,
              id: message.id,
              ts: Date.now(),
            })),
          ],
        });
      deps.conversations.open(
        session.sessionId,
        'Chapter 5 · Build your own skill',
      );
    },
    run: async (user, questId, prompt, instructions, mode) => {
      if (
        deps.currentUser() !== user ||
        !deps.authenticated() ||
        !deps.allowed()
      )
        throw new Error('Reopen the quest with your current account.');
      const turn = workflowChatTurns.get(questId);
      const requestId = turn?.requestId ?? randomUUID();
      const runId = turn ? questId : randomUUID();
      if (deps.runs.requests.get(requestId)?.stopped)
        throw new Error('Stopped.');
      const config = deps.models();
      const model =
        config?.tutors.find((item) => item.id === deps.conversations.model()) ??
        config?.tutors[0];
      if (!model) throw new Error('Configure a model before creating a skill.');
      if (!turn) deps.runs.begin(runId, requestId);
      deps.activeRequests.add(requestId);
      const record = tokenTraining.observe(questId, randomUUID(), user);
      let output = '';
      let failure = '';
      try {
        await deps.interactions.trackTurn(() =>
          deps.runs.get(runId).run({
            requestId,
            sessionId: runId,
            directory: deps.directory(questId),
            tutorUrl: `http://127.0.0.1:${process.env.TUTOR_PORT || '8081'}`,
            token: deps.token,
            text:
              mode === 'execute'
                ? `${instructions}\n\nUser example:\n${prompt}`
                : prompt,
            approvalRules:
              mode === 'execute' ? deps.approvalRules() : undefined,
            images: turn?.images ?? [],
            context: {
              model: model.model,
              scenario: '',
              problem: 'Personal skill workshop',
              user_name: '',
              ai_tools: [],
              memory: '',
              messages: [],
            },
            training:
              mode === 'execute'
                ? undefined
                : { tools: 'none', instructions, persist: false },
            emit: (event) => {
              record(event);
              if (
                turn &&
                mode === 'execute' &&
                [
                  'agent_activity',
                  'tool_call_started',
                  'tool_call_completed',
                ].includes(event.type)
              ) {
                deps.stream(turn.sender, {
                  ...event,
                  sessionId: questId,
                  requestId,
                });
              }
              if (event.type === 'text_delta' && typeof event.text === 'string')
                output += event.text;
              if (event.type === 'done') {
                if (turn) {
                  turn.metrics.push(
                    (event.llm_metrics as LLMCallMetrics | undefined) ?? {},
                  );
                  if (event.observer_metrics)
                    turn.metrics.push(event.observer_metrics as LLMCallMetrics);
                }
                if (!output && typeof event.guidance === 'string')
                  output = event.guidance;
                if (event.stopped)
                  failure = 'Request stopped. Please try again.';
              }
              if (event.type === 'error')
                failure = String(event.error || 'Request failed.');
            },
          }),
        );
        if (failure) throw new Error(failure);
        if (!output.trim())
          throw new Error('The model returned no content. Please try again.');
        return output;
      } finally {
        if (!turn) {
          deps.activeRequests.delete(requestId);
          deps.runs.finish(requestId);
          await deps.runs.release(runId);
        }
      }
    },
  });

  const toolTraining = registerToolExploration({
    ipc: agent101Tracking.ipc,
    runs: deps.runs,
    root: deps.root,
    user: (event, run = false) =>
      requireUser(event, run, 'Sign in to use Agent 101.'),
    currentUser: deps.currentUser,
    createConversation: (session) => {
      const mode = session.mode === 'with' ? 'With tools' : 'Without tools';
      deps.conversations.save({
        sessionId: session.sessionId,
        problem: `Chapter 1 · Tool · ${mode}`,
        tutorModelId: deps.conversations.model() ?? undefined,
        messages: [
          {
            role: 'tutor',
            text:
              session.mode === 'with'
                ? 'In this session, Coco can make tool calls'
                : 'In this session, Coco *cannot* make tool calls',
            id: randomUUID(),
            ts: Date.now(),
          },
        ],
      });
      deps.conversations.saveDirectory(session.sessionId, session.directory);
    },
    openConversation: (session) => {
      if (deps.runs.legacyBusy)
        throw new Error('Wait for the practice suggestion to finish.');
      deps.conversations.open(
        session.sessionId,
        `Chapter 1 · Tool · ${session.mode === 'with' ? 'With tools' : 'Without tools'}`,
        true,
      );
    },
    connection: () => ({
      tutorUrl: `http://127.0.0.1:${process.env.TUTOR_PORT || '8081'}`,
      token: deps.token,
    }),
    changed: () => deps.notify('tool-chapter-progress-changed', null),
  });

  async function runWorkflowChatTurn(
    event: IpcMainInvokeEvent,
    sessionId: string,
    requestId: string,
    text: string,
    images: string[] = [],
  ) {
    const metrics: LLMCallMetrics[] = [];
    workflowChatTurns.set(sessionId, {
      requestId,
      images,
      metrics,
      sender: event.sender,
    });
    try {
      const result = await workflowTraining.chat(event, sessionId, text);
      const guidance = result.messages?.at(-1)?.text ?? '';
      deps.stream(event.sender, {
        sessionId,
        requestId,
        type: 'done',
        guidance,
        llm_metrics: aggregateCallMetrics(metrics),
      });
      deps.gateway()?.addMessage(sessionId, 'coco', guidance);
      return { streamed: true };
    } catch (error) {
      if (deps.runs.requests.get(requestId)?.stopped) {
        deps.stream(event.sender, {
          sessionId,
          requestId,
          type: 'done',
          guidance: 'Stopped.',
          stopped: true,
          llm_metrics: aggregateCallMetrics(metrics),
        });
        return { streamed: true };
      }
      throw error;
    } finally {
      workflowChatTurns.delete(sessionId);
    }
  }

  return {
    contextTraining,
    tokenTraining,
    modelTraining,
    workflowTraining,
    toolTraining,
    runWorkflowChatTurn,
    notifyAccountChanged: () => {
      for (const chapter of ['tool', 'context', 'token', 'model', 'workflow'])
        deps.notify(`${chapter}-chapter-progress-changed`, null);
    },
    dispose: () => agent101Tracking.dispose(),
  };
}
