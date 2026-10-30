import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import TrainingDialog from './TrainingDialog';
import './TrainingDialog.css';
import {
  completedModelRound,
  modelQuestPrompts,
  type ModelQuestKind,
  type ModelQuestResponse,
  type ModelQuestSession,
} from '../../../shared/model-training';
import ChatComparisonLayout from '../chat/ChatComparisonLayout';
import { TutorMessage } from '../chat/MessageContent';
import ChatMetrics from '../chat/ChatMetrics';
import ActionTooltip from '../chat/ActionTooltip';
import { S } from '../chat/styles';
import './ModelQuest.css';
import '../chat/TutorModelPicker.css';

function ModelResponse({
  response,
  onSelect,
}: {
  response: ModelQuestResponse;
  onSelect: (() => void) | null;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (response.status !== 'running') return undefined;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [response.status]);
  const html =
    response.status === 'done'
      ? response.text.match(/```html\s*\n([\s\S]*?)```/i)?.[1]
      : undefined;
  const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
  let finishTime =
    response.finishedMs === null ? '—' : seconds(response.finishedMs);
  if (response.status === 'running')
    finishTime = seconds(Math.max(0, now - response.startedAt));
  return (
    <div
      className={`model-quest-response${onSelect ? ' model-quest-selectable' : ''}`}
    >
      {onSelect && (
        <button
          type="button"
          className="model-quest-output-select"
          aria-label={`Choose ${response.model.label} output`}
          onClick={onSelect}
        />
      )}
      <div
        className="model-quest-timing"
        aria-label={`${response.model.label} timing`}
      >
        <span>
          First response:{' '}
          <strong>
            {response.firstResponseMs === null
              ? '—'
              : seconds(response.firstResponseMs)}
          </strong>
        </span>
        <span>
          {response.status === 'running' ? 'Elapsed' : 'Finished'}:{' '}
          <strong>{finishTime}</strong>
        </span>
      </div>
      {response.status === 'running' && (
        <p role="status">
          {response.text ? 'Responding…' : 'Waiting for the first response…'}
        </p>
      )}
      {html ? (
        <iframe
          className="model-quest-preview"
          title={`${response.model.label} drawing`}
          sandbox=""
          referrerPolicy="no-referrer"
          srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">${html}`}
        />
      ) : (
        response.text && <TutorMessage text={response.text} />
      )}
      {response.status !== 'running' && (
        <ChatMetrics tutorMetrics={response.metrics} />
      )}
      {response.error && <p role="alert">{response.error}</p>}
      {['stopped', 'interrupted'].includes(response.status) && (
        <p role="status">
          Comparison {response.status}. Send the prompt to both models again to
          retry.
        </p>
      )}
    </div>
  );
}

