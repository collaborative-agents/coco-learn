import fs from 'fs';
import os from 'os';
import path from 'path';
import ToolChapterStore from './tool-chapter-progress';

it('persists the unlock only after all three goals and isolates accounts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-progress-'));
  try {
    const store = new ToolChapterStore(root);
    expect(store.hit('alice', 'approved').completedAt).toBeNull();
    expect(store.hit('alice', 'denied').completedAt).toBeNull();
    const passed = store.hit('alice', 'externalInformation');
    expect(passed.completedAt).toEqual(expect.any(String));
    expect(new ToolChapterStore(root).read('alice')).toEqual(passed);
    expect(store.hit('alice', 'approved').completedAt).toBe(passed.completedAt);
    expect(store.read('bob').completedAt).toBeNull();
    expect(store.read('bob').approved).toBe(false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it('does not report an unlock when saving fails', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-progress-'));
  try {
    const store = new ToolChapterStore(root);
    store.hit('alice', 'approved');
    store.hit('alice', 'denied');
    const write = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('Disk full');
    });
    expect(() => store.hit('alice', 'externalInformation')).toThrow(
      'Disk full',
    );
    write.mockRestore();
    expect(store.read('alice').completedAt).toBeNull();
  } finally {
    jest.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
