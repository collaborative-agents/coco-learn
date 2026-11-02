import { cachedMaterials, loadMaterials } from './training-materials-cache';
import { cachedTaskBrief } from './task-brief-cache';
import extractPdfText from './extract-pdf-text';

jest.mock('./extract-pdf-text', () => ({
  __esModule: true,
  default: jest.fn(),
}));
const invoke = jest.fn();
const materials = (content: string) => ({
  documents: [
    { id: 'instructions.pdf', name: 'instructions.pdf', kind: 'pdf', content },
  ],
  files: [],
});
beforeEach(() => {
  jest.clearAllMocks();
  (window as any).electron = { ipcRenderer: { invoke } };
  (extractPdfText as jest.Mock).mockResolvedValue(
    'Task title\nTask overview\nDo the task.',
  );
});

it('shares prefetch with task opening and caches the parsed brief', async () => {
  const data = materials('shared-pdf');
  invoke.mockResolvedValue(data);
  const prefetch = loadMaterials('shared-user', 1, 'day.zip');
  const opening = loadMaterials('shared-user', 1, 'day.zip');
  expect(opening).toBe(prefetch);
  await opening;
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(extractPdfText).toHaveBeenCalledTimes(1);
  expect(cachedMaterials('shared-user', 1, 'day.zip')).toEqual(data);
  expect(cachedTaskBrief(data.documents[0] as any)?.title).toBe('Task title');
  await loadMaterials('shared-user', 1, 'day.zip');
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(extractPdfText).toHaveBeenCalledTimes(1);
});

it('separates accounts and changed material filenames', async () => {
  invoke.mockResolvedValue(materials('accounts-pdf'));
  await loadMaterials('account-a', 1, 'old.zip');
  expect(cachedMaterials('account-b', 1, 'old.zip')).toBeNull();
  await loadMaterials('account-b', 1, 'old.zip');
  await loadMaterials('account-a', 1, 'new.zip');
  expect(invoke).toHaveBeenCalledTimes(3);
});

it('retries failed downloads and PDF parsing rather than caching failures', async () => {
  invoke.mockRejectedValueOnce(new Error('Offline'));
  await expect(loadMaterials('retry-user', 1, 'day.zip')).rejects.toThrow(
    'Offline',
  );
  invoke.mockResolvedValue(materials('retry-pdf'));
  (extractPdfText as jest.Mock).mockRejectedValueOnce(
    new Error('Unreadable PDF'),
  );
  await expect(loadMaterials('retry-user', 1, 'day.zip')).rejects.toThrow(
    'Unreadable PDF',
  );
  await expect(
    loadMaterials('retry-user', 1, 'day.zip'),
  ).resolves.toBeDefined();
  expect(invoke).toHaveBeenCalledTimes(3);
});

it('refreshes expired materials and parses changed PDF content', async () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  try {
    invoke.mockResolvedValueOnce(materials('before-update'));
    await loadMaterials('expiry-user', 1, 'day.zip');
    now.mockReturnValue(1000 + 10 * 60 * 1000);
    expect(cachedMaterials('expiry-user', 1, 'day.zip')).toBeNull();
    invoke.mockResolvedValueOnce(materials('after-update'));
    await loadMaterials('expiry-user', 1, 'day.zip');
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(extractPdfText).toHaveBeenCalledTimes(2);
  } finally {
    now.mockRestore();
  }
});
