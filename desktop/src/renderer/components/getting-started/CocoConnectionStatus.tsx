import { useEffect, useRef, useState } from 'react';
import type { ServiceHealthView } from '../chat/types';

export default function CocoConnectionStatus({ quiet = false, onReady }: {quiet?:boolean; onReady?:(ready:boolean)=>void}) {
  const [checking,setChecking]=useState(true);
  const [detail,setDetail]=useState('Connecting to Coco…');
  const [ready,setReady]=useState(false);
  const callback = useRef(onReady); callback.current = onReady;
  const pending = useRef(false), alive = useRef(true), connected = useRef(false);
  const check=async(retry=false)=>{
    if (pending.current) return;
    pending.current=true;
    setChecking(true);
    try {
      if(retry){const result=await window.electron?.ipcRenderer.invoke('retry-services');if(result?.error)throw Error(result.error);}
      const health=await window.electron?.ipcRenderer.invoke('get-service-health',{forceModelTest:retry}) as ServiceHealthView|undefined;
      if(!health?.sensing||!health?.tutor)throw Error('Coco could not check its connection.');
      const failures=[['Sensing',health.sensing],['Tutor',health.tutor]] as const;
      const issues=failures.filter(([,h])=>!h.connected||h.modelAssessment?.status!=='verified');
      if (!alive.current) return;
      connected.current=issues.length===0;
      setReady(connected.current); callback.current?.(connected.current);
      setDetail(issues.length?issues.map(([name,h])=>`${name}: ${!h.connected ? h.detail||'The local service is not ready.' : h.modelAssessment?.detail||'The model needs a connection check.'}`).join(' '):'Coco is connected to your account and ready.');
    } catch(error){if(alive.current){connected.current=false;setReady(false);callback.current?.(false);setDetail(error instanceof Error?error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''):'Coco could not connect. Retry to try again.');}}
    finally{pending.current=false;if(alive.current)setChecking(false);}
  };
  useEffect(()=>{alive.current=true;void check();let elapsed=0;const timer=setInterval(()=>{elapsed+=2;if(!connected.current||elapsed>=30){elapsed=0;void check();}},2000);return()=>{alive.current=false;clearInterval(timer)}},[]);
  if (quiet && ready) return null;
  return <div className={`coco-connection-status ${ready?'is-ready':''}`} role="status"><span>{checking&&!ready?'Connecting to Coco…':detail}</span>{!ready&&<button type="button" className="coco-button" disabled={checking} onClick={()=>void check(true)}>{checking?'Checking…':'Retry'}</button>}</div>;
}
