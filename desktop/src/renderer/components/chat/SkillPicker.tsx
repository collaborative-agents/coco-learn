import useModelChapter from '../training/useModelChapter';
import useWorkflowChapter from '../training/useWorkflowChapter';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import CuratedSkills from '../training/CuratedSkills';
import TrainingDialog from '../training/TrainingDialog';
import '../training/TrainingDialog.css';
import ActionTooltip from './ActionTooltip';
import { S } from './styles';
import SkillIcon from './SkillIcon';
import './SkillPicker.css';

export default function SkillPicker({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (name: string) => void;
}) {
  const models = useModelChapter();
  const workflow = useWorkflowChapter();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('coco:open-skills', show);
    return () => window.removeEventListener('coco:open-skills', show);
  }, []);
  if (!models.completedAt && !workflow.completedAt) return null;
  return (
    <>
      <div
        className="skill-picker-trigger"
        onBlur={(event) => {
          if (
            !workflow.completedAt &&
            !event.currentTarget.contains(event.relatedTarget)
          )
            setOpen(false);
        }}
        onKeyDown={(event) => {
          if (!workflow.completedAt && event.key === 'Escape') setOpen(false);
        }}
      >
        <ActionTooltip label="Skills">
          <button
            type="button"
            style={S.micBtn}
            disabled={disabled}
            aria-label="Skills"
            aria-haspopup={workflow.completedAt ? 'dialog' : undefined}
            aria-expanded={open}
            onClick={() => setOpen((shown) => !shown)}
          >
            <SkillIcon />
          </button>
        </ActionTooltip>
        {open && !workflow.completedAt && (
          <div className="skill-picker-unlock-hint" role="status">
            Unlock Skills in{' '}
            <a
              href="#agent-101"
              onClick={(event) => {
                event.preventDefault();
                setOpen(false);
                window.electron.ipcRenderer.sendMessage('open-training');
              }}
            >
              Agent 101 Chapter 5
            </a>
          </div>
        )}
      </div>
      {open &&
        workflow.completedAt &&
        createPortal(
          <TrainingDialog
            open
            title="Your skills"
            className="skill-picker-dialog"
            onClose={() => setOpen(false)}
          >
            <CuratedSkills
              onSelect={
                disabled
                  ? undefined
                  : (skill) => {
                      onSelect(skill.name);
                      setOpen(false);
                    }
              }
              onCreate={() => setOpen(false)}
            />
          </TrainingDialog>,
          document.body,
        )}
    </>
  );
}
