/** @jest-environment node */
import { EventEmitter } from 'events';
import { runModelProbe, modelFailureMessage } from './model-probe';
it('kills a stuck probe at 15 seconds instead of allowing a 60-second hang',async()=>{
  jest.useFakeTimers();const child=Object.assign(new EventEmitter(),{stdout:new EventEmitter(),stderr:new EventEmitter(),kill:jest.fn()});
  const promise=runModelProbe('python',[],{cwd:'/tmp',env:{}},jest.fn(()=>child) as any);
  const failure=expect(promise).rejects.toThrow('took too long');jest.advanceTimersByTime(15000);await failure;
  expect(child.kill).toHaveBeenCalledWith('SIGKILL');jest.useRealTimers();
});
it('reports access refusal plainly without claiming a working connection',()=>{
  expect(modelFailureMessage('HTTP Error 401: Unauthorized')).toContain('Sign out and sign in');
  expect(modelFailureMessage('Connection refused')).toContain('couldn’t reach');
});
