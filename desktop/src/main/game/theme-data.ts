import Ajv from 'ajv';
import schema from './theme.schema.json';
import presets from './presets.json';
import artPresets from './art-presets.json';
export const themeSchema = schema;
export function resolveTheme(value: GameTheme): GameTheme {
  const preset = presets[value.timeOfDay as keyof typeof presets] ?? presets.night;
  const t = { ...value, scene: structuredClone(value.scene ?? preset.scene), controls: value.controls ?? { mode: 'run', lift: 2400, riseSpeed: 320 } };
  t.scene.sky = [...t.background.colors];
  t.scene.ground.grass = [t.ground.top, t.ground.grass, t.scene.ground.grass[2]];
  t.scene.ground.soil = [t.ground.soil, t.ground.speckle, t.scene.ground.soil[2]];
  t.scene.hud.text = t.textColor;
  t.scene.hud.startLabel ??= preset.scene.hud.startLabel;
  const celestial = t.decorations.find(d => d.kind === 'sun' || d.kind === 'moon');
  t.scene.celestial.radius = celestial ? celestial.size * 2 / 3 : 0;
  if (celestial) Object.assign(t.scene.celestial, { kind: celestial.kind, color: celestial.color, x: celestial.x / 100, y: celestial.y / 100 });
  const clouds = t.decorations.find(d => d.kind === 'clouds');
  t.scene.clouds.count = clouds?.count ?? 0;
  if (clouds) Object.assign(t.scene.clouds, { color: clouds.color, shade: clouds.accent, speed: clouds.speed });
  const stars = t.decorations.find(d => d.kind === 'stars');
  t.scene.stars.count = stars?.count ?? 0;
  if (stars) t.scene.stars.color = stars.color;
  return t;
}
const validate = new Ajv({ allErrors: true, jsonPointers: true }).compile(
  schema,
);
type BaseTheme = typeof import('./theme.json');
export type GameTheme = Omit<BaseTheme, 'scene'> & {
  scene: Omit<BaseTheme['scene'], 'layers'> & { layers: Array<{
    kind: string; speed: number; height: number; colors: string[]; seed: number;
    trunk?: string; capColor?: string; capDepth?: number; scale?: number; density?: number;
  }> };
};
export function validateTheme(value: unknown): asserts value is GameTheme {
  if (!validate(value))
    throw new Error(
      (validate.errors ?? [])
        .slice(0, 5)
        .map((e) => `theme${e.dataPath} ${e.message}`)
        .join('; '),
    );
  const t = value as GameTheme;
  if (t.physics.maxSpeed < t.physics.speed)
    throw Error('theme.physics.maxSpeed must be at least speed');
  const ids = new Set<string>();
  const grids = [...t.player.frames, t.player.duck];
  for (const o of t.obstacles) {
    if (ids.has(o.id)) throw Error('Obstacle IDs must be unique');
    ids.add(o.id);
    grids.push(...o.frames);
  }
  for (const rows of grids) {
    if (!rows.some((row) => [...row].some((c) => c !== '.' && c !== ' ')))
      throw Error('A sprite must contain visible pixels');
    if (rows.some((row) => row.length !== rows[0].length))
      throw Error('Each sprite grid must be rectangular');
    for (const row of rows)
      for (const c of row) {
        if (c !== '.' && c !== ' ' && !Object.hasOwn(t.spritePalette, c))
          throw Error(
            `Sprite uses unknown palette symbol ${JSON.stringify(c)}`,
          );
      }
  }
  for (const sprite of [t.player, ...t.obstacles]) {
    if (
      sprite.frames.some(
        (f) =>
          f.length !== sprite.frames[0].length ||
          f[0].length !== sprite.frames[0][0].length,
      )
    )
      throw Error('Animation frames for a sprite must have the same size');
  }
}
/** Apply only when artwork is replaced; legacy art remains usable for other edits. */
export function validatePlayerArtwork(before: GameTheme, after: GameTheme, request = '') {
  if (JSON.stringify(before.player.frames) === JSON.stringify(after.player.frames)) return;
  // Respect deliberate requests for a smaller or simpler character.
  const resize = /\b(?:tiny|smaller|larger|bigger|giant|miniature|resize)\b/i.test(request);
  const simple = /\b(?:minimalist|silhouette|monochrome|low.detail|simplify)\b/i.test(request);
  const { frames, scale, duck } = after.player;
  const height = frames[0].length, width = frames[0][0].length;
  const colors = new Set(frames.flat().join('').split('').filter(c => c !== '.' && c !== ' ').map(c => after.spritePalette[c as keyof typeof after.spritePalette]));
  const issues: string[] = [];
  if (!simple && (width < 24 || height < 20 || colors.size < 5))
    issues.push('use a detailed grid (at least 24×20 with 5 distinct colors), including outline, shading, highlights and facial features');
  if (!resize && (width * scale < 82 || width * scale > 122 || height * scale < 62 || height * scale > 94))
    issues.push('keep the original runner footprint: prefer 34×26 pixels at scale 3');
  if (new Set(frames.map(f => JSON.stringify(f))).size < 2)
    issues.push('draw at least two distinct running poses, preferably four frames');
  if (duck.length >= height)
    issues.push('draw a shorter crouching pose for ducking');
  if (issues.length) throw Error('Player artwork needs repair: ' + issues.join('; ') + '. Use playerPreset cat, dog, rabbit or pig for finished animated artwork, or improve the custom grids.');
}

