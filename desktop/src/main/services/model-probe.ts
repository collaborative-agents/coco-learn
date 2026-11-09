import { spawn } from 'child_process';
export function runModelProbe(executable: string, args: string[], options: {cwd: string; env: NodeJS.ProcessEnv}, launch = spawn) {
  return new Promise<{code: number|null; stdout: string; stderr: string}>((resolve,reject)=>{
    const child=launch(executable,args,{...options,shell:false});
    let stdout='',stderr='';
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('The model check took too long. Check your connection and Retry.'));},15000);
    child.stdout?.on('data',chunk=>{stdout=(stdout+String(chunk)).slice(-32000)});
    child.stderr?.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-32000)});
    child.once('error',error=>{clearTimeout(timer);reject(error)});
    child.once('close',code=>{clearTimeout(timer);resolve({code,stdout,stderr})});
  });
}
export function modelFailureMessage(error: string) {
  if (/401|403|unauthorized|forbidden|expired|invalid.*key/i.test(error)) return 'Coco’s model access was refused. Sign out and sign in, then Retry.';
  if (/429|quota|rate.?limit/i.test(error)) return 'The model service has reached its usage limit. Wait a moment, then Retry.';
  if (/timed? ?out|took too long/i.test(error)) return 'The model service took too long to respond. Check your connection and Retry.';
  if (/urlopen|ENOTFOUND|ECONN|name.*known|connection.*refused|network/i.test(error)) return 'Coco couldn’t reach the model service. Check your internet connection and Retry.';
  if (/ModuleNotFound|No module named|could not.*python/i.test(error)) return 'Coco’s local Python files could not load. Repair the project environment, then Retry.';
  return error;
}
