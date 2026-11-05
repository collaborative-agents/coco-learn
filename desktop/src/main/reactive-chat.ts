import type { IpcMain, IpcMainInvokeEvent, WebContents } from 'electron';
import axios from 'axios';
import log from 'electron-log';
import type AgentRuns from './services/agent-runs';
import type ChatStreamStore from './services/chat-stream-store';
import type { InteractionTracker } from './interaction-tracker';
import type { CocoGatewayClient } from './services/gateway-client';
import type createAgent101Controller from './services/agent101-controller';
import type { SessionContextInput } from './services/pi-harness';
import type CommandApprovalRules from './services/command-approval-rules';
import type AgentProgressReminder from './services/agent-progress-reminder';
import type { StoredReply, settleStoredReply } from './conversation-store';
import type { LLMCallMetrics } from '../renderer/components/observation-types';
import {
  consumeTutorStream,
  TutorTurnTiming,
  TutorStreamTimeoutError,
} from './services/tutor-stream';
import type { TutorStreamEvent } from './services/tutor-stream';
import { shouldStartSessionFromUserMessage } from './services/session-start-policy';

interface ReactiveChatDependencies {
  ipc: Pick<IpcMain, 'handle' | 'removeHandler'>;
  session: () => { id: string | null; model: string | null; active: boolean };
  user: () => string | null;
  authenticated: () => boolean;
  allowed: () => boolean;
  isChatSender: (event: IpcMainInvokeEvent) => boolean;
  runs: AgentRuns;
  activeRequests: Set<string>;
  interactions: Pick<InteractionTracker, 'trackTurn'>;
  streams: ChatStreamStore;
  gateway: () => CocoGatewayClient | null;
  training: ReturnType<typeof createAgent101Controller>;
  context: (sessionId: string, text?: string) => SessionContextInput;
  directory: (sessionId: string) => string;
  resume: (text?: string) => Promise<boolean>;
  startSession: (sessionId: string, text: string) => Promise<unknown>;
  dismissNotification: () => void;
  approvalRules: () => CommandApprovalRules;
  token: string;
  profile: () => { scenario: string; aiTools: string[] };
  emit: (sender: WebContents, payload: Record<string, unknown>) => void;
  settle: typeof settleStoredReply;
  reminders: {
    start: (
      sessionId: string,
      requestId: string,
    ) => AgentProgressReminder | null;
    clear: (requestId: string) => void;
    reply: (sessionId: string, requestId: string) => Promise<unknown>;
  };
}

interface StreamReply {
  sessionId: string;
  requestId: string;
  voice?: boolean;
  displayText?: string;
  requestKind?: 'chat' | 'practice_suggestions';
  observers: ((event: TutorStreamEvent) => void)[];
  observeUsage: (event: TutorStreamEvent) => void;
  run: (emit: (event: TutorStreamEvent) => void) => Promise<void>;
}

