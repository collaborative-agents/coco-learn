/** @jest-environment node */
import { EventEmitter } from 'events';
import { checkRuntimeFiles } from './pi-runtime-loader';

function child() {
  return Object.assign(new EventEmitter(), { stderr: new EventEmitter(), kill: jest.fn() });
}
afterEach(() => jest.useRealTimers());
it('bounds a blocked native dependency import and gives actionable guidance', async () => {
  jest.useFakeTimers();
  const proc = child();
  const launch = jest.fn(() => proc);
  const check = checkRuntimeFiles('/game/pi-runtime.mjs', launch as never);
  const failure = expect(check).rejects.toThrow('Keep this project downloaded');
  jest.advanceTimersByTime(15000);
  await failure;
  expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
});
it('preserves a real loader error instead of reporting a running agent', async () => {
  const proc = child();
  const check = checkRuntimeFiles('/game/pi-runtime.mjs', (() => proc) as never);
  proc.stderr.emit('data', 'ERR_MODULE_NOT_FOUND: dependency');
  proc.emit('close', 1);
  await expect(check).rejects.toThrow('ERR_MODULE_NOT_FOUND');
});
