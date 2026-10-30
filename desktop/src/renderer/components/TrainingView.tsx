/* eslint react/require-default-props: ["error", { "functions": "defaultArguments" }] */
import { useCallback, useEffect, useState } from 'react';
import useTokenChapter from './training/useTokenChapter';
import useModelChapter from './training/useModelChapter';
import type { StudyState } from '../../shared/study';
import PreAssessmentPanel from './PreAssessmentPanel';
import FollowUpAssessmentPanel from './FollowUpAssessmentPanel';
import PostAssessmentPanel from './PostAssessmentPanel';
import DailyReflectionForm from './training/DailyReflectionForm';
import TrainingDialog from './training/TrainingDialog';
import TrainingAnnouncement from './training/TrainingAnnouncement';
import TrainingTaskDetail from './training/TrainingTaskDetail';
import TrainingProgress from './training/TrainingProgress';
import ToolChapter from './training/ToolChapter';
import ContextChapter from './training/ContextChapter';
import TokenChapter from './training/TokenChapter';
import ModelChapter from './training/ModelChapter';
import AgenticQuest, { agentLevels } from './training/AgenticQuest';
import { api } from './training/training-api';
import useTrainingState from './training/useTrainingState';
import useToolChapterProgress from './training/useToolChapterProgress';
import useContextChapterProgress from './training/useContextChapterProgress';
import './TrainingView.css';

