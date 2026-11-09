import '@testing-library/jest-dom';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import RunnerGameView from '../renderer/components/getting-started/RunnerGameView';
import GamePage from '../renderer/components/getting-started/GamePage';
import TourProgress from '../renderer/components/getting-started/TourProgress';
import type {RunnerTutorialState} from '../shared/runner-tutorial';
const state:RunnerTutorialState={sessionId:'game',version:'v1',phase:'play',tour:'meet',hasChanges:false,canUndo:false,error:null};
it('waits for both service and model reports while leaving Skip available',async()=>{
 let ready=false;
 const invoke=jest.fn(async(channel:string):Promise<any>=>channel==='runner-preview'?{state,html:'<p>game</p>',title:'Meadow',timeOfDay:'day'}:channel==='get-service-health'?{sensing:{connected:true,modelAssessment:{status:'verified'}},tutor:{connected:ready,detail:'Service is starting',modelAssessment:{status:ready?'verified':'connecting'}}}:{});
 (window as any).electron={ipcRenderer:{invoke,on:()=>()=>{}}};
 render(<RunnerGameView/>);
 expect(await screen.findByRole('button',{name:'Let’s play'})).toBeDisabled();
 expect(screen.queryByRole('button',{name:'Why do you pop up?'})).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Leave task'})).toBeEnabled();
 await waitFor(()=>expect(screen.getByRole('button',{name:'Retry'})).toBeEnabled());ready=true;
 fireEvent.click(screen.getByRole('button',{name:'Retry'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Let’s play'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Let’s play'}));
 expect(invoke).toHaveBeenCalledWith('runner-action',{sessionId:'game',action:'tour-play'});
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
