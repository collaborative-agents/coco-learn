import type { RunnerGuide } from './runner-tutorial';

export type LearningStep = NonNullable<RunnerGuide['learningStep']>;
export type LearningEvent = 'training-understood' | 'tool-opened' | 'side-quest-started';

/** Advance only from the expected action; merely clicking Start is not success. */
export function nextLearningStep(step: LearningStep | undefined, event: LearningEvent): LearningStep | null {
  if (step === 'welcome' && event === 'training-understood') return 'training';
  if (step === 'training' && event === 'training-understood') return 'tool';
  if (step === 'tool' && event === 'tool-opened') return 'side-quest';
  if (step === 'side-quest' && event === 'side-quest-started') return 'side-quest-intro';
  if (step === 'side-quest-intro' && event === 'training-understood') return 'new';
  return null;
}

export function learningIntroduction(sessionId: string, step: LearningStep | 'agent101'): RunnerGuide {
  const learningStep = step === 'agent101' ? 'tool' : step;
  const base = { sessionId, learningStep, milestone: 'show-around' as const };
  switch (learningStep) {
    case 'welcome':
      return {
        ...base, label: 'WELCOME TO COCO',
        text: 'Welcome to Coco! Let me show you around.',
        action: 'show-around', actionLabel: 'Let’s get started',
      };
    case 'training':
      return {
        ...base, highlight: 'training', label: 'TRAINING TASKS',
        text: 'Training tasks are where you build real skills for working with agents. Short check-ins before and after show you how much you’ve grown.',
        action: 'show-around', actionLabel: 'Got it',
      };
    case 'tool':
      return {
        ...base, highlight: 'tool', label: 'AGENT 101 · OPTIONAL SIDE QUEST',
        text: 'You can see what an agent is doing on your behalf with Agent 101. Click Tool for a quick introduction.',
      };
    case 'side-quest':
      return {
        ...base, highlight: 'side-quest', label: 'TAKE A PEEK INSIDE',
        text: 'You can try out what you just learned in a side quest. Click Side quest to practice. You can come back here anytime.',
      };
    case 'side-quest-intro':
      return {
        ...base, label: 'TOOL SIDE QUEST',
        text: 'This is your Tool side quest. You ask Coco the same question with and without tools, side by side, to see what tools let an agent actually do for you. Follow the three steps at the top, including approving and denying a tool call.',
        action: 'show-around', actionLabel: 'Got it',
      };
    case 'new':
      return {
        ...base, highlight: 'new', label: 'YOUR TURN TO CREATE',
        text: 'Next, see what an agent can do when it works alongside you. Click New to start a hands-on session where Coco builds something with you. This side quest stays open in its tab, so you can come back anytime.',
      };
  }
}
