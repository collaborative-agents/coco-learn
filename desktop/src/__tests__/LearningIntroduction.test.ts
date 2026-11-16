import { learningIntroduction, nextLearningStep } from '../shared/learning-introduction';

it('starts with a separate welcome before introducing Training', () => {
  const welcome = learningIntroduction('setup', 'welcome');
  expect(welcome).toMatchObject({text:'Welcome to Coco! Let me show you around.',actionLabel:'Let’s get started',action:'show-around'});
  expect(welcome.highlight).toBeUndefined();
  expect(nextLearningStep('welcome', 'tool-opened')).toBeNull();
  expect(nextLearningStep('welcome', 'training-understood')).toBe('training');
  expect(learningIntroduction('setup', 'training').text).not.toContain('Welcome');
});

it('waits for each real action before guiding Tool → Side quest → New', () => {
  let step = nextLearningStep('training', 'training-understood');
  expect(step).toBe('tool');
  expect(learningIntroduction('setup', step!)).toMatchObject({highlight:'tool'});
  // A stale success from another quest cannot skip opening Tool.
  expect(nextLearningStep(step!, 'side-quest-started')).toBeNull();
  step = nextLearningStep(step!, 'tool-opened');
  expect(step).toBe('side-quest');
  expect(learningIntroduction('setup', step!)).toMatchObject({highlight:'side-quest'});
  expect(nextLearningStep(step!, 'training-understood')).toBeNull();
  step = nextLearningStep(step!, 'side-quest-started');
  // First explain the side quest page itself, then point to New.
  expect(step).toBe('side-quest-intro');
  const intro = learningIntroduction('setup', step!);
  expect(intro).toMatchObject({label:'TOOL SIDE QUEST', action:'show-around', actionLabel:'Got it'});
  expect(intro.highlight).toBeUndefined();
  expect(nextLearningStep(step!, 'side-quest-started')).toBeNull();
  step = nextLearningStep(step!, 'training-understood');
  expect(step).toBe('new');
  expect(learningIntroduction('setup', step!)).toMatchObject({highlight:'new', text:expect.stringContaining('Click New')});
  expect(nextLearningStep(step!, 'side-quest-started')).toBeNull();
  expect(nextLearningStep(undefined, 'tool-opened')).toBeNull();
});
