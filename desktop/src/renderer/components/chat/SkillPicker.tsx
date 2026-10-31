import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import CuratedSkills from '../training/CuratedSkills';
import TrainingDialog from '../training/TrainingDialog';
import '../training/TrainingDialog.css';
import ActionTooltip from './ActionTooltip';
import { S } from './styles';
import SkillIcon from './SkillIcon';

export default function SkillPicker({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('coco:open-skills', show);
    return () => window.removeEventListener('coco:open-skills', show);
  }, []);
  return (
    <>
      <ActionTooltip label="Skills">
        <button
          type="button"
          style={S.micBtn}
          disabled={disabled}
          aria-label="Skills"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <SkillIcon />
        </button>
      </ActionTooltip>
      {open &&
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
