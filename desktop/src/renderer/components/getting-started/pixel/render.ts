import type { PixelConfig } from './config';
import type { RunState } from './behavior';
import {
  foxRun,
  foxDuck,
  stump,
  mushroom,
  crystal,
  mothFrames,
  spritePalette,
  type Sprite,
} from './sprites';

const glyphs: Record<string, string> = {
  A: '01110/10001/10001/11111/10001/10001/10001',
  B: '11110/10001/10001/11110/10001/10001/11110',
  C: '01111/10000/10000/10000/10000/10000/01111',
  D: '11110/10001/10001/10001/10001/10001/11110',
  E: '11111/10000/10000/11110/10000/10000/11111',
  F: '11111/10000/10000/11110/10000/10000/10000',
  G: '01111/10000/10000/10111/10001/10001/01111',
  H: '10001/10001/10001/11111/10001/10001/10001',
  I: '11111/00100/00100/00100/00100/00100/11111',
  J: '00111/00010/00010/00010/10010/10010/01100',
  K: '10001/10010/10100/11000/10100/10010/10001',
  L: '10000/10000/10000/10000/10000/10000/11111',
  M: '10001/11011/10101/10101/10001/10001/10001',
  N: '10001/11001/10101/10011/10001/10001/10001',
  O: '01110/10001/10001/10001/10001/10001/01110',
  P: '11110/10001/10001/11110/10000/10000/10000',
  Q: '01110/10001/10001/10001/10101/10010/01101',
  R: '11110/10001/10001/11110/10100/10010/10001',
  S: '01111/10000/10000/01110/00001/00001/11110',
  T: '11111/00100/00100/00100/00100/00100/00100',
  U: '10001/10001/10001/10001/10001/10001/01110',
  V: '10001/10001/10001/10001/10001/01010/00100',
  W: '10001/10001/10001/10101/10101/10101/01010',
  X: '10001/10001/01010/00100/01010/10001/10001',
  Y: '10001/10001/01010/00100/00100/00100/00100',
  Z: '11111/00001/00010/00100/01000/10000/11111',
  '0': '01110/10001/10011/10101/11001/10001/01110',
  '1': '00100/01100/00100/00100/00100/00100/01110',
  '2': '01110/10001/00001/00010/00100/01000/11111',
  '3': '11110/00001/00001/01110/00001/00001/11110',
  '4': '00010/00110/01010/10010/11111/00010/00010',
  '5': '11111/10000/10000/11110/00001/00001/11110',
  '6': '01110/10000/10000/11110/10001/10001/01110',
  '7': '11111/00001/00010/00100/01000/01000/01000',
  '8': '01110/10001/10001/01110/10001/10001/01110',
  '9': '01110/10001/10001/01111/00001/00001/01110',
  '?': '01110/10001/00001/00010/00100/00000/00100',
  ':': '00000/00100/00100/00000/00100/00100/00000',
  '-': '00000/00000/00000/11111/00000/00000/00000',
};
export function pixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  center = false,
) {
  const width = text.length * 6 * size - size;
  let left = Math.round(center ? x - width / 2 : x);
  ctx.fillStyle = color;
  for (const char of text.toUpperCase()) {
    const rows = glyphs[char]?.split('/') ?? [];
    rows.forEach((row, iy) =>
      [...row].forEach((v, ix) => {
        if (v === '1')
          ctx.fillRect(left + ix * size, y + iy * size, size, size);
      }),
    );
    left += 6 * size;
  }
}
function sprite(
  ctx: CanvasRenderingContext2D,
  art: Sprite,
  x: number,
  y: number,
  scale = 3,
) {
  art.forEach((row, iy) =>
    [...row].forEach((key, ix) => {
      if (spritePalette[key]) {
        ctx.fillStyle = spritePalette[key];
        ctx.fillRect(
          Math.round(x) + ix * scale,
          Math.round(y) + iy * scale,
          scale,
          scale,
        );
      }
    }),
  );
}
function disc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
) {
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy += 4) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy) / 4) * 4;
    ctx.fillRect(x - dx, y + dy, dx * 2, 4);
  }
}
function pine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.fillRect(x - 4, y, 8, height);
  for (let i = 0; i < 6; i += 1) {
    const w = 12 + i * 13;
    ctx.fillRect(x - w / 2, y + (i * height) / 8, w, height / 6);
  }
}
export function renderRun(
  ctx: CanvasRenderingContext2D,
  state: RunState,
  config: PixelConfig,
  paused = false,
) {
  const { width: w, height: h, ground: g, theme: t } = config;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = t.sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1b2b42';
  ctx.fillRect(0, 130, w, 110);
  ctx.fillStyle = t.horizon;
  ctx.fillRect(0, 240, w, 105);
  // Fixed stars, and a stepped moon: every visible element uses crisp rectangles.
  for (let i = 0; i < 20; i += 1) {
    const x = (i * 173 + 37) % w,
      y = 45 + ((i * 67) % 150);
    ctx.fillStyle = i % 4 === 0 ? t.moon : t.stars;
    ctx.globalAlpha =
      0.35 + (Math.sin(state.time * ((i % 3) + 1) + i) + 1) * 0.2;
    ctx.fillRect(x, y, i % 5 === 0 ? 4 : 2, i % 5 === 0 ? 4 : 2);
  }
  ctx.globalAlpha = 1;
  disc(ctx, 748, 93, 43, '#344249');
  disc(ctx, 748, 93, 35, t.moon);
  ctx.fillStyle = '#dbc995';
  ctx.fillRect(727, 79, 12, 8);
  ctx.fillRect(754, 102, 16, 8);
  ctx.fillRect(757, 69, 8, 8);
  const mountain = (base: number, color: string, shift: number) => {
    ctx.fillStyle = color;
    for (let x = -64; x < w + 64; x += 16) {
      const peak =
        Math.sin((x + shift) / 117) * 32 + Math.sin((x + shift) / 61) * 16;
      ctx.fillRect(
        x,
        Math.floor((base + peak) / 4) * 4,
        17,
        g - base - peak + 24,
      );
    }
  };
  mountain(232, t.mountainFar, state.distance * 0.05);
  mountain(274, t.mountainNear, state.distance * 0.09);
  for (let i = -1; i < 6; i += 1) {
    const x = i * 90 - ((state.distance * 0.17) % 90);
    pine(ctx, Math.round(x), 178 + (i % 3) * 13, 170, t.pineFar);
  }
  for (let i = -1; i < 9; i += 1) {
    const x = i * 160 - ((state.distance * 0.3) % 160);
    pine(ctx, Math.round(x), 220 + (i % 2) * 21, 140, t.pineNear);
  }
  for (let i = 0; i < 6; i += 1) {
    const x = (((i * 89 - state.distance * 0.22) % w) + w) % w,
      y = 192 + ((i * 37) % 100) + Math.sin(state.time + i) * 7;
    ctx.globalAlpha = 0.25 + (Math.sin(state.time * 2 + i) + 1) * 0.25;
    ctx.fillStyle = t.firefly;
    ctx.fillRect(Math.round(x), Math.round(y), 3, 3);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = t.ground;
  ctx.fillRect(0, g, w, h - g);
  ctx.fillStyle = t.grass;
  ctx.fillRect(0, g, w, 5);
  ctx.fillStyle = t.moss;
  ctx.fillRect(0, g + 5, w, 7);
  ctx.fillStyle = t.soil;
  ctx.fillRect(0, g + 12, w, 8);
  for (let i = -1; i < 32; i += 1) {
    const x = Math.floor(i * 19 - (state.distance % 19));
    ctx.fillStyle = i % 3 === 0 ? t.grassLight : t.grass;
    ctx.fillRect(x, g - 4 - (i % 3) * 2, 3, 6 + (i % 3) * 2);
    ctx.fillStyle = i % 2 === 0 ? t.soilLight : t.soil;
    ctx.fillRect(
      (i * 47 - (state.distance % 47) + w) % w,
      g + 30 + ((i * 11) % 42),
      6 + (i % 4) * 3,
      3,
    );
  }
  // Ground decorations are intentionally smaller than collidable obstacles.
  for (let i = -1; i < 8; i += 1) {
    const x = Math.floor(i * 151 - (state.distance % 151));
    ctx.fillStyle = t.moss;
    ctx.fillRect(x, g - 8, 9, 8);
    ctx.fillRect(x + 3, g - 13, 3, 6);
    ctx.fillStyle = '#d2b77f';
    ctx.fillRect(x + 55, g - 3, 8, 3);
  }
  ctx.save();
  const hitAge = state.time - state.hitAt;
  if (state.gameOver && hitAge < 0.25)
    ctx.translate(
      Math.round(Math.sin(hitAge * 100) * 4),
      Math.round(Math.cos(hitAge * 80) * 2),
    );
  for (const o of state.obstacles) {
    if (o.kind === 'stump') sprite(ctx, stump, o.x, g - stump.length * 3);
    if (o.kind === 'mushroom')
      sprite(ctx, mushroom, o.x, g - mushroom.length * 3);
    if (o.kind === 'crystal') sprite(ctx, crystal, o.x, g - crystal.length * 3);
    if (o.kind === 'moth')
      sprite(ctx, mothFrames[Math.floor(state.time * 8) % 2], o.x, g - 63);
  }
  ctx.fillStyle = '#101e27';
  ctx.globalAlpha = 0.3;
  ctx.fillRect(133, g - 1, 58, 4);
  ctx.globalAlpha = 1;
  const duck = state.ducking && state.y === 0;
  const art = duck
    ? foxDuck
    : foxRun[state.y > 0 ? 1 : Math.floor(state.time * 11) % 4];
  sprite(ctx, art, 118, g - art.length * 3 - state.y);
  if (!state.gameOver && state.y === 0) {
    ctx.fillStyle = '#b7b99a';
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 4; i += 1)
      ctx.fillRect(
        106 - i * 12 - (Math.floor(state.time * 15) % 3) * 3,
        g - 3 - (i % 2) * 4,
        4,
        3,
      );
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // Restrained HUD, rendered in the same bitmap alphabet as the game-over card.
  pixelText(ctx, 'MOONLIT RUN', 25, 24, 2, t.cream);
  pixelText(
    ctx,
    'BEST ' + String(state.highScore).padStart(5, '0'),
    663,
    25,
    1,
    t.stars,
  );
  pixelText(ctx, String(state.score).padStart(5, '0'), 829, 21, 3, t.cream);
  pixelText(ctx, 'SPACE / UP: JUMP   DOWN: DUCK', 25, 393, 1, t.stars);
  pixelText(ctx, 'COCO', 886, 390, 2, t.grassLight);
  if (state.gameOver || paused) {
    ctx.fillStyle = '#0c172b99';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = t.ink;
    ctx.fillRect(283, 117, 394, 178);
    ctx.fillStyle = t.grass;
    ctx.fillRect(283, 117, 394, 3);
    ctx.fillRect(283, 292, 394, 3);
    ctx.fillRect(283, 117, 3, 178);
    ctx.fillRect(674, 117, 3, 178);
    pixelText(
      ctx,
      paused ? 'TAKE A BREATHER' : 'ONE MORE RUN?',
      480,
      145,
      3,
      t.cream,
      true,
    );
    pixelText(
      ctx,
      paused
        ? 'READY WHEN YOU ARE'
        : 'SCORE ' + String(state.score).padStart(5, '0'),
      480,
      191,
      2,
      t.grassLight,
      true,
    );
    pixelText(
      ctx,
      paused ? 'SPACE OR TAP TO PLAY' : 'SPACE OR TAP TO RESTART',
      480,
      251,
      1,
      t.cream,
      true,
    );
  }
  if (state.gameOver && hitAge < 0.08) {
    ctx.fillStyle = '#ffe5c61c';
    ctx.fillRect(0, 0, w, h);
  }
}
