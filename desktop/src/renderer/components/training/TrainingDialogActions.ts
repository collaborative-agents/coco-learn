import { createContext } from 'react';

/** Destination for controls owned by a page inside the training dialog. */
const TrainingDialogActions = createContext<HTMLElement | null>(null);
export default TrainingDialogActions;
