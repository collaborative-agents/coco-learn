/** @jest-environment node */
import original from './theme.json';
import examples from './examples.json';
import presets from './presets.json';
import {applyThemePatch,validateTheme,describeThemeChanges,validatePlayerArtwork} from './theme-data';
it.each(examples)('validates the worked example: $request', example=>{ const next=applyThemePatch(original,example.changes);validateTheme(next); });
it('changes daylight without modifying the runner, obstacles or physics',()=>{const next=applyThemePatch(original,{timeOfDay:'day'});expect(next.background).not.toEqual(original.background);expect(next.player).toEqual(original.player);expect(next.physics).toEqual(original.physics);expect(next.obstacles).toEqual(original.obstacles)});
it('rejects malformed sprites and leaves the caller’s last working theme intact',()=>{const before=JSON.stringify(original);expect(()=>applyThemePatch(original,{player:{frames:[['xxxx','xxx','xxxx','xxxx']]}})).toThrow();expect(JSON.stringify(original)).toBe(before)});
it('rejects invalid physics, unknown fields, and unknown pixel symbols',()=>{for(const patch of [{physics:{gravity:-3}},{networkUrl:'https://example.com'},{player:{frames:[['????','????','????','????']]}}])expect(()=>applyThemePatch(original,patch)).toThrow()});
it('describes a background-only edit without inferring its time of day',()=>{const next=applyThemePatch(original,{background:{type:'solid',colors:['#aee7ff']}});expect(next.timeOfDay).toBe('night');const {summary}=describeThemeChanges(original,next);expect(summary).toContain('updated the sky and scenery');expect(summary).not.toContain('night sky');});
it.each(['morning','day','sunset','night'] as const)('keeps %s sky decorations consistent with the authored scene',time=>{const next=applyThemePatch(original,{timeOfDay:time});expect(next.scene.stars).toEqual(presets[time].scene.stars);expect(next.scene.clouds).toEqual(presets[time].scene.clouds);expect(next.scene.celestial.kind).toBe(presets[time].scene.celestial.kind);expect(next.scene.celestial.radius).toBe(presets[time].scene.celestial.radius);});

it.each(['cat', 'dog', 'rabbit', 'pig'])('keeps the %s preset at original scale and animation quality', name => {
  const next = applyThemePatch(original, { playerPreset: name });
  expect(() => validatePlayerArtwork(original, next)).not.toThrow();
  expect(next.player.frames).toHaveLength(4);
  expect(next.player.frames[0]).toHaveLength(26);
  expect(next.player.frames[0][0]).toHaveLength(34);
  expect(next.player.scale).toBe(original.player.scale);
});
it('rejects tiny replacement icons but permits background edits on legacy games', () => {
  const tiny = applyThemePatch(original, { player: { frames: [Array(10).fill('kkkkwwwwkkkk')], duck: Array(10).fill('kkkkwwwwkkkk') } });
  expect(() => validatePlayerArtwork(original, tiny)).toThrow('Player artwork needs repair');
  expect(() => validatePlayerArtwork(tiny, applyThemePatch(tiny, { timeOfDay: 'day' }))).not.toThrow();
});
it('keeps character scale unless the user asks for a size change', () => {
  const big = applyThemePatch(original, { playerPreset: 'pig', player: { scale: 4 } });
  expect(() => validatePlayerArtwork(original, big)).toThrow('footprint');
  expect(() => validatePlayerArtwork(original, big, 'make a bigger pig')).not.toThrow();
});

it('pads missing transparent row ends without changing authored pixels',()=>{
 const art=structuredClone(original.player.frames);
 art[0][0]=art[0][0].replace(/\.+$/,'');
 const next=applyThemePatch(original,{player:{frames:art}});
 expect(next.player.frames).toEqual(original.player.frames);
});
