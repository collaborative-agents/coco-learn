import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import RunnerGameView from '../renderer/components/getting-started/RunnerGameView';
import { runnerFourDPages } from '../shared/runner-tutorial';
import ObservationBubble from '../renderer/components/ObservationBubble';

const invoke = jest.fn();
beforeEach(() => {
  jest.useFakeTimers();
  invoke.mockReset().mockImplementation(async (channel: string) => channel === 'runner-preview' ? {
    state: { sessionId: 'game', version: 'v1', tour: 'active', phase: 'play', starterBuild: 'ready', introAcknowledged: true },
    html: '<html><body>Game</body></html>',
  } : {});
  Object.defineProperty(window, 'electron', { configurable: true, value: { ipcRenderer: { invoke, on: jest.fn(), sendMessage: jest.fn() } } });
});
afterEach(() => jest.useRealTimers());
const suggestions = () => invoke.mock.calls.filter(([channel, payload]) => channel === 'runner-action' && payload.action === 'game-suggestion');

it('offers both modification choices using the existing speech bubble buttons', () => {
  const customize = jest.fn(), later = jest.fn(), dismiss = jest.fn();
  render(<ObservationBubble bubble={{
    status:'observing', phrase:'Do you want to try modifying the game?', fadingOut:false,
    runnerTutorial:{sessionId:'game', action:'customize'},
    guide:{label:'KEEP EXPLORING', action:'Modify my game', secondaryAction:'finish-setup', secondaryActionLabel:'Explore on my own', dismissible:true},
  }} onHelpMe={customize} onSecondaryAction={later} onDismiss={dismiss} />);
  fireEvent.click(screen.getByRole('button', {name:'Modify my game'}));
  expect(customize).toHaveBeenCalledTimes(1);
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name:'Explore on my own'}));
  expect(later).toHaveBeenCalledTimes(1);
  expect(dismiss).not.toHaveBeenCalled();
  expect(customize).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', {name:'Close tip'}));
  expect(dismiss).toHaveBeenCalledTimes(1);
});

it('copies the example prompt without submitting it or dismissing Coco', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  const help = jest.fn(), dismiss = jest.fn();
  Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText}});
  const {rerender} = render(<ObservationBubble bubble={{
    status:'observing', phrase:'Try your own idea or copy this prompt.', fadingOut:false,
    runnerTutorial:{sessionId:'game', action:'dismiss'},
    guide:{label:'MAKE IT YOURS', prompt:'Change the fox into a cat.', action:'Got it', dismissible:true},
  }} onHelpMe={help} onDismiss={dismiss} />);
  await act(async () => fireEvent.click(screen.getByRole('button', {name:'Copy prompt'})));
  expect(writeText).toHaveBeenCalledWith('Change the fox into a cat.');
  expect(screen.getByRole('status')).toHaveTextContent('Copied prompt');
  expect(help).not.toHaveBeenCalled();
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name:'Got it'}));
  expect(help).toHaveBeenCalledTimes(1);
  rerender(<ObservationBubble bubble={{
    status:'observing', phrase:'Okay! I’ll leave you to explore.', fadingOut:false,
    runnerTutorial:{sessionId:'game', action:'dismiss'},
    guide:{label:'TAKE YOUR TIME', action:'Got it', dismissible:true},
  }} onHelpMe={help} />);
  expect(screen.queryByRole('button', {name:'Copy prompt'})).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('does not advance after loading or an unattended loss; waits for controls and a completed round', async () => {
  await act(async () => { render(<RunnerGameView embedded />); });
  const frame = screen.getByTitle('Your playable game') as HTMLIFrameElement;
  const send = (type:string, version = 'v1', source = frame.contentWindow) => {
    fireEvent(window, new MessageEvent('message', {source, data:{type, version, score:10}}));
  };
  const rounds = () => invoke.mock.calls.filter(([channel,payload]) => channel === 'runner-action' && payload.action === 'game-over');
  const inputs = () => invoke.mock.calls.filter(([channel,payload]) => channel === 'runner-action' && payload.action === 'game-input');
  fireEvent.load(frame);
  act(() => jest.advanceTimersByTime(30_000));
  expect(suggestions()).toHaveLength(0);
  send('runner-game-over');
  expect(rounds()).toHaveLength(0);
  send('runner-game-input', 'v1', window);
  send('runner-game-input', 'old-version');
  send('runner-game-over');
  expect(rounds()).toHaveLength(0);
  expect(inputs()).toHaveLength(0);
  send('runner-game-input');
  expect(inputs()).toEqual([['runner-action', {sessionId:'game', action:'game-input', version:'v1'}]]);
  expect(rounds()).toHaveLength(0);
  send('runner-game-over');
  expect(rounds()).toHaveLength(1);
});

