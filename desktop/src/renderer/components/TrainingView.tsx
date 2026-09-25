import React, { useCallback, useEffect, useState } from 'react';
import type { StudyState } from '../../shared/study';
import './TrainingView.css';

const api = (
  channel: Parameters<typeof window.electron.ipcRenderer.invoke>[0],
  ...args: unknown[]
) => window.electron.ipcRenderer.invoke(channel, ...args);
const format = (value: string | null) =>
  value ? new Date(value).toLocaleString('en-US') : '—';

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
  const refresh = useCallback(async () => {
    const data = (await api('study-me')) as StudyState;
    setState(data);
    if (data.role === 'participant') {
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
  return (
    <main className="training-page">
      <header>
        <span className="training-eyebrow">COCO LEARN</span>
        <h1>Your seven-day practice</h1>
        <p>
          Complete each task and confirm below. The next task opens no earlier
          than the following calendar day.
        </p>
      </header>
      {error && (
        <div role="alert" className="training-error">
          {error}
          <button type="button" onClick={() => void act(refresh)}>
            Retry
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {!state ? (
        <p>Loading your training…</p>
      ) : (
        <>
          <div className="training-toolbar">
            <span>
              {state.user_id} · {state.role.replace('_', ' ')}
            </span>
            <button type="button" onClick={() => setTab('tasks')}>
              My tasks
            </button>
            {state.role !== 'participant' && (
              <button
                type="button"
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
              AI tutoring is disabled for your account. Training downloads and
              messages with other participants remain available.
            </p>
          )}
          {tab === 'tasks' ? (
            <>
              <p>
                Progress: {state.days.filter((d) => d.completed_at).length} / 7
                completed{state.timezone && ` · Calendar: ${state.timezone}`}
              </p>
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
                    disabled={busy || !state.days[0].available}
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
                {state.days.map((day) => (
                  <section key={day.day} className="training-card">
                    <span className="training-eyebrow">DAY {day.day}</span>
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
                      disabled={busy || !day.unlocked || !day.available}
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
                    <label className="training-complete">
                      <input
                        type="checkbox"
                        checked={!!day.completed_at}
                        disabled={
                          busy ||
                          !!day.completed_at ||
                          !day.unlocked ||
                          !day.available
                        }
                        onChange={() => {
                          if (
                            window.confirm(
                              `Mark Day ${day.day} as completed? This cannot be undone.`,
                            )
                          )
                            void act(() => api('study-complete', day.day));
                        }}
                      />
                      I have completed this task
                    </label>
                  </section>
                ))}
              </div>
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
