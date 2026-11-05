/** @jest-environment node */
import AgentRuns from '../main/services/agent-runs';
import PiHarness from '../main/services/pi-harness';
// Jest inspects the real harness when generating its mock. CI deliberately
// installs with --ignore-scripts, so importing Electron must not load a binary.
jest.mock('electron', () => ({ app: {} }));
jest.mock('../main/services/pi-harness');

describe('concurrent execution registry', () => {
  it('isolates runtimes and rejects only a second run in the same conversation', async () => {
    const runs = new AgentRuns();
    runs.begin('a', 'ra');
    runs.begin('b', 'rb');
    const a = runs.get('a');
    const b = runs.get('b');
    expect(a).not.toBe(b);
    expect(runs.get('a')).toBe(a);
    expect(() => runs.begin('a', 'ra2')).toThrow(/already working/);
    await runs.abort('ra');
    expect(a.abort).toHaveBeenCalledWith('ra');
    expect(b.abort).not.toHaveBeenCalled();
    runs.answer('rb', 'same-tool-id', { answers: ['B'] });
    expect(b.answerQuestion).toHaveBeenCalledWith('same-tool-id', {
      answers: ['B'],
    });
    expect(a.answerQuestion).not.toHaveBeenCalled();
    expect(() => runs.answer('ra', 'same-tool-id', {})).toThrow(
      /no longer active/,
    );
    runs.finish('ra');
    expect(runs.has('b')).toBe(true);
    runs.begin('a', 'ra2');
    await runs.dispose();
    expect(a.dispose).toHaveBeenCalled();
    expect(b.dispose).toHaveBeenCalled();
  });

  it('keeps legacy coaching exclusive', () => {
    const runs = new AgentRuns(() => new PiHarness());
    runs.begin('a', 'ra', true);
    expect(() => runs.begin('b', 'rb')).toThrow(/practice suggestion/);
  });
  it('revokes every runtime using the folder without affecting other folders', async () => {
    const runs = new AgentRuns();
    const a = runs.get('a');
    const b = runs.get('b');
    const c = runs.get('c');
    jest.mocked(a.usesWorkspace).mockReturnValue(true);
    jest.mocked(b.usesWorkspace).mockReturnValue(true);
    jest.mocked(c.usesWorkspace).mockReturnValue(false);
    await runs.revokeWorkspace('/workspace');
    expect(a.revokeWorkspaceAccess).toHaveBeenCalledWith('/workspace');
    expect(b.revokeWorkspaceAccess).toHaveBeenCalledWith('/workspace');
    expect(c.revokeWorkspaceAccess).not.toHaveBeenCalled();
  });

});
