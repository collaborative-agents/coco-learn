import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import RunnerPromptSuggestions from '../renderer/components/getting-started/RunnerPromptSuggestions';
import { runnerSuggestedPrompts } from '../shared/runner-tutorial';

it('offers three editable ideas and only inserts the one the user selects',()=>{
  const choose=jest.fn();render(<RunnerPromptSuggestions onChoose={choose}/>);
  expect(choose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:/^Make a flying version, so I can fly/}));
  expect(choose).toHaveBeenCalledTimes(1);expect(choose).toHaveBeenCalledWith(runnerSuggestedPrompts[1]);
});
it('does not replace the user’s composer content when copying an example',async()=>{
  const copy=jest.fn().mockResolvedValue(undefined),choose=jest.fn();Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:copy}});
  render(<RunnerPromptSuggestions onChoose={choose}/>);
  fireEvent.click(screen.getByRole('button',{name:`Copy prompt: ${runnerSuggestedPrompts[0]}`}));
  expect(copy).toHaveBeenCalledWith(runnerSuggestedPrompts[0]);expect(choose).not.toHaveBeenCalled();
  expect(await screen.findByText('Copied!')).toBeInTheDocument();
});
it('keeps the examples inactive while the agent is working',()=>{
  const choose=jest.fn();render(<RunnerPromptSuggestions disabled onChoose={choose}/>);
  for(const button of screen.getAllByRole('button'))expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:/^Change it to a daylight game!/}));expect(choose).not.toHaveBeenCalled();
});
