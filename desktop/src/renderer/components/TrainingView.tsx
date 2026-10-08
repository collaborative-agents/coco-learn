import React, { useCallback, useEffect, useState } from 'react';
import trainingAnimation from '../../../assets/training.gif';
import {
  DAILY_REFLECTION_OPEN_QUESTIONS,
  DAILY_REFLECTION_RATING_QUESTIONS,
  type DailyReflection,
  type StudyState,
  type TrainingDay,
} from '../../shared/study';
import PreAssessmentPanel from './PreAssessmentPanel';
import PostAssessmentPanel from './PostAssessmentPanel';
import './TrainingView.css';

const api = (
  channel: Parameters<typeof window.electron.ipcRenderer.invoke>[0],
  ...args: unknown[]
) => window.electron.ipcRenderer.invoke(channel, ...args);
const format = (value: string | null) =>
  value ? new Date(value).toLocaleString('en-US') : '—';

type JourneyLevelState = 'done' | 'current' | 'available' | 'locked';

function levelStateFor(
  day: TrainingDay,
  isCurrent: boolean,
): JourneyLevelState {
  if (day.completed_at) return 'done';
  if (isCurrent) return 'current';
  if (day.unlocked) return 'available';
  return 'locked';
}

function journeyLevelLabel(state: JourneyLevelState): string {
  if (state === 'done') return 'Complete';
  if (state === 'current') return 'Current';
  if (state === 'available') return 'Ready';
  return 'Locked';
}

function taskLevelLabel(state: JourneyLevelState): string {
  if (state === 'done') return '✓ Complete';
  if (state === 'current') return 'Current quest';
  return journeyLevelLabel(state);
}

function JourneyMarker({
  state,
  day,
}: {
  state: JourneyLevelState;
  day: number;
}) {
  if (state === 'done') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="m6.5 12.5 3.4 3.4 7.6-8" />
      </svg>
    );
  }
  if (state === 'locked') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="6" y="10" width="12" height="10" rx="2" />
        <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
      </svg>
    );
  }
  return <span aria-hidden>{day}</span>;
}

const emptyReflection = (): DailyReflection => ({
  q1: 0,
  q2: 0,
  q3: 0,
  q4: 0,
  q5: 0,
  q6: '',
  q7: '',
  q8: '',
});

function DailyReflectionForm({
  day,
  busy,
  onClose,
  onSubmit,
}: {
  day: number;
  busy: boolean;
  onClose: () => void;
  onSubmit: (answers: DailyReflection) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<DailyReflection>(emptyReflection);
  const ratingKeys = ['q1', 'q2', 'q3', 'q4', 'q5'] as const;
  const responseKeys = ['q6', 'q7', 'q8'] as const;
  const ready =
    ratingKeys.every((key) => answers[key] >= 1 && answers[key] <= 5) &&
    responseKeys.every((key) => answers[key].trim().length > 0);

  return (
    <div className="training-reflection-page">
      <section
        className="training-reflection"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`day-${day}-reflection-title`}
      >
        <div className="training-reflection-header">
          <div>
            <span className="training-eyebrow">LEVEL {day} REFLECTION</span>
            <h3 id={`day-${day}-reflection-title`}>
              Tell us about your practice
            </h3>
            <p>
              There are no right or wrong answers. Your honest feedback helps us
              improve the camp.
            </p>
          </div>
          <button
            type="button"
            className="training-reflection-close"
            aria-label="Close reflection"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="training-reflection-ratings">
          {DAILY_REFLECTION_RATING_QUESTIONS.map((question, questionIndex) => {
            const key = ratingKeys[questionIndex];
            return (
              <fieldset key={key}>
                <legend>
                  {questionIndex + 1}. {question}
                </legend>
                <div className="training-rating-scale">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <label key={rating} htmlFor={`day-${day}-${key}-${rating}`}>
                      <input
                        id={`day-${day}-${key}-${rating}`}
                        type="radio"
                        name={`day-${day}-${key}`}
                        value={rating}
                        checked={answers[key] === rating}
                        disabled={busy}
                        onChange={() =>
                          setAnswers((current) => ({
                            ...current,
                            [key]: rating,
                          }))
                        }
                      />
                      <span>{rating}</span>
                    </label>
                  ))}
                </div>
                <div className="training-rating-labels" aria-hidden>
                  <span>Strongly disagree</span>
                  <span>Strongly agree</span>
                </div>
              </fieldset>
            );
          })}
        </div>

        <div className="training-reflection-writing">
          {DAILY_REFLECTION_OPEN_QUESTIONS.map((question, questionIndex) => {
            const key = responseKeys[questionIndex];
            return (
              <label key={key} htmlFor={`day-${day}-${key}`}>
                <strong>
                  {questionIndex + 6}. {question}
                </strong>
                <textarea
                  id={`day-${day}-${key}`}
                  rows={4}
                  maxLength={5000}
                  value={answers[key]}
                  disabled={busy}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                />
              </label>
            );
          })}
        </div>

        <div className="training-reflection-submit">
          <div>
            <strong>One last step</strong>
            <span>
              After submitting your reflection, choose a screenshot of your
              favorite moment.
            </span>
          </div>
          <button
            type="button"
            className="training-proof-action"
            disabled={busy || !ready}
            onClick={() => void onSubmit(answers)}
          >
            Submit reflection &amp; add screenshot
          </button>
        </div>
      </section>
    </div>
  );
}

