/* eslint-disable react/require-default-props -- React 19 uses default function parameters. */
import { useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import TrainingDialogActions from './TrainingDialogActions';
import type { TrainingDay } from '../../../shared/study';
import type { TrainingMaterials } from '../../../shared/training-materials';
import TrainingDocumentView from './TrainingDocumentView';
import './TaskBrief.css';
import TrainingSubmissionView from './TrainingSubmissionView';
import SubmissionAttempts from './SubmissionAttempts';
import { cachedMaterials, loadMaterials } from './training-materials-cache';
import { api, format } from './training-api';

export default function TrainingTaskDetail({
  day,
  userId,
  busy,
  onReflect,
}: {
  day: TrainingDay;
  userId: string;
  busy: boolean;
  onReflect: () => void;
}) {
  const headerActions = useContext(TrainingDialogActions);
  const [materials, setMaterials] = useState<TrainingMaterials | null>(() =>
    cachedMaterials(userId, day.day, day.filename),
  );
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [files, setFiles] = useState(day.submitted_files ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [showInstructions, setShowInstructions] = useState(
    !day.submitted_files?.length && !day.completed_at,
  );
  const submitWork = async () => {
    setUploading(true);
    setUploadError('');
    try {
      const result = (await api('study-submit-deliverable', day.day)) as {
        canceled?: boolean;
        filenames?: string[];
      };
      if (!result.canceled) {
        if (!result.filenames?.length)
          throw new Error('No files were submitted. Please try again.');
        setFiles(result.filenames);
        setShowInstructions(false);
        setRevision((value) => value + 1);
      }
    } catch (reason) {
      setUploadError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setUploading(false);
    }
  };
  useEffect(() => {
    let active = true;
    setMaterials(cachedMaterials(userId, day.day, day.filename));
    setError('');
    setNotice('');
    loadMaterials(userId, day.day, day.filename)
      .then((data: TrainingMaterials) => {
        if (!active) return undefined;
        if (
          !data ||
          !Array.isArray(data.documents) ||
          !Array.isArray(data.files)
        )
          throw new Error('Task instructions could not be loaded.');
        setMaterials(data);
        return undefined;
      })
      .catch((reason: unknown) => {
        if (active) setError(String(reason));
      });
    return () => {
      active = false;
    };
  }, [userId, day.day, day.filename, retry]);
  const document = materials?.documents[0];
  const references =
    materials?.files.filter((file) => file.id !== document?.id) ?? [];
  const saveReferences = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = (await api('study-save-references', day.day)) as {
        success?: boolean;
      };
      if (result.success) setNotice('Reference files saved.');
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };
  const referenceDownload =
    references.length > 0 ? (
      <div className="post-assessment-toolkit-grid">
        <div className="post-assessment-toolkit-file">
          <span aria-hidden>↓</span>
          <div>
            <strong>Complete task toolkit</strong>
            <small>
              Includes {references.map((file) => file.name).join(', ')}
            </small>
          </div>
          <button type="button" disabled={saving} onClick={saveReferences}>
            {saving ? 'Saving…' : 'Download all reference files'}
          </button>
        </div>
      </div>
    ) : null;
  return (
    <>
      {day.completed_at && (
        <p className="training-detail-meta">
          Completed {format(day.completed_at)}
        </p>
      )}
      {showInstructions && error && (
        <div role="alert" className="training-error">
          {error}{' '}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Retry
          </button>
        </div>
      )}
      {showInstructions && !materials && !error && (
        <p role="status">Loading task instructions…</p>
      )}
      {!showInstructions &&
        headerActions &&
        createPortal(
          <button
            type="button"
            className="training-dialog-back"
            aria-label="Back to task instructions"
            title="Back to task instructions"
            disabled={uploading}
            onClick={() => setShowInstructions(true)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m12 5-7 7 7 7M5 12h14" />
            </svg>
          </button>,
          headerActions,
        )}
      {materials && showInstructions && (
        <>
          {document ? (
            <TrainingDocumentView
              document={document}
              referenceDownload={referenceDownload}
            />
          ) : (
            <p>
              No previewable instructions were found. Ask your organizer to
              include a PDF, Markdown, or text instruction file.
            </p>
          )}
          {!document && referenceDownload}
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      {!showInstructions && day.completed_at && (
        <>
          <SubmissionAttempts
            key={revision}
            taskId={`day-${day.day}`}
            files={files}
          />
          <TrainingSubmissionView day={day.day} />
        </>
      )}
      {!day.completed_at &&
        day.deliverable_required &&
        (!showInstructions || !files.length) && (
          <section
            className="training-task-submission"
            aria-label="Submit your work"
          >
            {files.length > 0 && (
              <SubmissionAttempts
                key={revision}
                taskId={`day-${day.day}`}
                files={files}
              />
            )}
            {uploadError && (
              <p role="alert" className="training-error">
                {uploadError}
              </p>
            )}
            <div className="training-task-actions">
              <button
                type="button"
                className={files.length ? undefined : 'training-primary'}
                disabled={busy || uploading}
                onClick={submitWork}
              >
                {uploading && 'Submitting…'}
                {!uploading && (files.length ? 'Submit again' : 'Submit work')}
              </button>
              {files.length > 0 && (
                <button
                  type="button"
                  className="training-primary"
                  disabled={busy || uploading}
                  onClick={onReflect}
                >
                  Mark as finished
                </button>
              )}
              {!files.length && (
                <p className="training-submit-explanation">
                  <small>
                    Up to five PDF, Word, Excel, CSV, Markdown, or text files
                    (20 MiB total). Include all deliverable files with each
                    submission.
                  </small>
                </p>
              )}
            </div>
          </section>
        )}
      {showInstructions &&
        (files.length > 0 || day.completed_at) &&
        (headerActions ? (
          createPortal(
            <button
              type="button"
              className="training-view-submission"
              onClick={() => setShowInstructions(false)}
            >
              View submission
            </button>,
            headerActions,
          )
        ) : (
          <button type="button" onClick={() => setShowInstructions(false)}>
            View submission
          </button>
        ))}
      {!day.completed_at && !day.deliverable_required && (
        <footer className="training-detail-footer">
          <button
            className="training-primary"
            type="button"
            disabled={busy || saving}
            onClick={onReflect}
          >
            Mark as finished
          </button>
        </footer>
      )}
    </>
  );
}
