import fs from 'fs';
import path from 'path';

const members = ['sensing', 'proactive_tutor', 'external_api', 'py_utils', 'memory', 'memory_mcp'];
/** App launch must execute the installed environment, never run dependency resolution. */
export function developmentPython(root: string) {
  const executable = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  if (!fs.existsSync(executable)) throw new Error('Coco’s Python environment is missing. Run uv sync once in the project folder, then Retry.');
  return executable;
}
export function pythonEnvironment(root: string, env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  // Framework Python on macOS can have no default CA file. Use the installed
  // certifi trust bundle for this app, preserving explicit user configuration.
  const library = path.join(root, '.venv', process.platform === 'win32' ? 'Lib' : 'lib');
  const candidates = process.platform === 'win32' ? [library]
    : fs.existsSync(library) ? fs.readdirSync(library).filter(name=>name.startsWith('python')).map(name=>path.join(library,name)) : [];
  const certificate = candidates.map(directory=>path.join(directory,'site-packages','certifi','cacert.pem')).find(file=>fs.existsSync(file));
  return { ...env, ...(env.SSL_CERT_FILE || !certificate ? {} : {SSL_CERT_FILE:certificate}),
    PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1', LITELLM_LOCAL_MODEL_COST_MAP: 'True',
    PYTHONPATH: [...members.map(member => path.join(root, 'lib', member)), env.PYTHONPATH].filter(Boolean).join(path.delimiter) };
}
