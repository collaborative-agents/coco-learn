import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import type { LLMCallMetrics } from '../../renderer/components/observation-types';
import {
  tokenCounts,
  type TokenUsageRecord,
  type TokenTrainingSession,
} from '../../shared/token-training';
import { ContextChapterStore } from './context-training';
import type { TutorStreamEvent } from './tutor-stream';

interface TokenData {
  completedAt: string | null;
  sessions: string[];
  requests: TokenUsageRecord[];
  trackingSince: string;
}

export class TokenStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  private file(user: string) {
    return path.join(
      this.root,
      `${createHash('sha256').update(user).digest('hex')}.json`,
    );
  }

  read(user: string): TokenData {
    try {
      const data = JSON.parse(fs.readFileSync(this.file(user), 'utf8'));
      if (
        !Array.isArray(data.sessions) ||
        !Array.isArray(data.requests) ||
        typeof data.trackingSince !== 'string'
      )
        throw new Error('Invalid token tracking data.');
      return data;
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT')
        return {
          completedAt: null,
          sessions: [],
          requests: [],
          trackingSince: new Date().toISOString(),
        };
      throw new Error('Could not read token tracking data.');
    }
  }

  save(user: string, data: TokenData) {
    fs.mkdirSync(this.root, { recursive: true });
    fs.writeFileSync(`${this.file(user)}.tmp`, JSON.stringify(data));
    fs.renameSync(`${this.file(user)}.tmp`, this.file(user));
  }
}

export default function registerTokenTraining(options: {
  ipc: IpcMain;
  root: () => string;
  user: (event: IpcMainInvokeEvent, run?: boolean) => string;
  currentUser: () => string | null;
  canSkipPrerequisites?: () => boolean;
  changed: () => void;
  createConversation: (session: TokenTrainingSession) => void;
  openConversation: (session: TokenTrainingSession) => void;
}) {
  const store = () =>
    new TokenStore(path.join(options.root(), 'token-chapter'));
  const get = (
    id: string,
    user: string | null,
  ): TokenTrainingSession | null => {
    if (!user || typeof id !== 'string') return null;
    const data = store().read(user);
    if (!data.sessions.includes(id)) return null;
    return {
      user,
      sessionId: id,
      requests: data.requests
        .filter(
          (request) =>
            request.sessionId === id &&
            request.successful &&
            request.input !== null &&
            request.output !== null,
        )
        .slice(0, 2),
    };
  };
  options.ipc.handle('token-chapter-progress', (event) => ({
    completedAt: store().read(options.user(event)).completedAt,
  }));
  options.ipc.handle('token-chapter-session', (event, id: string) =>
    get(id, options.user(event)),
  );
  options.ipc.handle('token-chapter-start', (event) => {
    const user = options.user(event, true);
    if (
      !options.canSkipPrerequisites?.() &&
      !new ContextChapterStore(
        path.join(options.root(), 'context-chapter'),
      ).read(user).completedAt
    )
      throw new Error('Complete Chapter 2 · Context first.');
    const data = store().read(user);
    const session = data.sessions
      .map((id) => get(id, user))
      .find((value) => value !== null) ?? {
      user,
      sessionId: randomUUID(),
      requests: [],
    };
    if (!data.sessions.includes(session.sessionId)) {
      data.sessions.push(session.sessionId);
      store().save(user, data);
      options.createConversation(session);
    }
    options.openConversation(session);
    return session;
  });
  options.ipc.handle(
    'token-chapter-answer',
    (event, id: string, answer: string) => {
      const user = options.user(event);
      const session = get(id, user);
      if (!session || session.requests.length < 2)
        throw new Error(
          'Send two requests and compare their token usage first.',
        );
      if (answer !== 'context') return { correct: false };
      const data = store().read(user);
      data.completedAt ??= new Date().toISOString();
      store().save(user, data);
      options.changed();
      return { correct: true };
    },
  );
  options.ipc.handle('token-usage', (event) => {
    const data = store().read(options.user(event));
    if (!data.completedAt)
      throw new Error('Complete Chapter 3 · Token to unlock tracking.');
    return { requests: data.requests, trackingSince: data.trackingSince };
  });
  const observe =
    (id: string, requestId: string, user: string | null) =>
    (event: TutorStreamEvent) => {
      if (
        !user ||
        options.currentUser() !== user ||
        (event.type !== 'done' && event.type !== 'error')
      )
        return;
      try {
        const data = store().read(user);
        if (data.requests.some((request) => request.requestId === requestId))
          return;
        const metrics = event.llm_metrics as LLMCallMetrics | undefined;
        const observer = event.observer_metrics as LLMCallMetrics | undefined;
        data.requests.push({
          requestId,
          sessionId: id,
          at: new Date().toISOString(),
          model: metrics?.model ?? 'Unknown model',
          ...tokenCounts(metrics, observer),
          models: [metrics, observer]
            .filter((value): value is LLMCallMetrics => Boolean(value))
            .map((value) => ({
              model: value.model ?? 'Unknown model',
              ...tokenCounts(value),
            })),
          successful:
            event.type === 'done' &&
            !event.stopped &&
            metrics?.success !== false &&
            Boolean(String(event.guidance ?? '').trim()),
        });
        store().save(user, data);
        options.changed();
      } catch (error) {
        // A disk failure must not break a model response, but should remain diagnosable.
        log.warn('Could not save token usage:', error);
      }
    };
  const training = (id: string, user: string | null) =>
    get(id, user)
      ? {
          tools: 'none' as const,
          persist: true,
          instructions:
            'You are Coco helping a learner compare token usage in Chapter 3. Answer their question directly. For the initial sky question, use one sentence. When asked for more detail, give a short paragraph of about 100 words. Do not invent token counts or claim chapter completion; the app measures usage and checks understanding. Follow the user’s request without adding a quiz to your answer.',
        }
      : undefined;
  return { get, observe, training };
}
