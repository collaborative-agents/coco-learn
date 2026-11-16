/** @jest-environment node */
import ActiveRunClock from './active-run-clock';
afterEach(() => jest.useRealTimers());
it('excludes approval waits and handles concurrent approvals', () => {
  jest.useFakeTimers(); const done = jest.fn();
  const clock = new ActiveRunClock([{after:120000,action:done}]);
  jest.advanceTimersByTime(30000); clock.permission('one',true); clock.permission('two',true);
  jest.advanceTimersByTime(600000); expect(done).not.toHaveBeenCalled();
  clock.permission('one',false); jest.advanceTimersByTime(600000); expect(done).not.toHaveBeenCalled();
  clock.permission('two',false); jest.advanceTimersByTime(89999); expect(done).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1); expect(done).toHaveBeenCalledTimes(1); clock.stop();
});
it('extends the artwork deadline once without counting approval waits or reviving expired alarms',()=>{
 jest.useFakeTimers();const done=jest.fn();const clock=new ActiveRunClock([{after:120000,action:done}]);
 jest.advanceTimersByTime(10000);clock.permission('approval',true);clock.extendDeadline(120000);
 jest.advanceTimersByTime(600000);expect(done).not.toHaveBeenCalled();clock.permission('approval',false);
 jest.advanceTimersByTime(229999);expect(done).not.toHaveBeenCalled();jest.advanceTimersByTime(1);expect(done).toHaveBeenCalledTimes(1);
 clock.extendDeadline(10000);jest.advanceTimersByTime(10000);expect(done).toHaveBeenCalledTimes(1);clock.stop();
});
