import { useEffect, useState } from 'react';
import type { TutorModelOption } from './types';
import './TutorModelPicker.css';
import useModelChapter from '../training/useModelChapter';
import useTokenChapter from '../training/useTokenChapter';

export default function TutorModelPicker({
  modelId,
  onChange,
  disabled,
}: {
  modelId: string;
  onChange: (modelId: string) => void;
  disabled: boolean;
}) {
  const { completedAt, loading: progressLoading } = useModelChapter();
  const tokenChapter = useTokenChapter();
  const [models, setModels] = useState<TutorModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');
  const [showUnlockHint, setShowUnlockHint] = useState(false);
  useEffect(() => {
    let cancelled = false;
    window.electron.ipcRenderer
      .invoke('get-model-configuration')
      .then((config) => {
        if (cancelled) return undefined;
        if (!Array.isArray(config?.tutors) || !config.tutors.length)
          throw new Error('No tutor models are configured.');
        setModels(config.tutors);
        setLoading(false);
        return undefined;
      })
      .catch((reason) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const select = async (nextId: string) => {
    if (!completedAt) return;
    setSwitching(true);
    setError('');
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'set-chat-model',
        { modelId: nextId },
      );
      if (!result?.success)
        throw new Error(result?.error || 'Could not switch tutor model.');
      onChange(nextId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSwitching(false);
    }
  };
  if (!completedAt && !tokenChapter.completedAt) return null;
  if (!completedAt)
    return (
      <div
        className="tutor-model-picker tutor-model-picker-locked"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setShowUnlockHint(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setShowUnlockHint(false);
        }}
      >
        <button
          type="button"
          className="tutor-model-picker-trigger"
          aria-label="Tutor model"
          aria-expanded={showUnlockHint}
          disabled={disabled || loading || progressLoading}
          onClick={() => setShowUnlockHint((shown) => !shown)}
        >
          <span>
            {models.find((model) => model.id === modelId)?.label ??
              'Current model'}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>
        {showUnlockHint && (
          <div className="tutor-model-unlock-hint" role="status">
            Unlock Model Picker in{' '}
            <a
              href="#agent-101"
              onClick={(event) => {
                event.preventDefault();
                setShowUnlockHint(false);
                window.electron.ipcRenderer.sendMessage('open-training');
              }}
            >
              Agent 101 Chapter 4
            </a>
          </div>
        )}
      </div>
    );
  return (
    <div className="tutor-model-picker">
      <select
        aria-label="Tutor model"
        value={modelId}
        disabled={disabled || loading || switching || !models.length}
        onChange={(event) => select(event.target.value)}
      >
        {!models.some((model) => model.id === modelId) && (
          <option value={modelId}>
            {loading ? 'Loading models…' : 'Choose a model'}
          </option>
        )}
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </select>
      {switching && <span role="status">Switching model…</span>}
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
