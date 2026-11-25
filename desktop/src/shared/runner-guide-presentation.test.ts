import presentRunnerGuide, { isAnchoredLearningGuide } from './runner-guide-presentation';
import { learningIntroduction } from './learning-introduction';
import type { RunnerGuide } from './runner-tutorial';

const guide: RunnerGuide = {sessionId:'game',label:'WELCOME BACK',text:'Your game is ready.',action:'focus',actionLabel:'Back to my idea'};
const chat = {sessionId:'game',inChat:true,visible:true,focused:true};

it('keeps coaching text but hides the return action in the current game chat',()=>{
  const shown=presentRunnerGuide(guide,chat);
  expect(shown.text).toBe(guide.text);
  expect(shown.action).toBeUndefined();
  expect(shown.actionLabel).toBeUndefined();
  expect(guide.actionLabel).toBe('Back to my idea');
});
it.each([
  {...chat,inChat:false},
  {...chat,sessionId:'different-chat'},
  {...chat,sessionId:null},
  {...chat,visible:false},
  {...chat,focused:false},
])('keeps the return action when the game composer is elsewhere: %j',view=>{
  expect(presentRunnerGuide(guide,view).actionLabel).toBe('Back to my idea');
});
it.each(['retry','play','customize','finish'] as const)('keeps the useful %s action in chat',action=>{
  expect(presentRunnerGuide({...guide,action,actionLabel:'Take the next step'},chat).action).toBe(action);
});

it('anchors the Training and Agent 101 overview tips while retaining floating tips for other steps', () => {
  expect(isAnchoredLearningGuide(learningIntroduction('setup', 'training'))).toBe(true);
  expect(isAnchoredLearningGuide(learningIntroduction('setup', 'tool'))).toBe(true);
  for (const step of ['welcome', 'side-quest', 'side-quest-intro', 'new'] as const) {
    expect(isAnchoredLearningGuide(learningIntroduction('setup', step))).toBe(false);
  }
  expect(isAnchoredLearningGuide({ ...guide, highlight: 'tool' })).toBe(false);
});
