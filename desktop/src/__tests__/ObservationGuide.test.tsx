import { fireEvent, render, screen } from '@testing-library/react';
import ObservationBubble from '../renderer/components/ObservationBubble';
it('lets the native bubble receive pointer input and routes the guide action',()=>{
  const enter=jest.fn(),leave=jest.fn(),help=jest.fn();
  render(<ObservationBubble bubble={{status:'observing',phrase:'Try your game.',fadingOut:false,guide:{label:'PLAY',action:'Try it'}}} onMouseEnter={enter} onMouseLeave={leave} onHelpMe={help}/>);
  const card=screen.getByText('Try your game.').closest('.observation-bubble')!;
  fireEvent.mouseEnter(card);expect(enter).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'Try it'}));expect(help).toHaveBeenCalledTimes(1);
  fireEvent.mouseLeave(card);expect(leave).toHaveBeenCalledTimes(1);
});
