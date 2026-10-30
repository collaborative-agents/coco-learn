import { useCallback, useEffect, useRef, useState } from 'react';
import type { TokenUsageRecord } from '../../../shared/token-training';
import useTokenChapter from '../training/useTokenChapter';
import '../training/TokenChapter.css';
import TokenUsageHeatmap, {
  buildTokenCalendar,
  localDayKey,
} from './TokenUsageHeatmap';

export function summarizeTokenUsage(
  requests: TokenUsageRecord[],
  period: string,
  now = new Date(),
) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === 'week') start.setDate(start.getDate() - 6);
  const rows = requests.filter(
    (request) => period === 'all' || Date.parse(request.at) >= start.getTime(),
  );
  const models = new Map<
    string,
    { model: string; input: number; output: number; unavailable: number }
  >();
  rows
    .flatMap((request) => (request.models?.length ? request.models : [request]))
    .forEach((request) => {
      const row = models.get(request.model) ?? {
        model: request.model,
        input: 0,
        output: 0,
        unavailable: 0,
      };
      row.input += request.input ?? 0;
      row.output += request.output ?? 0;
      if (request.input === null || request.output === null)
        row.unavailable += 1;
      models.set(request.model, row);
    });
  return [...models.values()];
}

export default function TokenUsageSettings() {
  const { completedAt } = useTokenChapter();
  const [data, setData] = useState<{
    requests: TokenUsageRecord[];
    trackingSince: string;
  } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const load = useCallback(async () => {
    revision.current += 1;
    const request = revision.current;
    try {
      const value = await window.electron.ipcRenderer.invoke('token-usage');
      if (request !== revision.current) return;
      if (!Array.isArray(value?.requests))
        throw new Error('Token usage is unavailable.');
      setData(value);
      setError('');
    } catch {
      if (request !== revision.current) return;
      setData(null);
      setError('Could not load token usage. Please retry.');
    }
  }, []);
  useEffect(() => {
    if (!completedAt) {
      revision.current += 1;
      setData(null);
      return undefined;
    }
    load();
    const unsubscribe = window.electron?.ipcRenderer.on?.(
      'token-chapter-progress-changed',
      load,
    );
    return () => {
      revision.current += 1;
      unsubscribe?.();
    };
  }, [completedAt, load]);
  if (!completedAt)
    return (
      <section
        className="settings-token-usage"
        aria-labelledby="token-usage-heading"
      >
        <h3 id="token-usage-heading" className="settings-heading">
          Token usage
        </h3>
        <div className="token-usage-locked">
          <div className="token-usage-locked-preview" inert aria-hidden="true">
            <TokenUsageHeatmap
              requests={[]}
              selected={null}
              onSelect={() => {}}
            />
          </div>
          <div className="token-usage-lock-mask">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <rect x="5" y="10" width="14" height="11" rx="3" />
              <path d="M8 10V6a4 4 0 0 1 8 0v4" />
              <path d="M12 14v3" />
            </svg>
            <strong>Unlock token tracking</strong>
            <span>
              Complete{' '}
              <a
                href="#agent-101"
                onClick={(event) => {
                  event.preventDefault();
                  window.electron.ipcRenderer.sendMessage('open-training');
                }}
              >
                Agent 101 Chapter 3 · Token
              </a>{' '}
              to see your usage.
            </span>
          </div>
        </div>
      </section>
    );
  const calendar = buildTokenCalendar(data?.requests ?? []);
  const visibleDays = new Set(
    calendar.filter((day) => day.active).map((day) => day.key),
  );
  const visibleRequests = (data?.requests ?? []).filter((request) => {
    const day = localDayKey(new Date(request.at));
    return selectedDay ? day === selectedDay : visibleDays.has(day);
  });
  const rows = summarizeTokenUsage(visibleRequests, 'all');
  const input = rows.reduce((total, row) => total + row.input, 0);
  const output = rows.reduce((total, row) => total + row.output, 0);
  const unavailable = rows.reduce((total, row) => total + row.unavailable, 0);
  return (
    <section
      className="settings-token-usage"
      aria-labelledby="token-usage-heading"
    >
      <h3 id="token-usage-heading" className="settings-heading">
        Token usage
      </h3>
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={load}>
            Retry
          </button>
        </p>
      )}
      {!data && !error && <p role="status">Loading token usage…</p>}
      {data && (
        <>
          <TokenUsageHeatmap
            requests={data.requests}
            selected={selectedDay}
            onSelect={setSelectedDay}
          />
          <p>
            Input <strong>{input.toLocaleString()}</strong> · Output{' '}
            <strong>{output.toLocaleString()}</strong> · Total{' '}
            <strong>{(input + output).toLocaleString()}</strong>
            {unavailable > 0 ? ' (known tokens only)' : ''}
          </p>
          {unavailable > 0 && (
            <p role="status">
              Usage unavailable for all or part of {unavailable} model usage
              record
              {unavailable === 1 ? '' : 's'}; those missing counts are excluded.
            </p>
          )}
          {rows.length ? (
            <table className="token-usage-table">
              <caption>
                Usage by model · {selectedDay ? 'Selected day' : 'Last year'}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Model</th>
                  <th scope="col">Input</th>
                  <th scope="col">Output</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.model}>
                    <th scope="row">
                      {row.model}
                      {row.unavailable ? ' (partial)' : ''}
                    </th>
                    <td>{row.input.toLocaleString()}</td>
                    <td>{row.output.toLocaleString()}</td>
                    <td>{(row.input + row.output).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No requests recorded in this period.</p>
          )}
        </>
      )}
    </section>
  );
}