export default function ModelQuest({
  session,
  completedAt,
  onNewChat,
}: {
  session: ModelQuestSession;
  completedAt: string | null;
  onNewChat: () => void;
}) {
  const rewriteDone = session.rounds.some(
    (round) => round.kind === 'rewrite' && completedModelRound(round),
  );
  const ideasDone = session.rounds.some(
    (round) => round.kind === 'ideas' && completedModelRound(round),
  );
  const stage: ModelQuestKind = rewriteDone ? 'ideas' : 'rewrite';
  const [kind, setKind] = useState<ModelQuestKind>(
    session.rounds.at(-1)?.kind ?? stage,
  );
  const [ideasVisited, setIdeasVisited] = useState(
    session.rounds.some((item) => item.kind === 'ideas'),
  );
  const [prompt, setPrompt] = useState<string>(modelQuestPrompts[stage]);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const selectionPending = useRef(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [selected, setSelected] = useState(session.selectedModelId ?? null);
  const [error, setError] = useState('');
  const running = session.rounds.some((round) =>
    round.responses.some((response) => response.status === 'running'),
  );
  const busy = running || sending || saving;
  let promptLabel = 'Optional: ask both models a follow-up';
  if (!ideasDone) promptLabel = 'Try drawing with HTML';
  if (!rewriteDone) promptLabel = 'Try a very simple query';
  const round = session.rounds.filter((item) => item.kind === kind).at(-1);
  useEffect(() => {
    setPrompt(
      ideasDone
        ? 'What assumptions could change these recommendations?'
        : modelQuestPrompts[stage],
    );
  }, [stage, ideasDone]);
  const send = async () => {
    setSending(true);
    setError('');
    setKind(stage);
    try {
      await window.electron.ipcRenderer.invoke(
        'model-chapter-run',
        session.sessionId,
        prompt,
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not start the comparison. Please retry.',
      );
    } finally {
      setSending(false);
    }
  };
  const stop = async () => {
    try {
      await window.electron.ipcRenderer.invoke(
        'model-chapter-stop',
        session.sessionId,
      );
    } catch {
      setError('Could not stop the comparison. Please retry.');
    }
  };
  const selectOutput = async (modelId: string) => {
    if (busy || completedAt || selected || selectionPending.current) return;
    selectionPending.current = true;
    setSaving(true);
    setError('');
    try {
      await window.electron.ipcRenderer.invoke(
        'model-chapter-complete',
        session.sessionId,
        modelId,
      );
      setSelected(modelId);
      setShowUnlock(true);
    } catch {
      setError('Could not save your choice. Click an output to try again.');
    } finally {
      selectionPending.current = false;
      setSaving(false);
    }
  };
  return (
    <section
      className="model-quest"
      aria-label="Agent 101 Chapter 4 Model quest"
    >
      {showUnlock &&
        createPortal(
          <TrainingDialog
            open
            title="Chapter 4 passed! 🎉"
            onClose={() => setShowUnlock(false)}
          >
            <p>
              <strong>Model picker unlocked!</strong> You can now choose the
              model for each conversation.
            </p>
            <figure className="model-quest-picker-preview">
              <figcaption>Try the model picker</figcaption>
              <div className="tutor-model-picker">
                <select
                  aria-label="Model picker preview"
                  defaultValue={selected ?? session.models[0]?.id}
                >
                  {session.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>
              <p>
                Find this picker in the chat input when you start a new
                conversation.
              </p>
            </figure>
            <button
              className="model-quest-unlock-action"
              type="button"
              onClick={() => {
                setShowUnlock(false);
                onNewChat();
              }}
            >
              Try the model picker in a new chat
            </button>
          </TrainingDialog>,
          document.body,
        )}
      <div className="model-quest-content">
        <header>
          <h2>Chapter 4 · Models</h2>
          <p>
            Model providers often release models in different sizes. Here, we’ll
            use models from OpenAI as an example to compare speed and ideas.
            Both models receive the same prompt and instructions in a fresh
            conversation.
          </p>
        </header>
        <div
          className="model-quest-steps"
          role="group"
          aria-label="Comparison rounds"
        >
          <button
            type="button"
            aria-pressed={kind === 'rewrite'}
            onClick={() => setKind('rewrite')}
          >
            1. Simple rewrite {rewriteDone && '✓'}
          </button>
          <button
            type="button"
            disabled={!rewriteDone}
            aria-pressed={kind === 'ideas'}
            className={
              rewriteDone && !ideasVisited && kind === 'rewrite'
                ? 'model-quest-next-step'
                : undefined
            }
            onClick={() => {
              setKind('ideas');
              setIdeasVisited(true);
            }}
          >
            2. Compare ideas {ideasDone && '✓'}
          </button>
        </div>
        <p>
          {kind === 'rewrite'
            ? 'Is either answer good enough? Was the extra wait useful?'
            : 'Which drawing do you like more? Click an output to choose it and finish the quest.'}
        </p>
        {round && (
          <details className="model-quest-prompt-details">
            <summary>View prompt</summary>
            <blockquote className="model-quest-prompt">
              {round.prompt}
            </blockquote>
          </details>
        )}
        <ChatComparisonLayout
          panes={session.models.map((model, index) => ({
            id: model.id,
            title: model.label,
            content: round?.responses[index] ? (
              <ModelResponse
                response={round.responses[index]}
                onSelect={
                  kind === 'ideas' &&
                  rewriteDone &&
                  completedModelRound(round) &&
                  !completedAt &&
                  !selected &&
                  !busy
                    ? () => {
                        selectOutput(model.id);
                      }
                    : null
                }
              />
            ) : (
              <p className="model-quest-empty">
                Send the prompt below to compare responses.
              </p>
            ),
          }))}
        />
        {completedAt && (
          <div className="model-quest-unlocked" role="status">
            <strong>Model picker unlocked!</strong>
            <p>You can now choose the model for each conversation.</p>
            <button type="button" onClick={onNewChat}>
              Try the model picker in a new chat
            </button>
          </div>
        )}
      </div>
      {!completedAt && !ideasDone && (
        <form
          className="model-quest-composer"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <label htmlFor="model-quest-prompt">{promptLabel}</label>
          <textarea
            id="model-quest-prompt"
            value={prompt}
            maxLength={12000}
            disabled={busy}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <div>
            <ActionTooltip label={running ? 'Stop generating' : 'Send message'}>
              <button
                type={running ? 'button' : 'submit'}
                aria-label={running ? 'Stop' : 'Send'}
                style={{
                  ...S.sendBtn,
                  ...(!running && (busy || !prompt.trim())
                    ? S.sendBtnDisabled
                    : {}),
                }}
                disabled={!running && (busy || !prompt.trim())}
                onClick={running ? stop : undefined}
              >
                {running ? (
                  <svg
                    aria-hidden="true"
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <rect x="4" y="4" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg
                    aria-hidden="true"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                )}
              </button>
            </ActionTooltip>
          </div>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
