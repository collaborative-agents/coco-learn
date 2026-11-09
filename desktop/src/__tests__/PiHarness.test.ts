/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';
import PiHarness from '../main/services/pi-harness';

jest.mock('electron', () => ({ app: {} }));

const context = {
  model: 'test',
  scenario: 'everyday_support',
  problem: '',
  user_name: '',
  ai_tools: [],
  memory: '',
  messages: [],
};

describe('PiHarness tutor context failures', () => {
  const originalFetch = global.fetch;
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-pi-harness-'));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const run = (directory: string) => new PiHarness().run({
    requestId: 'request',
    sessionId: 'session',
    directory,
    tutorUrl: 'http://127.0.0.1:8081',
    token: 'test',
    text: 'Explain this article',
    images: [],
    context,
    emit: () => {},
  });

  it('reports incomplete service context before the agent runtime reads tools', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ model: 'test', instructions: 'Help', profile: '', history: [] }),
    });
    await expect(run(directory)).rejects.toThrow(/incomplete agent context/);
  });

  it('reports a stopped local service clearly', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(run(directory)).rejects.toThrow(/local tutor service is unavailable/);
  });
});