/** User-initiated text/voice turns; app lifecycle and proactive UI stay behind adapters. */
export default function registerReactiveChat(deps: ReactiveChatDependencies) {
  const {
    modelTraining,
    workflowTraining,
    toolTraining,
    contextTraining,
    tokenTraining,
    runWorkflowChatTurn,
  } = deps.training;

  function prepareTurn(
    sessionId: string,
    requestId: string,
    userText?: string,
    displayText?: string,
  ) {
    const piHarness = deps.runs.get(sessionId);
    const context = deps.context(sessionId, displayText);
    const directory = deps.directory(sessionId);
    const user = deps.user();
    const training =
      toolTraining.training(sessionId, user) ??
      contextTraining.training(sessionId, user, directory, userText) ??
      tokenTraining.training(sessionId, user);
    const observeContext = contextTraining.observe(sessionId, user);
    const observeUsage = tokenTraining.observe(sessionId, requestId, user);
    const observeTools = toolTraining.observe(
      sessionId,
      user,
      context,
      userText ?? '',
    );
    return {
      piHarness,
      context,
      directory,
      training,
      observeUsage,
      observers: [observeTools, observeContext, observeUsage],
    };
  }

  async function streamReply(event: IpcMainInvokeEvent, turn: StreamReply) {
    const { sessionId, requestId, voice, requestKind } = turn;
    const practice = requestKind === 'practice_suggestions';
    let streamedText = '';
    let storedTranscription = false;
    const timing = new TutorTurnTiming();
    const settle = (reply: StoredReply) =>
      deps.settle(sessionId, requestId, reply, turn.displayText);
    const reminder = practice
      ? null
      : deps.reminders.start(sessionId, requestId);
    try {
      await turn.run((streamEvent) => {
        turn.observers.forEach((observe) => observe(streamEvent));
        reminder?.update(streamEvent);
        if (
          voice &&
          streamEvent.type === 'transcription' &&
          !storedTranscription
        ) {
          const text = String(streamEvent.text ?? '').trim();
          if (text) {
            storedTranscription = true;
            deps.gateway()?.addMessage(sessionId, 'user', text, undefined, {
              messageKind: 'voice_input',
            });
          }
        }
        if (streamEvent.type === 'text_delta') {
          const delta = String(streamEvent.text ?? '');
          timing.recordTextDelta(delta);
          streamedText += delta;
        }
        if (streamEvent.type === 'done') {
          const text = String(streamEvent.guidance ?? streamedText);
          const metrics = streamEvent.llm_metrics as LLMCallMetrics | undefined;
          settle({
            text,
            tutorMetrics: metrics,
            observerMetrics: streamEvent.observer_metrics as
              | LLMCallMetrics
              | undefined,
          });
          if (!streamEvent.stopped && !practice)
            deps.reminders
              .reply(sessionId, requestId)
              .catch((error) =>
                log.warn('[Chat] Could not show reply reminder:', error),
              );
          deps
            .gateway()
            ?.addMessage(
              sessionId,
              'coco',
              text,
              timing.complete(
                metrics?.model || process.env.TUTOR_MODEL?.trim() || undefined,
              ),
              {
                messageKind: voice
                  ? 'voice_response'
                  : practice
                    ? 'practice_suggestion'
                    : 'user_response',
                fourDDimension: streamEvent.four_d_dimension,
                teachingDepth: streamEvent.teaching_depth,
                interventionSource: 'user',
              },
            );
        }
        if (streamEvent.type === 'error')
          settle({
            text: String(
              streamEvent.error ?? 'The tutor could not generate a response.',
            ),
            isError: true,
          });
        deps.emit(event.sender, {
          requestId,
          sessionId,
          ...streamEvent,
          ...(!voice && streamEvent.type === 'done'
            ? { observerMetrics: streamEvent.observer_metrics ?? null }
            : {}),
        });
      });
      return { streamed: true };
    } catch (err) {
      log.error(
        `[Chat] streaming ${voice ? 'audio' : 'user'} prompt failed:`,
        err instanceof Error ? err.message : String(err),
      );
      let error: string;
      if (voice) {
        error =
          err instanceof TutorStreamTimeoutError
            ? 'The tutor took too long to respond to the voice message. Please retry.'
            : 'The tutor could not process the voice message. Please try again.';
      } else {
        error =
          err instanceof TutorStreamTimeoutError
            ? 'The tutor took too long to respond. Please retry.'
            : err instanceof Error
              ? err.message
              : 'Coco could not complete this request.';
      }
      const metrics = (err as { llm_metrics?: LLMCallMetrics })?.llm_metrics;
      turn.observeUsage({ type: 'error', error, llm_metrics: metrics });
      settle({ text: error, isError: true, tutorMetrics: metrics });
      deps.emit(event.sender, {
        requestId,
        sessionId,
        type: 'error',
        error,
        llm_metrics: metrics,
      });
      return { error };
    } finally {
      reminder?.dispose();
      deps.reminders.clear(requestId);
    }
  }
  const withTutorTurn =
    <
      Payload extends {
        requestId: string;
        sessionId?: string;
        requestKind?: string;
      },
      Result,
    >(
      handler: (event: IpcMainInvokeEvent, payload: Payload) => Promise<Result>,
    ) =>
    (
      event: IpcMainInvokeEvent,
      payload: Payload,
    ): Promise<Result | { error: string }> => {
      const sessionId = payload.sessionId || deps.session().id;
      if (!sessionId)
        return Promise.resolve({ error: 'Open a conversation first.' });
      try {
        deps.runs.begin(
          sessionId,
          payload.requestId,
          payload.requestKind === 'practice_suggestions',
        );
      } catch (error) {
        return Promise.resolve({ error: (error as Error).message });
      }
      deps.activeRequests.add(payload.requestId);
      return deps.interactions
        .trackTurn(() => handler(event, { ...payload, sessionId }))
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : String(error);
          deps.emit(event.sender, {
            sessionId,
            requestId: payload.requestId,
            type: 'error',
            error: message,
          });
          return { error: message };
        })
        .finally(() => {
          deps.streams.finish(payload.requestId);
          deps.activeRequests.delete(payload.requestId);
          deps.runs.finish(payload.requestId);
        });
    };
  async function sendText(
    ipcEvent: IpcMainInvokeEvent,
    {
      requestId,
      sessionId,
      userText,
      displayText,
      isRetry,
      images,
      requestKind,
      hotkeyImages,
      screenContext,
    }: {
      requestId: string;
      sessionId?: string;
      userText: string;
      displayText?: string;
      isRetry?: boolean;
      images?: string[];
      requestKind?: 'chat' | 'practice_suggestions';
      hotkeyImages?: string[];
      /** Observer text the user chose to send along with this message. */
      screenContext?: string;
    },
  ) {
    const gatewaySessionId = sessionId!;
    if (modelTraining.get(gatewaySessionId, deps.user()))
      return { error: 'Use the controls in this quest to continue.' };
    const workflow = workflowTraining.get(gatewaySessionId, deps.user());
    if (workflow && !workflow.savedSkillId) {
      if (!deps.isChatSender(ipcEvent) || !deps.authenticated() || !deps.user())
        return { error: 'Sign in to continue.' };
      if (requestKind === 'practice_suggestions')
        return { error: 'Tell Coco about the skill you want to create.' };
      deps.streams.begin(
        gatewaySessionId,
        requestId,
        displayText ?? userText,
        images ?? [],
        isRetry,
      );
      deps
        .gateway()
        ?.addMessage(gatewaySessionId, 'user', displayText ?? userText);
      return runWorkflowChatTurn(
        ipcEvent,
        gatewaySessionId,
        requestId,
        userText,
        images,
      );
    }
    if (
      requestKind === 'practice_suggestions' &&
      (toolTraining.training(gatewaySessionId, deps.user()) ||
        contextTraining.get(gatewaySessionId, deps.user()) ||
        tokenTraining.get(gatewaySessionId, deps.user()))
    )
      return { error: 'Ask your own question to explore this chapter.' };
    const { piHarness, context, directory, training, observers, observeUsage } =
      prepareTurn(
        gatewaySessionId,
        requestId,
        userText,
        displayText ?? userText,
      );
    deps.streams.begin(
      gatewaySessionId,
      requestId,
      displayText ?? userText,
      images ?? [],
      isRetry,
      gatewaySessionId === deps.session().id ? deps.session().model : undefined,
      screenContext,
    );
    const tutorPort = process.env.TUTOR_PORT || '8081';
    const tutor = `http://127.0.0.1:${tutorPort}`;
    const sessionStartText = (displayText ?? userText).trim();
    if (!deps.allowed())
      return { error: 'AI tutoring is disabled for this account.' };
    if (gatewaySessionId === deps.session().id)
      await deps.resume(displayText ?? userText);
    if (
      gatewaySessionId === deps.session().id &&
      !deps.session().active &&
      shouldStartSessionFromUserMessage(sessionStartText, requestKind ?? 'chat')
    ) {
      // Reuse the draft id already known by the renderer. Suppressing another
      // session-init event prevents the first optimistic message from being
      // cleared while this request is in flight.
      await deps.startSession(gatewaySessionId, sessionStartText);
    }
    if (!isRetry && gatewaySessionId) {
      deps
        .gateway()
        ?.addMessage(gatewaySessionId, 'user', displayText ?? userText);
    }

    const hotkeyImageSet = new Set(hotkeyImages ?? []);
    const hotkeyImageCount = (images ?? []).filter((image) =>
      hotkeyImageSet.has(image),
    ).length;

    const contextualizedUserText = [
      userText,
      ...(hotkeyImageCount > 0
        ? [
            '<hotkey_screenshot_context>',
            `${hotkeyImageCount} attached image${hotkeyImageCount === 1 ? ' was' : 's were'} deliberately captured by the user with Coco's screenshot hotkey.`,
            'Treat the attached hotkey capture as the primary visual state the user chose for this request. Do not call observe_screen merely to capture or inspect the same screen again. Only request a new live-screen observation if the user explicitly asks for an updated view after this capture.',
            '</hotkey_screenshot_context>',
          ]
        : []),
      ...(screenContext?.trim()
        ? [
            '<screen_observation>',
            "What Coco's screen observer recorded before this request. The user did not write it; use it as background only where relevant.",
            screenContext.trim(),
            '</screen_observation>',
          ]
        : []),
    ]
      .filter(Boolean)
      .join('\n');
    return streamReply(ipcEvent, {
      sessionId: gatewaySessionId,
      requestId,
      displayText,
      requestKind,
      observers,
      observeUsage,
      run: async (onEvent) => {
        if (requestKind === 'practice_suggestions') {
          const { scenario, aiTools } = deps.profile();
          await axios.post(
            `${tutor}/config/scenario`,
            { scenario },
            { timeout: 8000 },
          );
          await axios.post(
            `${tutor}/context/ai_tools`,
            { ai_tools: aiTools },
            { timeout: 8000 },
          );
          await consumeTutorStream(
            `${tutor}/events/practice_suggestions/stream`,
            {},
            onEvent,
            undefined,
            { idleMs: 60_000, hardMs: 5 * 60_000 },
          );
        } else if (deps.runs.requests.get(requestId)?.stopped) {
          onEvent({ type: 'done', guidance: 'Stopped.', stopped: true });
        } else {
          await piHarness.run({
            approvalRules: training ? undefined : deps.approvalRules(),
            curatedSkills: training
              ? undefined
              : workflowTraining.runtimeSkills(deps.user()),
            requestId,
            sessionId: gatewaySessionId,
            context,
            training,
            directory,
            tutorUrl: tutor,
            token: deps.token,
            text: contextualizedUserText,
            images: images ?? [],
            emit: onEvent,
          });
        }
      },
    });
  }

  async function sendVoice(
    ipcEvent: IpcMainInvokeEvent,
    {
      requestId,
      sessionId,
      audioData,
    }: {
      requestId: string;
      sessionId?: string;
      audioData: string;
    },
  ) {
    const gatewaySessionId = sessionId!;
    if (modelTraining.get(gatewaySessionId, deps.user()))
      return { error: 'Use the controls in this quest to continue.' };
    const workflow = workflowTraining.get(gatewaySessionId, deps.user());
    if (workflow && !workflow.savedSkillId) {
      if (!deps.isChatSender(ipcEvent) || !deps.authenticated() || !deps.user())
        return { error: 'Sign in to continue.' };
      if (!deps.allowed())
        return { error: 'AI tutoring is disabled for this account.' };
      if (!audioData || audioData.length > 16_000_000)
        return { error: 'The voice recording is empty or too large.' };
      deps.streams.begin(gatewaySessionId, requestId, '[Voice message]');
      const response = await axios.post(
        `http://127.0.0.1:${process.env.TUTOR_PORT || '8081'}/agent/transcribe`,
        { audio_data: audioData },
        {
          headers: {
            Authorization: `Bearer ${deps.token}`,
            'X-Coco-Session': gatewaySessionId,
          },
          timeout: 120000,
        },
      );
      const text = String(response.data.text ?? '').trim();
      deps.emit(ipcEvent.sender, {
        sessionId: gatewaySessionId,
        requestId,
        type: 'transcription',
        text,
      });
      deps.gateway()?.addMessage(gatewaySessionId, 'user', text);
      return runWorkflowChatTurn(ipcEvent, gatewaySessionId, requestId, text);
    }
    const { piHarness, context, directory, training, observers, observeUsage } =
      prepareTurn(gatewaySessionId, requestId);
    deps.streams.begin(
      gatewaySessionId,
      requestId,
      '[Voice message]',
      [],
      false,
      gatewaySessionId === deps.session().id ? deps.session().model : undefined,
    );
    if (!audioData || audioData.length > 16_000_000) {
      return { error: 'The voice recording is empty or too large.' };
    }
    if (!deps.allowed())
      return { error: 'AI tutoring is disabled for this account.' };
    if (gatewaySessionId === deps.session().id) await deps.resume();
    if (gatewaySessionId === deps.session().id && !deps.session().active) {
      // A pre-session invite may already be visible from the last sensing tick.
      // Voice input is itself an explicit session start, so remove that stale UI.
      deps.dismissNotification();
      await deps.startSession(gatewaySessionId, '[Voice message]');
    }
    return streamReply(ipcEvent, {
      sessionId: gatewaySessionId,
      requestId,
      voice: true,
      observers,
      observeUsage,
      run: async (onEvent) => {
        if (deps.runs.requests.get(requestId)?.stopped) {
          onEvent({ type: 'done', guidance: 'Stopped.', stopped: true });
        } else {
          await piHarness.run({
            approvalRules: training ? undefined : deps.approvalRules(),
            curatedSkills: training
              ? undefined
              : workflowTraining.runtimeSkills(deps.user()),
            requestId,
            sessionId: gatewaySessionId,
            context,
            training,
            directory,
            tutorUrl: `http://127.0.0.1:${process.env.TUTOR_PORT || '8081'}`,
            token: deps.token,
            text: '',
            images: [],
            audioData,
            emit: onEvent,
          });
        }
      },
    });
  }

  deps.ipc.removeHandler('send-chat-message');
  deps.ipc.handle('send-chat-message', withTutorTurn(sendText));
  deps.ipc.removeHandler('send-audio-message');
  deps.ipc.handle('send-audio-message', withTutorTurn(sendVoice));
}