export default function TrainingView({
  visible = true,
  refreshKey = 0,
}: {
  visible?: boolean;
  refreshKey?: number;
}) {
  const { state, studentMode, error, setError, refresh } = useTrainingState(
    visible,
    refreshKey,
  );
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const followUp = state?.follow_up_assessment;
  useEffect(() => {
    if (!followUp?.unlocks_at) return undefined;
    const receivedAt = Date.now();
    const remaining =
      Date.parse(followUp.unlocks_at) - Date.parse(followUp.server_now);
    const tick = () =>
      setCountdownSeconds(
        Math.max(0, Math.ceil((remaining - (Date.now() - receivedAt)) / 1000)),
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [followUp]);
  const countdown = `${Math.floor(countdownSeconds / 86400)}d ${Math.floor((countdownSeconds % 86400) / 3600)}h ${Math.floor((countdownSeconds % 3600) / 60)}m ${countdownSeconds % 60}s`;
  const [notice, setNotice] = useState('');
  const [questOpen, setQuestOpen] = useState(false);
  const [startingToolChat, setStartingToolChat] = useState(false);
  const [toolChatError, setToolChatError] = useState('');
  const [questLevel, setQuestLevel] = useState(0);
  const toolProgress = useToolChapterProgress();
  const contextProgress = useContextChapterProgress();
  const tokenProgress = useTokenChapter();
  const modelProgress = useModelChapter();
  const questComplete = Boolean(
    [
      toolProgress.completedAt,
      contextProgress.completedAt,
      tokenProgress.completedAt,
      modelProgress.completedAt,
    ][questLevel],
  );
  let questActionLabel = 'Start quest';
  if (questLevel > 3) questActionLabel = 'Quest coming soon';
  if (startingToolChat) questActionLabel = 'Opening quest…';
  if (questComplete) questActionLabel = 'Completed ✓';
  const [busy, setBusy] = useState(false);
  const [preAssessmentComplete, setPreAssessmentComplete] = useState(false);
  const [active, setActive] = useState<
    'pre' | 'post' | 'follow-up' | number | null
  >(null);
  const [reflectionDayNumber, setReflectionDayNumber] = useState<number | null>(
    null,
  );
  const handlePreAssessmentCompletion = useCallback((complete: boolean) => {
    setPreAssessmentComplete(complete);
  }, []);
  const act = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      setError('');
      setNotice('');
      try {
        await action();
        await refresh();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        setBusy(false);
      }
    },
    [refresh, setError],
  );
  const studentExperience = state?.role === 'participant' || studentMode;
  const adminMode =
    (state?.role === 'admin' || state?.role === 'super_admin') && !studentMode;
  const followUpUnlocked =
    adminMode ||
    Boolean(
      followUp?.unlocked &&
        followUp.unlocks_at &&
        Date.parse(followUp.unlocks_at) <= Date.parse(followUp.server_now),
    );
  const trainingUnlocked = !studentExperience || preAssessmentComplete;
  const trainingComplete = Boolean(
    state?.days.length === 7 && state.days.every((day) => day.completed_at),
  );
  const postAssessmentUnlocked = adminMode || trainingComplete;
  const orderedDays = [...(state?.days ?? [])].sort((a, b) => a.day - b.day);
  const nextDay = orderedDays.find((day) => !day.completed_at);
  const selectedDay = state?.days.find((day) => day.day === active);
  const reflectionDay = state?.days.find(
    (day) => day.day === reflectionDayNumber,
  );
  const dayCanOpen = (day: StudyState['days'][number]) =>
    Boolean(day.completed_at) ||
    (trainingUnlocked &&
      day.available &&
      (day.unlocked || (!state?.started_at && day.day === 1)));
  useEffect(() => {
    if (
      typeof active === 'number' &&
      (!selectedDay ||
        (!selectedDay.completed_at &&
          (!trainingUnlocked ||
            !selectedDay.available ||
            (!selectedDay.unlocked &&
              (state?.started_at || selectedDay.day !== 1)))))
    ) {
      setActive(null);
      setReflectionDayNumber(null);
    }
    if (active === 'follow-up' && !followUpUnlocked) setActive(null);
    if (active === 'post' && !postAssessmentUnlocked) setActive(null);
  }, [
    active,
    selectedDay,
    trainingUnlocked,
    state?.started_at,
    postAssessmentUnlocked,
    followUpUnlocked,
  ]);
  return (
    <main className="training-page">
      <div
        className="training-home"
        inert={active !== null || reflectionDayNumber !== null || questOpen}
      >
        <AgenticQuest
          adminMode={adminMode}
          onOpen={(level) => {
            setQuestLevel(level);
            setToolChatError('');
            setQuestOpen(true);
          }}
        />
        <section
          className="training-main-challenge"
          aria-labelledby="training-challenge-title"
        >
          <header className="training-header">
            <div className="training-header-topline">
              <h1 id="training-challenge-title">AI Literacy Challenge</h1>
              {state && <TrainingAnnouncement />}
            </div>
            <p>
              Build your skills, one day at a time. Learn to work thoughtfully
              with AI.
            </p>
          </header>
          {state && (
            <TrainingProgress
              steps={[
                {
                  id: 'pre',
                  label: 'Start check-in',
                  accessibleLabel: 'Start check-in',
                  complete: preAssessmentComplete,
                  available: true,
                  onClick: () => setActive('pre'),
                },
                ...Array.from({ length: 7 }, (_, index) => {
                  const day = orderedDays.find(
                    (item) => item.day === index + 1,
                  );
                  return {
                    id: `day-${index + 1}`,
                    label: `${index + 1}`,
                    accessibleLabel: `Day ${index + 1} Practice task`,
                    complete: Boolean(day?.completed_at),
                    available: Boolean(
                      day &&
                        dayCanOpen(day) &&
                        (adminMode ||
                          day.completed_at ||
                          day.day === nextDay?.day),
                    ),
                    onClick: () => setActive(index + 1),
                  };
                }),
                {
                  id: 'post',
                  label: 'Final check-in',
                  accessibleLabel: 'Final check-in',
                  complete: Boolean(state.post_assessment_complete),
                  available: postAssessmentUnlocked,
                  onClick: () => setActive('post'),
                },
                {
                  id: 'follow-up',
                  label: 'Follow-up',
                  accessibleLabel: followUpUnlocked
                    ? 'Follow-up'
                    : `Follow-up${followUp?.unlocks_at ? ` — unlocks in ${countdown}` : ' — unlocks after final check-in'}`,
                  complete: Boolean(followUp?.complete),
                  available:
                    followUpUnlocked &&
                    (adminMode || Boolean(followUp?.visible)),
                  onClick: () => setActive('follow-up'),
                },
              ]}
            />
          )}
          <div className="training-challenge-details">
            <details className="training-about">
              <summary>How it works</summary>
              <p>
                During the three-week AI Literacy Camp, you’ll try a new AI
                collaboration task each day in the first week. Start and final
                check-ins, followed by a follow-up 14 days after your final
                check-in, help you see how your skills grow.
              </p>
            </details>
          </div>
          {error && (
            <div role="alert" className="training-error">
              {/fetch failed|network|timed? ?out|abort/i.test(error)
                ? 'Unable to connect to the study server. Please check your connection and retry.'
                : error}
              <button type="button" onClick={() => act(refresh)}>
                Retry
              </button>
            </div>
          )}
          {notice && (
            <p role="status" className="training-notice">
              {notice}
            </p>
          )}
          {!state ? (
            <p>
              {error
                ? 'Training could not be loaded.'
                : 'Loading your training…'}
            </p>
          ) : (
            <>
              {state.role !== 'participant' && (
                <div className="training-toolbar">
                  <button
                    type="button"
                    aria-pressed={studentMode}
                    disabled={busy}
                    onClick={() =>
                      act(() => api('study-student-mode', !studentMode))
                    }
                  >
                    {studentMode ? 'Exit student mode' : 'Student mode'}
                  </button>
                </div>
              )}
              {!state.tutoring_allowed && (
                <p className="training-info">
                  AI tutoring is disabled for your account. Your available
                  check-ins and tasks are still accessible.
                </p>
              )}
            </>
          )}
        </section>
      </div>
      <TrainingDialog
        open={questOpen}
        title={`Chapter ${questLevel + 1} · ${agentLevels[questLevel].name}`}
        onClose={() => setQuestOpen(false)}
        busy={startingToolChat}
        headerAction={
          <button
            type="button"
            className="training-primary agentic-chapter-action"
            disabled={startingToolChat || questComplete || questLevel > 3}
            onClick={async () => {
              if (questComplete || questLevel > 3 || startingToolChat) return;
              setStartingToolChat(true);
              setToolChatError('');
              try {
                const channels = [
                  'tool-chapter-start',
                  'context-chapter-start',
                  'token-chapter-start',
                  'model-chapter-start',
                ] as const;
                await api(channels[questLevel]);
                setQuestOpen(false);
              } catch (reason) {
                setToolChatError(
                  reason instanceof Error ? reason.message : String(reason),
                );
              } finally {
                setStartingToolChat(false);
              }
            }}
          >
            {questActionLabel}
          </button>
        }
      >
        <div className={questLevel <= 3 ? undefined : 'agentic-quest-preview'}>
          {questLevel > 3 && (
            <span className="training-eyebrow">AGENT 101</span>
          )}
          {questLevel === 0 && <ToolChapter />}
          {questLevel === 1 && <ContextChapter />}
          {questLevel === 2 && <TokenChapter />}
          {questLevel === 3 && <ModelChapter />}
          {questLevel > 3 && (
            <>
              <h3>{agentLevels[questLevel].name}</h3>
              <p>{agentLevels[questLevel].summary}</p>
              {agentLevels[questLevel].reward && (
                <div className="agentic-quest-reward">
                  <strong>
                    Your chapter reward · {agentLevels[questLevel].reward}
                  </strong>
                  <p>{agentLevels[questLevel].detail}</p>
                </div>
              )}
            </>
          )}
          {questLevel > 3 && (
            <p className="training-info">
              Lesson preview. Chapter completion and feature unlocks are coming
              next.
            </p>
          )}
          {toolChatError && (
            <p role="alert" className="training-error">
              {toolChatError}
            </p>
          )}
        </div>
      </TrainingDialog>
      {state && (
        <>
          <TrainingDialog
            open={active === 'pre'}
            title="Start check-in"
            onClose={() => setActive(null)}
          >
            <PreAssessmentPanel
              required={studentExperience}
              onCompletionChange={handlePreAssessmentCompletion}
            />
          </TrainingDialog>
          <TrainingDialog
            open={active === 'post'}
            title="Final check-in"
            onClose={() => setActive(null)}
          >
            <PostAssessmentPanel
              unlocked={postAssessmentUnlocked}
              onSubmitted={refresh}
            />
          </TrainingDialog>
          {followUpUnlocked && (
            <TrainingDialog
              open={active === 'follow-up'}
              title="Follow-up"
              onClose={() => setActive(null)}
            >
              <FollowUpAssessmentPanel onSubmitted={refresh} />
            </TrainingDialog>
          )}
          {selectedDay && dayCanOpen(selectedDay) && (
            <TrainingDialog
              open={reflectionDayNumber === null}
              title={`Day ${selectedDay.day} Practice task`}
              onClose={() => setActive(null)}
              busy={busy}
            >
              {!state.started_at && !selectedDay.completed_at ? (
                <section>
                  <p>
                    Your practice days will use{' '}
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}. This
                    cannot be changed after starting.
                  </p>
                  <button
                    className="training-primary"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      act(() =>
                        api(
                          'study-start',
                          Intl.DateTimeFormat().resolvedOptions().timeZone,
                        ),
                      )
                    }
                  >
                    Start Day 1
                  </button>
                </section>
              ) : (
                <TrainingTaskDetail
                  day={selectedDay}
                  busy={busy}
                  onReflect={() => setReflectionDayNumber(selectedDay.day)}
                />
              )}
              {error && (
                <p role="alert" className="training-error">
                  {error}
                </p>
              )}
            </TrainingDialog>
          )}
          {reflectionDay &&
            !reflectionDay.completed_at &&
            dayCanOpen(reflectionDay) && (
              <DailyReflectionForm
                day={reflectionDay.day}
                busy={busy}
                error={error}
                onClose={() => setReflectionDayNumber(null)}
                onSubmit={async (answers) => {
                  let completed = false;
                  await act(async () => {
                    const result = (await api(
                      'study-complete',
                      reflectionDay.day,
                      state.user_id,
                      answers,
                    )) as { canceled?: boolean };
                    if (!result.canceled) {
                      completed = true;
                      setNotice(
                        `Day ${reflectionDay.day} complete — reflection and screenshot saved locally.`,
                      );
                    }
                  });
                  if (completed) {
                    setReflectionDayNumber(null);
                    setActive(null);
                  }
                }}
              />
            )}
        </>
      )}
    </main>
  );
}
