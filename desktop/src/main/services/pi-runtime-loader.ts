import { pathToFileURL } from 'url';
import { spawn } from 'child_process';

const checked = new Map<string, Promise<void>>();
// Native ESM resolution can synchronously wait forever on cloud placeholders.
// Check it in a killable process before allowing that I/O on Electron's UI thread.
export function checkRuntimeFiles(runtimePath: string, launch = spawn) {
  return new Promise<void>((resolve, reject) => {
    const child = launch(process.execPath, [
      '--input-type=module', '-e',
      'await import(process.argv[1]); process.exit(0);',
      pathToFileURL(runtimePath).href,
    ], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['ignore', 'ignore', 'pipe'] });
    let detail = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Coco’s local agent files took too long to load. Keep this project downloaded or move it out of iCloud, then retry your message.'));
    }, 15000);
    child.stderr?.on('data', chunk => { detail = (detail + String(chunk)).slice(-2000); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Coco’s local agent files could not load. Run npm ci in desktop/release/app, then retry. ${detail}`));
    });
  });
}

// Keep the native ESM SDK outside the Electron webpack bundle.
export async function loadPiRuntime(runtimePath: string) {
  let check = checked.get(runtimePath);
  if (!check) {
    check = checkRuntimeFiles(runtimePath);
    checked.set(runtimePath, check);
    check.catch(() => checked.delete(runtimePath));
  }
  await check;
  return import(/* webpackIgnore: true */ pathToFileURL(runtimePath).href);
}
