import '@testing-library/jest-dom';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import RunnerGameView from '../renderer/components/getting-started/RunnerGameView';
import GamePage from '../renderer/components/getting-started/GamePage';
import TourProgress from '../renderer/components/getting-started/TourProgress';
import type {RunnerTutorialState} from '../shared/runner-tutorial';
const state:RunnerTutorialState={sessionId:'game',version:'v1',phase:'play',tour:'meet',hasChanges:false,canUndo:false,error:null};
it('does not render a setup page while the introduction happens in chat', async () => {
 const invoke=jest.fn(async()=>({state,html:'<p>game</p>'}));
 (window as any).electron={ipcRenderer:{invoke,on:()=>()=>{}}};
 const {container}=render(<RunnerGameView embedded/>);
 await waitFor(()=>expect(invoke).toHaveBeenCalledWith('runner-preview'));
 expect(container.querySelector('h1')).toBeNull();
 expect(screen.queryByText('Next')).not.toBeInTheDocument();
 expect(screen.queryByTitle('Your playable game')).not.toBeInTheDocument();
});
it('gates customization until the first game over',()=>{
 const action=jest.fn();const {rerender}=render(<GamePage title="Meadow" timeOfDay="day" html="" canCustomize={false} onAction={action}/>);
 fireEvent.click(screen.getByRole('button',{name:'Make it yours'}));expect(action).not.toHaveBeenCalled();
 expect(screen.getByText('Play a round to unlock')).toBeInTheDocument();
 rerender(<GamePage title="Meadow" timeOfDay="day" html="" canCustomize inviteCustomize onAction={action}/>);
 fireEvent.click(screen.getByRole('button',{name:'Make it yours'}));expect(action).toHaveBeenCalledWith('customize');
});
it('explains all three review actions',()=>{
 render(<GamePage title="Meadow" timeOfDay="day" html="" updated/>);
 for(const caption of ['Go back','Tell Coco what to change','Finish when happy'])expect(screen.getByText(caption)).toBeInTheDocument();
});
it('shows the current chat step and lets users skip',()=>{
 const skip=jest.fn();render(<TourProgress state={{...state,tour:'active',phase:'writing'}} onSkip={skip}/>);
 expect(screen.getByText('Make it yours')).toHaveAttribute('aria-current','step');
 fireEvent.click(screen.getByRole('button',{name:'Leave task'}));expect(skip).toHaveBeenCalledTimes(1);
});
it('hides tour navigation after completion or skipping',()=>{
 const {rerender}=render(<TourProgress state={{...state,tour:'finished'}} onSkip={()=>{}}/>);expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
 rerender(<TourProgress state={{...state,tour:'skipped'}} onSkip={()=>{}}/>);expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
