import type React from 'react';
import { S } from './styles';

interface Props {
  wakeWordSaving: boolean;
  wakeWordEnabled: boolean;
  updateWakeWordEnabled: (enabled: boolean) => Promise<void>;
  wakeWordCaptureError: string;
  wakeWordStatus: 'disabled' | 'starting' | 'ready' | 'sleeping' | 'error';
  wakeWordDetail: string;
  cocoSleeping: boolean;
}

export default function VoiceSettings({
  wakeWordSaving,
  wakeWordEnabled,
  updateWakeWordEnabled,
  wakeWordCaptureError,
  wakeWordStatus,
  wakeWordDetail,
  cocoSleeping,
}: Props) {
  return (
    <section className="workspace-settings-section">
      <div style={S.groupLabel}>Voice activation</div>
      <label
        htmlFor="workspace-voice-activation"
        style={{
          ...S.healthRow,
          alignItems: 'center',
          cursor: wakeWordSaving ? 'default' : 'pointer',
          marginBottom: 7,
        }}
      >
        <input
          id="workspace-voice-activation"
          type="checkbox"
          checked={wakeWordEnabled}
          disabled={wakeWordSaving}
          onChange={(event) => updateWakeWordEnabled(event.target.checked)}
        />
        <span>
          <span style={S.healthName}>Listen for Coco</span>
          <span style={{ ...S.healthDetail, display: 'block' }}>
            Detects “Coco”, “Hi Coco”, and “Hey Coco”.
          </span>
        </span>
      </label>
      <div style={S.helpText}>
        Audio is analyzed continuously by a small local model and discarded.
        Coco pauses listening while asleep and while recording a voice message.
      </div>
      {wakeWordEnabled && (
        <div
          role="status"
          style={{
            ...S.healthDetail,
            marginTop: 6,
            color:
              wakeWordCaptureError || wakeWordStatus === 'error'
                ? '#b91c1c'
                : '#16a34a',
          }}
        >
          {wakeWordCaptureError
            ? `Microphone unavailable: ${wakeWordCaptureError}`
            : wakeWordStatus === 'error'
              ? wakeWordDetail || 'The local wake-word model could not start.'
              : cocoSleeping || wakeWordStatus === 'sleeping'
                ? 'Paused while Coco is asleep.'
                : wakeWordStatus === 'starting'
                  ? 'Starting the local detector…'
                  : 'Listening locally.'}
        </div>
      )}
    </section>
  );
}
