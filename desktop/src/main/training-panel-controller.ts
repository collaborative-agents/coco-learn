import type { IpcMain } from 'electron';
import { registerStudyIpc } from './services/study-service';
import { registerPreAssessmentIpc } from './pre-assessment-store';
import type { CocoGatewayClient } from './services/gateway-client';

interface TrainingPanelDependencies {
  ipc: IpcMain;
  root: () => string;
  user: () => string | null;
  authenticated: () => boolean;
  gateway: () => CocoGatewayClient | null;
  access: () => { tutoring_allowed: boolean; status: string; hosted_training_enabled?: boolean };
  refreshAccess: () => Promise<void>;
  refreshTray: () => void;
  showPanel: () => void;
}

/** Navigation and IPC wiring for the study Training panel and assessments. */
export default function registerTrainingPanel(deps: TrainingPanelDependencies) {
  registerStudyIpc(deps.ipc, deps.gateway);
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

  return { openTraining };
}
