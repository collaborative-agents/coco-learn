import type { Dialog, IpcMain } from 'electron';
import { registerStudyIpc } from './services/study-service';
import { registerPreAssessmentIpc } from './pre-assessment-store';
import type { CocoGatewayClient } from './services/gateway-client';

interface TrainingPanelDependencies {
  ipc: IpcMain;
  dialog: Pick<Dialog, 'showMessageBox'>;
  root: () => string;
  user: () => string | null;
  authenticated: () => boolean;
  gateway: () => CocoGatewayClient | null;
  access: () => { tutoring_allowed: boolean; status: string };
  refreshAccess: () => Promise<void>;
  refreshTray: () => void;
  showPanel: () => void;
  postAssessmentChanged: (active: boolean) => void;
}

/** Navigation and IPC wiring for the study Training panel and assessments. */
export default function registerTrainingPanel(deps: TrainingPanelDependencies) {
  registerStudyIpc(
    deps.ipc,
    deps.gateway,
    undefined,
    deps.postAssessmentChanged,
  );
  registerPreAssessmentIpc(
    deps.ipc,
    deps.root,
    deps.user,
    deps.gateway,
    async () => {
      await deps.refreshAccess();
      deps.refreshTray();
    },
  );
  deps.ipc.handle('study-access', () => deps.access());
  deps.ipc.handle('study-refresh-access', async () => {
    await deps.refreshAccess();
    return deps.access();
  });

  const openTraining = () => {
    if (deps.authenticated()) deps.showPanel();
  };
  deps.ipc.on('open-training', openTraining);

  const showPreAssessmentLockedMessage = () => {
    void deps.dialog
      .showMessageBox({
        type: 'info',
        title: 'Finish your pre-assessments first',
        message:
          'Coco chat will unlock after you finish AI literacy and the execution task.',
        detail:
          'Complete AI literacy and the execution task in Training to unlock Coco chat, tutoring, and sensing.',
        buttons: ['Open pre-assessments', 'Not now'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) openTraining();
      });
  };
  return { openTraining, showPreAssessmentLockedMessage };
}