function merge(base: any, patch: any): any {
  if (!patch || Array.isArray(patch) || typeof patch !== 'object')
    return structuredClone(patch);
  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key))
      throw Error('Invalid theme key');
    result[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? merge(base?.[key], value)
        : structuredClone(value);
  }
  return result;
}
export function applyThemePatch(
  current: GameTheme,
  changes: unknown,
): GameTheme {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes))
    throw Error('changes must be a theme object');
  let base: GameTheme = structuredClone(current);
  const patch=structuredClone(changes) as Record<string,unknown>;
  if (patch.behaviorPreset) {
    if (!['flight','run'].includes(String(patch.behaviorPreset))) throw Error('Unknown game behavior preset');
    base = { ...base, controls: { ...(base.controls ?? {lift:2400,riseSpeed:320}), mode: patch.behaviorPreset === 'flight' ? 'fly' : 'run' } };
    delete patch.behaviorPreset;
  }
  if(patch.playerPreset){
    const name=String(patch.playerPreset);if(!Object.hasOwn(artPresets.players,name))throw Error('Unsupported character preset. Draw a custom player grid instead.');
    const art=artPresets.players[name as keyof typeof artPresets.players];base={...base,player:structuredClone(art.player),spritePalette:{...base.spritePalette,...art.spritePalette}};delete patch.playerPreset;
  }
  if(patch.obstaclePreset){
    const name=String(patch.obstaclePreset);if(!Object.hasOwn(artPresets.obstacles,name))throw Error('Unsupported obstacle preset. Draw a custom obstacle grid instead.');
    base={...base,obstacles:structuredClone(artPresets.obstacles[name as keyof typeof artPresets.obstacles])};delete patch.obstaclePreset;
  }
  changes=patch;
  const time = (changes as { timeOfDay?: string }).timeOfDay;
  if (time && Object.hasOwn(presets, time)) {
    const preset = presets[time as keyof typeof presets];
    base = {
      ...base,
      background: preset.background,
      textColor: preset.textColor,
      decorations: preset.decorations,
      scene: preset.scene,
      ground: preset.ground,
      title: Object.values(presets).some(p => p.title === current.title) || current.title === 'Moonlit Run' ? preset.title : current.title,
    };
  }
  const result = resolveTheme(merge(base, changes));
  // Pixel rows often omit trailing transparent cells. Pad only to the longest
  // row; never trim, scale, recolor, or invent visible pixels. The schema and
  // visual reviewer still check the resulting artwork.
  const pad = (frames: unknown) => {
    if (!Array.isArray(frames) || !frames.length || frames.some(f => !Array.isArray(f) || !f.length || f.some(row => typeof row !== 'string'))) return;
    const width = Math.max(...frames.flat().map(row => row.length));
    if (width > 48) return;
    for (const frame of frames) for (let i = 0; i < frame.length; i++) frame[i] = frame[i].padEnd(width, '.');
  };
  if ((changes as {player?:unknown}).player) {
    pad(result.player?.frames);
    if (result.player?.duck) pad([result.player.duck]);
  }
  validateTheme(result);
  return result;
}
export function describeThemeChanges(before: GameTheme, after: GameTheme) {
  const changed = Object.keys(after).filter(
    (key) =>
      JSON.stringify(before[key as keyof GameTheme]) !==
      JSON.stringify(after[key as keyof GameTheme]),
  );
  const details = [
    changed.includes('timeOfDay')
      ? `painted a ${after.timeOfDay} sky`
      : changed.some((k) => ['background', 'decorations'].includes(k)) &&
        'updated the sky and scenery',
    changed.includes('weather') && `set the weather to ${after.weather.kind}`,
    changed.includes('player') && `drew ${after.player.name} as the runner`,
    changed.includes('obstacles') &&
      `changed the obstacles to ${after.obstacles.map((o) => o.name).join(', ')}`,
    changed.includes('physics') && 'adjusted the difficulty',
    changed.includes('spritePalette') && 'changed the character colors',
    changed.includes('ground') && 'repainted the ground',
    changed.includes('detail') && `used ${after.detail} scenery`,
    changed.includes('sounds') &&
      `turned sounds ${after.sounds ? 'on' : 'off'}`,
    changed.includes('controls') && (after.controls?.mode === 'fly' ? 'added hold-to-fly controls' : 'restored running and jumping'),
    changed.includes('title') && `renamed it ${after.title}`,
    changed.includes('scoreLabel') && 'updated the score label',
  ].filter(Boolean);
  return {
    changed,
    summary: details.length
      ? `I ${details.join(', ')}. Take a look!`
      : 'The theme is unchanged.',
  };
}
