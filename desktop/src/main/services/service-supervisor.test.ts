/** @jest-environment node */
import ServiceSupervisor from './service-supervisor';
it('starts an unavailable service, waits for real health, and recovers a dead process',async()=>{
  let now=100000,healthy=false;const start=jest.fn(),stop=jest.fn(async()=>{});
  const watch=new ServiceSupervisor({services:[{id:'tutor',enabled:()=>true}],probe:async()=>healthy,start,stop,report:jest.fn(),now:()=>now});
  await watch.tick();expect(start).toHaveBeenCalledTimes(1);
  now+=3000;await watch.tick();expect(start).toHaveBeenCalledTimes(1);
  healthy=true;await watch.tick();healthy=false;now+=3000;await watch.tick();expect(start).toHaveBeenCalledTimes(1);now+=3000;await watch.tick();expect(start).toHaveBeenCalledTimes(1);now+=3000;await watch.tick();expect(start).toHaveBeenCalledTimes(2);
  watch.dispose();
});
it('does not kill an established service after one slow probe and resets the failure streak on recovery',async()=>{
 let healthy=true;const start=jest.fn(),stop=jest.fn(async()=>{});const watch=new ServiceSupervisor({services:[{id:'tutor',enabled:()=>true}],probe:async()=>healthy,start,stop,report:jest.fn()});
 await watch.tick();healthy=false;await watch.tick();healthy=true;await watch.tick();healthy=false;await watch.tick();expect(stop).not.toHaveBeenCalled();expect(start).not.toHaveBeenCalled();
 await watch.retry();expect(start).toHaveBeenCalledTimes(1);watch.dispose();
});
it('respects intentional stops and lets Retry recover without a long cache',async()=>{
  let enabled=false;const start=jest.fn();const watch=new ServiceSupervisor({services:[{id:'sensing',enabled:()=>enabled}],probe:async()=>false,start,stop:async()=>{},report:jest.fn()});
  await watch.tick();expect(start).not.toHaveBeenCalled();enabled=true;await watch.retry();expect(start).toHaveBeenCalledTimes(1);watch.dispose();
});

it('allows slow cold starts without claiming health or repeatedly killing Python', async () => {
 let now=100000;const start=jest.fn(),stop=jest.fn(async()=>{}),report=jest.fn();
 const watch=new ServiceSupervisor({services:[{id:'sensing',enabled:()=>true}],probe:async()=>false,start,stop,report,now:()=>now});
 await watch.tick();
 now+=21000;await watch.tick();
 now+=21000;await watch.tick();
 expect(start).toHaveBeenCalledTimes(1);expect(stop).toHaveBeenCalledTimes(1);
 expect(report).toHaveBeenLastCalledWith('sensing','Starting Coco’s local service.');
 now+=21000;await watch.tick();expect(start).toHaveBeenCalledTimes(2);
 watch.dispose();
});
