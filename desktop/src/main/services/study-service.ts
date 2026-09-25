import { dialog } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type { IpcMain } from 'electron';
import type { CocoGatewayClient } from './gateway-client';
import type { StudyState } from '../../shared/study';

export function registerStudyIpc(
  ipc: Pick<IpcMain, 'handle'>,
  gateway: () => CocoGatewayClient | null,
) {
  const request = (
    route: string,
    method: 'GET' | 'POST' | 'PATCH' = 'GET',
    body?: object,
  ) => {
    const client = gateway();
    if (!client) throw new Error('Please sign in to use Training.');
    return client.requestJson(`/api/study${route}`, method, body);
  };
  const dayNumber = (day: unknown): number => {
    if (!Number.isInteger(day) || Number(day) < 1 || Number(day) > 7)
      throw new Error('Invalid training day.');
    return Number(day);
  };
  const userPath = (id: string) => {
    if (typeof id !== 'string' || !id.trim())
      throw new Error('Username is required.');
    return `/admin/users/${encodeURIComponent(id.trim())}`;
  };
  ipc.handle('study-me', () => request('/me'));
  ipc.handle('study-start', (_event, timezone: string) =>
    request('/start', 'POST', { timezone }),
  );
  ipc.handle('study-complete', (_event, day: number) =>
    request(`/days/${dayNumber(day)}/complete`, 'POST', { completed: true }),
  );
  ipc.handle('study-admin-users', (_event, after = '') =>
    request(`/admin/users?after=${encodeURIComponent(after)}`),
  );
  ipc.handle('study-admin-role', (_event, id: string, admin: boolean) =>
    request(`${userPath(id)}/role`, 'PATCH', { admin }),
  );
  ipc.handle('study-admin-tutoring', (_event, id: string, disabled: boolean) =>
    request(`${userPath(id)}/tutoring`, 'PATCH', { disabled }),
  );
  ipc.handle('study-download', async (_event, day: number) => {
    const file = await request(`/days/${dayNumber(day)}/download`);
    if (
      typeof file.filename !== 'string' ||
      path.basename(file.filename) !== file.filename ||
      typeof file.data !== 'string' ||
      file.data.length > 28 * 1024 * 1024
    )
      throw new Error('Invalid training file.');
    const destination = await dialog.showSaveDialog({
      title: 'Save training task',
      defaultPath: file.filename,
    });
    if (destination.canceled || !destination.filePath)
      return { canceled: true };
    await fs.writeFile(destination.filePath, Buffer.from(file.data, 'base64'));
    return { success: true };
  });
  ipc.handle('study-upload', async (_event, day: number, title: string) => {
    dayNumber(day);
    const me = (await request('/me')) as unknown as StudyState;
    if (me.role === 'participant')
      throw new Error('Administrator access required.');
    const selected = await dialog.showOpenDialog({
      title: 'Select training material (up to 20 MiB)',
      properties: ['openFile'],
      filters: [{ name: 'Training material', extensions: ['pdf', 'zip'] }],
    });
    if (selected.canceled || !selected.filePaths[0]) return { canceled: true };
    const file = selected.filePaths[0];
    if ((await fs.stat(file)).size > 20 * 1024 * 1024)
      throw new Error('File exceeds 20 MiB.');
    return request(`/admin/materials/${day}`, 'POST', {
      title,
      filename: path.basename(file),
      data: (await fs.readFile(file)).toString('base64'),
    });
  });
}
