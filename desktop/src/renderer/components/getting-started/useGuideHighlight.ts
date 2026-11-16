import { useEffect, useRef, useState } from 'react';
import type { RunnerGuide, RunnerTutorialState } from '../../../shared/runner-tutorial';

type Highlight = RunnerGuide['highlight'];
type Instruction = Pick<RunnerGuide, 'sessionId' | 'instructionId' | 'highlight'>;

export default function useGuideHighlight(sessionId: string | null, runner: RunnerTutorialState | null) {
  const [guide, setGuide] = useState<Instruction | null>(null);
  const consumed = useRef(new Set<string>());
  const [, refresh] = useState(0);
  useEffect(() => {
    const off = window.electron?.ipcRenderer.on('runner-guide-highlight', value => {
      setGuide(value as Instruction | null);
    });
    window.electron?.ipcRenderer.sendMessage('runner-guide-highlight-ready');
    return () => { off?.(); };
  }, []);
  const instructionKey = guide?.instructionId ?? `${guide?.sessionId}:${guide?.highlight}`;
  const workspaceKey = `workspace:${runner?.sessionId}`;
  const globalTarget = guide?.highlight && ['training', 'tool', 'side-quest', 'new'].includes(guide.highlight);
  let target: Highlight;
  if (guide?.highlight && !consumed.current.has(instructionKey) &&
      (globalTarget || guide.sessionId === sessionId)) target = guide.highlight;
  else if (runner?.sessionId === sessionId && runner?.tour === 'meet' &&
      runner.starterBuild === 'waiting' && !runner.selectedStarterDirectory &&
      !consumed.current.has(workspaceKey)) target = 'workspace';

  const onControlUsed = (used: Highlight) => {
    if (!used || used !== target) return;
    // Clear on click, including a canceled folder picker or a failed request.
    if (used === 'workspace') consumed.current.add(workspaceKey);
    if (guide?.highlight === used) {
      consumed.current.add(instructionKey);
      window.electron?.ipcRenderer.sendMessage('runner-guide-control-used', {
        instructionId: guide.instructionId, target: used,
      });
    }
    refresh(value => value + 1);
  };
  return { target, onControlUsed };
}
