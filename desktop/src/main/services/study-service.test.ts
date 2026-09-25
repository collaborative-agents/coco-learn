import { dialog } from 'electron';
import fs from 'fs/promises';
import { registerStudyIpc } from './study-service';
import type { CocoGatewayClient } from './gateway-client';

jest.mock('electron', () => ({
  dialog: { showSaveDialog: jest.fn(), showOpenDialog: jest.fn() },
}));
jest.mock('fs/promises', () => ({
  __esModule: true,
  default: { writeFile: jest.fn(), readFile: jest.fn(), stat: jest.fn() },
}));

function fixture(response: object) {
  const requestJson = jest.fn().mockResolvedValue(response);
  const handlers = new Map<string, (...args: any[]) => any>();
  registerStudyIpc(
    {
      handle: (name, handler) => {
        handlers.set(name, handler);
      },
    },
    () => ({ requestJson }) as unknown as CocoGatewayClient,
  );
  return {
    requestJson,
    invoke: (name: string, ...args: unknown[]) =>
      handlers.get(name)!(null, ...args),
  };
}

beforeEach(() => jest.clearAllMocks());
it('saves an authenticated download only to the user-selected location', async () => {
  const { invoke, requestJson } = fixture({
    filename: 'task.pdf',
    data: Buffer.from('pdf').toString('base64'),
  });
  (dialog.showSaveDialog as jest.Mock).mockResolvedValue({
    canceled: false,
    filePath: '/chosen/task.pdf',
  });
  expect(await invoke('study-download', 1)).toEqual({ success: true });
  expect(requestJson).toHaveBeenCalledWith(
    '/api/study/days/1/download',
    'GET',
    undefined,
  );
  expect(fs.writeFile).toHaveBeenCalledWith(
    '/chosen/task.pdf',
    Buffer.from('pdf'),
  );
});
it('does not save when the chooser is cancelled', async () => {
  const { invoke } = fixture({ filename: 'task.pdf', data: 'YWJj' });
  (dialog.showSaveDialog as jest.Mock).mockResolvedValue({ canceled: true });
  await invoke('study-download', 1);
  expect(fs.writeFile).not.toHaveBeenCalled();
});
it('rejects out-of-range days and unsafe download names', async () => {
  const { invoke, requestJson } = fixture({
    filename: '../bad.pdf',
    data: 'YWJj',
  });
  await expect(invoke('study-download', 8)).rejects.toThrow(
    'Invalid training day',
  );
  expect(requestJson).not.toHaveBeenCalled();
  await expect(invoke('study-download', 1)).rejects.toThrow(
    'Invalid training file',
  );
  expect(dialog.showSaveDialog).not.toHaveBeenCalled();
});
it('does not open an upload chooser for a participant', async () => {
  const { invoke } = fixture({ role: 'participant' });
  await expect(invoke('study-upload', 1, 'Task')).rejects.toThrow(
    'Administrator access required',
  );
  expect(dialog.showOpenDialog).not.toHaveBeenCalled();
});
