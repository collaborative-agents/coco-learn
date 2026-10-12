import type React from 'react';
import { S } from './styles';

interface Props {
  memoryDraft: string;
  setMemoryDraft: React.Dispatch<React.SetStateAction<string>>;
  memoryDirty: boolean;
  saveMemory: () => Promise<void>;
  memoryFlash: boolean;
}

export default function MemorySettings({
  memoryDraft,
  setMemoryDraft,
  memoryDirty,
  saveMemory,
  memoryFlash,
}: Props) {
  return (
    <section className="workspace-settings-section">
      <div style={S.groupLabel}>Memory</div>
      <div style={S.helpText}>
        Long-term notes Coco keeps about you — preferences, recurring tasks, and
        what has worked before. Coco reads this every session; edit it freely.
      </div>
      <textarea
        style={S.memoryArea}
        placeholder="e.g. Prefers concise answers. Works mostly in Google Docs and Slides. Comfortable with Claude; new to agents."
        value={memoryDraft}
        onChange={(e) => setMemoryDraft(e.target.value)}
      />
      <div style={S.saveRow}>
        <button
          type="button"
          style={{ ...S.saveBtn, ...(memoryDirty ? {} : S.sendBtnDisabled) }}
          onClick={saveMemory}
          disabled={!memoryDirty}
        >
          Save memory
        </button>
        {memoryFlash && <span style={S.saved}>✓ Saved</span>}
      </div>
    </section>
  );
}
