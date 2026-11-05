import type { Dialog, IpcMain } from 'electron';
import registerTrainingPanel from './training-panel-controller';

jest.mock('./services/study-service', () => ({ registerStudyIpc: jest.fn() }));
jest.mock('./pre-assessment-store', () => ({
  registerPreAssessmentIpc: jest.fn(),
}));

it('gates panel navigation and reads access again after an explicit refresh', async () => {
  let authenticated = false;
  let allowed = false;
  const handlers: Record<string, (...args: any[]) => any> = {};
  const listeners: Record<string, () => void> = {};
  const showPanel = jest.fn();
  const refreshAccess = jest.fn(async () => {
    allowed = true;
  });
  const showMessageBox = jest.fn().mockResolvedValue({ response: 0 });
  const panel = registerTrainingPanel({
    ipc: {
      handle: (name: string, handler: any) => {
        handlers[name] = handler;
      },
      on: (name: string, listener: () => void) => {
        listeners[name] = listener;
      },
    } as unknown as IpcMain,
    dialog: { showMessageBox } as unknown as Pick<Dialog, 'showMessageBox'>,
    root: () => '/unused',
    user: () => 'alice',
    authenticated: () => authenticated,
    gateway: () => null,
    access: () => ({
      tutoring_allowed: allowed,
      status: allowed ? 'allowed' : 'checking',
    }),
    refreshAccess,
    refreshTray: jest.fn(),
    showPanel,
    postAssessmentChanged: jest.fn(),
  });
  listeners['open-training']();
  expect(showPanel).not.toHaveBeenCalled();
  authenticated = true;
  listeners['open-training']();
  expect(showPanel).toHaveBeenCalledTimes(1);
  expect(handlers['study-access']().tutoring_allowed).toBe(false);
  await expect(handlers['study-refresh-access']()).resolves.toEqual({
    tutoring_allowed: true,
    status: 'allowed',
  });
  expect(refreshAccess).toHaveBeenCalledTimes(1);
  panel.showPreAssessmentLockedMessage();
  await Promise.resolve();
  expect(showPanel).toHaveBeenCalledTimes(2);
  showMessageBox.mockResolvedValueOnce({ response: 1 });
  panel.showPreAssessmentLockedMessage();
  await Promise.resolve();
  expect(showPanel).toHaveBeenCalledTimes(2);
});