function TrainingJourney({ state }: { state: StudyState }) {
  const totalLevels = state.days.length;
  const completedCount = state.days.filter((day) => day.completed_at).length;
  const journeyComplete = totalLevels > 0 && completedCount === totalLevels;
  const firstIncompleteIndex = state.days.findIndex((day) => !day.completed_at);
  const currentIndex = journeyComplete
    ? Math.max(0, totalLevels - 1)
    : Math.max(0, firstIncompleteIndex);
  const currentDay = state.days[currentIndex];
  const completionPercent = totalLevels
    ? Math.round((completedCount / totalLevels) * 100)
    : 0;
  let railPercent = 0;
  if (journeyComplete) railPercent = 100;
  else if (totalLevels > 1)
    railPercent = (currentIndex / (totalLevels - 1)) * 100;
  const avatarPosition = totalLevels
    ? ((currentIndex + 0.5) / totalLevels) * 100
    : 50;

  let journeyMessage = 'Start Level 1 to begin your journey.';
  if (journeyComplete) {
    journeyMessage =
      'You completed every level. Your full journey is unlocked.';
  } else if (state.started_at && currentDay) {
    if (!currentDay.available) {
      journeyMessage = `Level ${currentDay.day} materials are being prepared.`;
    } else if (currentDay.unlocked) {
      journeyMessage = `Level ${currentDay.day} is ready: ${currentDay.title}`;
    } else if (currentDay.unlocks_at) {
      journeyMessage = `Level ${currentDay.day} opens ${format(currentDay.unlocks_at)}.`;
    } else {
      journeyMessage = `Complete the previous level to unlock Level ${currentDay.day}.`;
    }
  }

  return (
    <section
      className={`training-journey${journeyComplete ? ' training-journey--complete' : ''}`}
      aria-labelledby="training-journey-title"
    >
      <div className="training-journey-header">
        <div>
          <span className="training-eyebrow">YOUR TRAINING JOURNEY</span>
          <h2 id="training-journey-title">
            {journeyComplete
              ? 'All levels complete!'
              : `Level ${currentDay?.day ?? 1} of ${totalLevels}`}
          </h2>
          <p>{journeyMessage}</p>
        </div>
        <div
          className="training-rewards"
          aria-label={`${completedCount * 100} experience points`}
        >
          <span className="training-rewards-icon" aria-hidden>
            ✦
          </span>
          <strong>{completedCount * 100} XP</strong>
          <small>
            {completedCount} of {totalLevels} complete
            {state.timezone && ` · ${state.timezone}`}
          </small>
        </div>
      </div>

      <div className="training-journey-map">
        <div
          className="training-runner"
          style={{ left: `${avatarPosition}%` }}
          aria-hidden
        >
          <img src={trainingAnimation} alt="" draggable={false} />
        </div>
        <div
          className="training-journey-rail"
          role="progressbar"
          aria-label="Training journey progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completionPercent}
        >
          <span style={{ width: `${railPercent}%` }} />
        </div>
        <ol className="training-levels">
          {state.days.map((day, index) => {
            const levelState = levelStateFor(day, index === currentIndex);
            return (
              <li
                key={day.day}
                className={`training-level training-level--${levelState}`}
                aria-label={`Level ${day.day}: ${levelState}`}
              >
                <span className="training-level-marker">
                  <JourneyMarker state={levelState} day={day.day} />
                </span>
                <strong>Level {day.day}</strong>
                <small>{journeyLevelLabel(levelState)}</small>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

export default function TrainingView() {
  const [state, setState] = useState<StudyState | null>(null);
  const [users, setUsers] = useState<StudyState[]>([]);
  const [after, setAfter] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'tasks' | 'admin'>('tasks');
  const [target, setTarget] = useState('');
  const [uploadDay, setUploadDay] = useState(1);
  const [title, setTitle] = useState('');
  const [preAssessmentComplete, setPreAssessmentComplete] = useState(false);
  const [studentMode, setStudentMode] = useState(false);
  const [reflectionDayNumber, setReflectionDayNumber] = useState<number | null>(
    null,
  );
  const handlePreAssessmentCompletion = useCallback((complete: boolean) => {
    setPreAssessmentComplete(complete);
  }, []);
  const currentTrainingDay = state?.days.find((day) => !day.completed_at);
  const refresh = useCallback(async () => {
    const [data, mode] = (await Promise.all([
      api('study-me'),
      api('study-student-mode'),
    ])) as [StudyState, { enabled?: boolean }];
    setState(data);
    setStudentMode(mode?.enabled === true);
    setError('');
    if (data.role === 'participant' || mode?.enabled === true) {
      setTab('tasks');
      setUsers([]);
    }
  }, []);
  const loadUsers = async (cursor = '') => {
    const data = (await api('study-admin-users', cursor)) as {
      users: StudyState[];
      next_after: string | null;
    };
    setUsers((old) => (cursor ? [...old, ...data.users] : data.users));
    setAfter(data.next_after);
  };
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const update = () => {
      refresh().catch((e) => setError(String(e)));
    };
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, [refresh]);
  const studentExperience = state?.role === 'participant' || studentMode;
  const trainingUnlocked = !studentExperience || preAssessmentComplete;
  const trainingComplete = Boolean(
    state?.days.length === 7 && state.days.every((day) => day.completed_at),
  );
  const postAssessmentUnlocked = !studentExperience || trainingComplete;
  const reflectionDay = state?.days.find(
    (day) => day.day === reflectionDayNumber,
  );
  return (
    <main className="training-page">
      <header className="training-header">
        <span className="training-eyebrow">COCO LEARN</span>
        <h1>Your seven-day practice</h1>
        <p>
          Build your AI fluency through one focused challenge each day. Try to
          work with AI together to complete today’s level to strengthen your AI
          literacy and unlock the next step in your journey.
        </p>
      </header>
      <aside
        className="training-awards-banner"
        aria-labelledby="training-awards-title"
      >
        <span className="training-awards-icon" aria-hidden>
          <svg viewBox="0 0 24 24">
            <path d="M8 4h8v4.5a4 4 0 0 1-8 0V4Z" />
            <path d="M8 6H4v1.5A4.5 4.5 0 0 0 8.5 12M16 6h4v1.5a4.5 4.5 0 0 1-4.5 4.5M12 12.5V17M8.5 20h7M10 17h4" />
          </svg>
        </span>
        <div>
          <h2 id="training-awards-title">Camp awards</h2>
          <p>
            Finish all seven daily tasks and complete both the pre- and
            post-assessments to qualify. Three eligible participants will each
            receive a $50 cash award: Most Active Participant, Most Improved
            Participant, and Top Performer.
          </p>
        </div>
      </aside>
      {error && (
        <div role="alert" className="training-error">
          {/fetch failed|network|timed? ?out|abort/i.test(error)
            ? 'Unable to connect to the study server. Please check your connection and retry.'
            : error}
          <button type="button" onClick={() => void act(refresh)}>
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
          {error ? 'Training could not be loaded.' : 'Loading your training…'}
        </p>
      ) : (
        <>
          <div className="training-toolbar">
            <span>
              {state.user_id} ·{' '}
              {studentMode ? 'student mode' : state.role.replace('_', ' ')}
            </span>
            <button
              type="button"
              aria-pressed={tab === 'tasks'}
              onClick={() => setTab('tasks')}
            >
              My tasks
            </button>
            {state.role !== 'participant' && (
              <button
                type="button"
                aria-pressed={studentMode}
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await api('study-student-mode', !studentMode);
                    setTab('tasks');
                  })
                }
              >
                {studentMode ? 'Exit student mode' : 'Student mode'}
              </button>
            )}
            {state.role !== 'participant' && !studentMode && (
              <button
                type="button"
                aria-pressed={tab === 'admin'}
                disabled={busy}
                onClick={() => {
                  setTab('admin');
                  void act(() => loadUsers());
                }}
              >
                Administration
              </button>
            )}
          </div>
          {!state.tutoring_allowed && (
            <p className="training-info">
              AI tutoring is disabled for your account. You can still complete
              the pre-assessments and view your camp journey.
            </p>
          )}
          {tab === 'tasks' ? (
            <>
              <PreAssessmentPanel
                required={studentExperience}
                onCompletionChange={handlePreAssessmentCompletion}
              />
              {!trainingUnlocked && (
                <p className="training-locked-notice">
                  <span aria-hidden>🔒</span>
                  Finish both pre-assessment challenges above to unlock Coco and
                  your camp tasks.
                </p>
              )}
              <TrainingJourney state={state} />
              {!state.started_at && (
                <section className="training-card">
                  <h2>Ready to begin?</h2>
                  <p>
                    Your calendar will use{' '}
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}. This
                    cannot be changed after starting.
                  </p>
                  <button
                    type="button"
                    disabled={
                      busy || !trainingUnlocked || !state.days[0].available
                    }
                    onClick={() =>
                      void act(() =>
                        api(
                          'study-start',
                          Intl.DateTimeFormat().resolvedOptions().timeZone,
                        ),
                      )
                    }
                  >
                    {state.days[0].available
                      ? 'Start Day 1'
                      : 'Materials are being prepared'}
                  </button>
                </section>
              )}
              <div className="training-grid">
                {state.days.map((day) => {
                  const levelState = levelStateFor(
                    day,
                    day.day === currentTrainingDay?.day,
                  );
                  return (
                    <section
                      key={day.day}
                      className={`training-card training-task-card training-task-card--${levelState}`}
                    >
                      <div className="training-task-heading">
                        <span className="training-eyebrow">
                          LEVEL {day.day}
                        </span>
                        <span
                          className={`training-task-status training-task-status--${levelState}`}
                        >
                          {taskLevelLabel(levelState)}
                        </span>
                      </div>
                      <h2>{day.title}</h2>
                      <p>
                        {day.completed_at
                          ? `Completed: ${format(day.completed_at)}`
                          : !day.available
                            ? 'Material coming soon'
                            : day.unlocked
                              ? 'Ready to work on'
                              : day.unlocks_at
                                ? `Opens: ${format(day.unlocks_at)}`
                                : 'Complete the previous task first'}
                      </p>
                      <button
                        type="button"
                        disabled={
                          busy ||
                          !trainingUnlocked ||
                          !day.unlocked ||
                          !day.available
                        }
                        onClick={() =>
                          void act(async () => {
                            const result = (await api(
                              'study-download',
                              day.day,
                            )) as { success?: boolean };
                            if (result.success)
                              setNotice(`Day ${day.day} saved.`);
                          })
                        }
                      >
                        Download task
                      </button>
                      <div
                        className={`training-proof${day.completed_at ? ' training-proof--submitted' : ''}`}
                      >
                        <div className="training-proof-copy">
                          <strong>
                            {day.completed_at
                              ? 'Practice submitted'
                              : day.unlocked && day.available
                                ? 'Reflect and share your favorite moment'
                                : 'Reflection unlocks with this level'}
                          </strong>
                          <span>
                            {day.completed_at
                              ? 'Your reflection and screenshot were saved in your local Coco folders.'
                              : day.unlocked && day.available
                                ? 'Answer the short reflection, then add a screenshot to complete this level.'
                                : 'Complete the previous level before submitting this reflection.'}
                          </span>
                        </div>
                        {!day.completed_at && day.unlocked && day.available && (
                          <button
                            type="button"
                            className="training-proof-action"
                            disabled={busy || !trainingUnlocked}
                            onClick={() => setReflectionDayNumber(day.day)}
                          >
                            Submit task
                          </button>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
              {reflectionDay &&
                !reflectionDay.completed_at &&
                reflectionDay.unlocked &&
                reflectionDay.available && (
                  <DailyReflectionForm
                    day={reflectionDay.day}
                    busy={busy}
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
                            `Level ${reflectionDay.day} complete — reflection and screenshot saved locally, and 100 XP earned.`,
                          );
                        }
                      });
                      if (completed) setReflectionDayNumber(null);
                    }}
                  />
                )}
              <PostAssessmentPanel unlocked={postAssessmentUnlocked} />
            </>
          ) : (
            <>
              <section className="training-card">
                <h2>Manage a user</h2>
                <p>Enter the exact username of an existing account.</p>
                <input
                  aria-label="Username"
                  placeholder="Username"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
                <div className="training-actions">
                  <button
                    disabled={busy || !target.trim()}
                    type="button"
                    onClick={() =>
                      void act(async () => {
                        await api('study-admin-tutoring', target, true);
                        await loadUsers();
                      })
                    }
                  >
                    Disable tutoring
                  </button>
                  <button
                    disabled={busy || !target.trim()}
                    type="button"
                    onClick={() =>
                      void act(async () => {
                        await api('study-admin-tutoring', target, false);
                        await loadUsers();
                      })
                    }
                  >
                    Enable tutoring
                  </button>
                  {state.role === 'super_admin' && (
                    <>
                      <button
                        disabled={busy || !target.trim()}
                        type="button"
                        onClick={() =>
                          void act(async () => {
                            await api('study-admin-role', target, true);
                            await loadUsers();
                          })
                        }
                      >
                        Add admin
                      </button>
                      <button
                        disabled={
                          busy ||
                          !target.trim() ||
                          target.trim().toLowerCase() === 'shunta-test'
                        }
                        type="button"
                        onClick={() =>
                          void act(async () => {
                            await api('study-admin-role', target, false);
                            await loadUsers();
                          })
                        }
                      >
                        Remove admin
                      </button>
                    </>
                  )}
                </div>
                <p>
                  The Super Admin (shunta-test) cannot be removed or demoted.
                </p>
              </section>
              <section className="training-card">
                <h2>Training materials</h2>
                <p>
                  One PDF or ZIP per day, up to 20 MiB. Uploading replaces the
                  current file, not user progress.
                </p>
                <select
                  aria-label="Training day"
                  value={uploadDay}
                  onChange={(e) => setUploadDay(Number(e.target.value))}
                >
                  {state.days.map((d) => (
                    <option key={d.day} value={d.day}>
                      Day {d.day}
                      {d.available ? ' · uploaded' : ' · missing'}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Task title"
                  placeholder="Task title"
                  value={title}
                  maxLength={150}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busy || !title.trim()}
                  onClick={() =>
                    void act(() => api('study-upload', uploadDay, title.trim()))
                  }
                >
                  Choose file and upload
                </button>
              </section>
              <section className="training-card">
                <h2>Post-assessment toolkit</h2>
                <p>
                  Upload one ZIP containing all execution-task reference files,
                  up to 20 MiB. Uploading replaces the current toolkit without
                  changing participant progress.
                </p>
                <p>
                  Status:{' '}
                  <strong>
                    {state.post_assessment_toolkit_available
                      ? 'Uploaded'
                      : 'Missing'}
                  </strong>
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      const result = (await api(
                        'study-upload-post-assessment-toolkit',
                      )) as { success?: boolean };
                      if (result.success)
                        setNotice('Post-assessment toolkit uploaded.');
                    })
                  }
                >
                  Choose toolkit ZIP and upload
                </button>
              </section>
              <section className="training-card">
                <h2>Participant progress</h2>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(() => loadUsers())}
                >
                  Refresh
                </button>
                <div className="training-table">
                  <table>
                    <thead>
                      <tr>
                        <th>User / role</th>
                        <th>Tutoring</th>
                        <th>Started / timezone</th>
                        {state.days.map((d) => (
                          <th key={d.day}>Day {d.day}</th>
                        ))}
                        <th>Post-assessment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.user_id}>
                          <td>
                            {u.user_id}
                            <br />
                            {u.role}
                          </td>
                          <td>{u.tutoring_allowed ? 'Enabled' : 'Disabled'}</td>
                          <td>
                            {format(u.started_at)}
                            <br />
                            {u.timezone}
                          </td>
                          {u.days.map((d) => (
                            <td key={d.day}>
                              {d.completed_at
                                ? `Completed ${format(d.completed_at)}`
                                : d.unlocked
                                  ? 'Unlocked'
                                  : d.unlocks_at
                                    ? `Opens ${format(d.unlocks_at)}`
                                    : 'Locked'}
                            </td>
                          ))}
                          <td>
                            {u.post_assessment_complete
                              ? 'Complete'
                              : 'Not complete'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {after && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act(() => loadUsers(after))}
                  >
                    Load more users
                  </button>
                )}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