it('lets readers flip through all four Ds in the same bubble before continuing', () => {
  const complete = jest.fn();
  render(<ObservationBubble bubble={{status:'observing',phrase:'While I build your game…',fadingOut:false,
    runnerTutorial:{sessionId:'game',action:'four-d-complete'},
    guide:{label:'THE 4Ds',pages:runnerFourDPages,action:'Got it',dismissible:true},
  }} onHelpMe={complete} />);
  expect(screen.getByText('Delegation')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'← Back'})).toBeDisabled();
  expect(screen.queryByRole('button',{name:'Got it'})).not.toBeInTheDocument();
  for (const title of ['Description','Discernment','Diligence']) {
    fireEvent.click(screen.getByRole('button',{name:'Next →'}));
    expect(screen.getByText(title)).toBeInTheDocument();
  }
  expect(screen.getByLabelText('Page 4 of 4')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'← Back'}));
  expect(screen.getByText('Discernment')).toBeInTheDocument();
  expect(complete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Next →'}));
  fireEvent.click(screen.getByRole('button',{name:'Got it'}));
  expect(complete).toHaveBeenCalledTimes(1);
});

it('uses the existing 4D explanation surface with the normal dismiss button', () => {
  const dismiss = jest.fn();
  const { container } = render(<ObservationBubble bubble={{ status: 'observing', phrase: '', fadingOut: false,
    runnerTutorial: { sessionId: 'game' }, scenario: 'ai_upskilling', suggestion: {
      kind: 'content', title: 'Make the game yours', body: 'Play a round.', copyText: 'Play a round.',
      fourDDimension: 'discernment', noticed: 'Sometimes I’ll offer suggestions as you work, like this one.',
      check: 'Try the game and think about how you’d make it yours.', why: 'Judge what AI makes.',
    },
  }} onDismiss={dismiss} />);
  expect(screen.getByText('Discernment')).toBeInTheDocument();
  expect(container.querySelector('.is-framework-overview .bubble-framework-overview')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show me how →' }));
  expect(screen.getByText('Play a round.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Chat with Coco' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '← Why' }));
  expect(screen.getByText('Discernment')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(dismiss).toHaveBeenCalledTimes(1);
});

it('rates advice with simple thumbs on both pages and records a correction once', () => {
  const sendMessage = window.electron.ipcRenderer.sendMessage as jest.Mock;
  render(<ObservationBubble bubble={{status:'observing',phrase:'Review the game',fadingOut:false,
    observationId:'rating-demo',scenario:'ai_upskilling',suggestion:{kind:'content',title:'Review the game',
      body:'Play a round.',copyText:'Play a round.',fourDDimension:'discernment',noticed:'Your game is ready.',check:'Try the controls.',why:'Check the result.'},
  }} />);
  fireEvent.click(screen.getByRole('button',{name:'Good suggestion'}));
  expect(screen.getByRole('button',{name:'Good suggestion'})).toHaveAttribute('aria-pressed','true');
  fireEvent.click(screen.getByRole('button',{name:'Good suggestion'}));
  fireEvent.click(screen.getByRole('button',{name:'Show me how →'}));
  expect(screen.getByRole('button',{name:'Good suggestion'})).toHaveAttribute('aria-pressed','true');
  fireEvent.click(screen.getByRole('button',{name:'Not helpful'}));
  expect(screen.getByRole('button',{name:'Not helpful'})).toHaveAttribute('aria-pressed','true');
  const ratings=sendMessage.mock.calls.filter(([channel])=>channel==='training-feedback');
  expect(ratings).toHaveLength(2);
  expect(ratings[0][1]).toMatchObject({kind:'thumbs_up',surface:'bubble',observation_id:'rating-demo'});
  expect(ratings[1][1]).toMatchObject({kind:'thumbs_down',previous_kind:'thumbs_up',surface:'bubble'});
});
