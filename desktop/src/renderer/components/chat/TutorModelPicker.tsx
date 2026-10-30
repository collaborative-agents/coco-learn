import { useEffect, useState } from 'react';
import type { TutorModelOption } from './types';
import './TutorModelPicker.css';
import useModelChapter from '../training/useModelChapter';

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
  const [models, setModels] = useState<TutorModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');
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
  if (!completedAt)
    return (
      <div className="tutor-model-picker">
        <span>
          {models.find((model) => model.id === modelId)?.label ??
            'Current model'}{' '}
          · Locked
        </span>
        {!progressLoading && (
          <a
            href="#agent-101"
            onClick={(event) => {
              event.preventDefault();
              window.electron.ipcRenderer.sendMessage('open-training');
            }}
          >
            Unlock in Agent 101 Chapter 4
          </a>
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
