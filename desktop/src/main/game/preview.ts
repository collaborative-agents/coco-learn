import type { GameTheme } from './theme-data';
import { resolveTheme } from './theme-data';
import controlsStyle from './game-controls.json';
export function gameHtml(
  engine: string,
  behavior: string,
  theme: GameTheme,
  version: string,
  best = 0,
) {
  theme = resolveTheme(theme);
  if (/\bimport\b|\bexport\s+(?:default|\{)/.test(behavior))
    throw Error(
      'Unsupported behavior import or export. Use the three named hooks.',
    );
  const code = behavior.replace(
    /\bexport\s+(?=(?:async\s+)?(?:function|const|let)\b)/g,
    '',
  );
  const script =
    `globalThis.__cocoTheme=${JSON.stringify(theme)};globalThis.__cocoVersion=${JSON.stringify(version)};globalThis.__cocoBest=${best};globalThis.__cocoHooks=(()=>{${code}\nreturn {onStep:typeof onStep==='function'?onStep:undefined,onJump:typeof onJump==='function'?onJump:undefined,onHit:typeof onHit==='function'?onHit:undefined};})();\n${engine}`.replace(
      /<\/script/gi,
      '<\\/script',
    );
  const flying = theme.controls?.mode === 'fly';
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';"><style>${controlsStyle}</style></head><body><canvas width="960" height="420" tabindex="0" aria-label="Your game. ${flying ? 'Hold Space to fly, release to fall' : 'Space to jump, Down to duck'}"></canvas><nav><button id="jump">${flying ? 'Fly' : 'Jump'} <kbd>Space</kbd></button><button id="duck">${flying ? 'Descend' : 'Duck'} <kbd>↓</kbd></button><button id="pause">Pause</button></nav><script type="module">${script}</script></body></html>`;
}
