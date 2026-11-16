/** @jest-environment node */
import vm from 'vm';
import { gameHtml } from '../main/game/preview';
import theme from '../main/game/theme.json';
import type { GameTheme } from '../main/game/theme-data';

it('reports game controls from the generated HTML, but not pause or unrelated typing', () => {
  const listeners = new Map<string, (event: unknown) => void>();
  const postMessage = jest.fn();
  const html = gameHtml('', '', theme as GameTheme, 'version-1');
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)![1];
  vm.runInNewContext(script, {
    parent: { postMessage },
    addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener),
  });
  const target = (selector: string) => ({closest: (choices: string) => choices.split(',').includes(selector) ? {} : null});
  listeners.get('pointerdown')!({target:target('#pause')});
  listeners.get('keydown')!({target:target('input'),code:'Space',key:' '});
  expect(postMessage).not.toHaveBeenCalled();
  listeners.get('pointerdown')!({target:target('canvas')});
  listeners.get('pointerdown')!({target:target('#jump')});
  listeners.get('keydown')!({target:target('canvas'),code:'Space',key:' '});
  listeners.get('keydown')!({target:target('#duck'),code:'Enter',key:'Enter'});
  expect(postMessage).toHaveBeenCalledTimes(4);
  expect(postMessage).toHaveBeenLastCalledWith({type:'runner-game-input',version:'version-1'}, '*');
});
