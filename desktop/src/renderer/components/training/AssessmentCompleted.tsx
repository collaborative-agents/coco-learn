import { useContext } from 'react';
import { createPortal } from 'react-dom';
import TrainingDialogActions from './TrainingDialogActions';

export default function AssessmentCompleted() {
  const headerActions = useContext(TrainingDialogActions);
  const label = <span className="agentic-quest-completed">Completed</span>;
  return headerActions ? createPortal(label, headerActions) : label;
}
