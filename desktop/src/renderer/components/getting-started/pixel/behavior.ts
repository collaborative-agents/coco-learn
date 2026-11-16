import type { PixelConfig } from './config';
export interface Obstacle {
  x: number;
  kind: PixelConfig['obstacleTypes'][number];
}
export interface RunState {
  time: number;
  distance: number;
  y: number;
  velocity: number;
  speed: number;
  score: number;
  highScore: number;
  ducking: boolean;
  gameOver: boolean;
  hitAt: number;
  obstacles: Obstacle[];
  spawnIn: number;
  rng: number;
}
export function createRun(
  config: PixelConfig,
  highScore = 0,
  seed = 42,
): RunState {
  return {
    time: 0,
    distance: 0,
    y: 0,
    velocity: 0,
    speed: config.startSpeed,
    score: 0,
    highScore,
    ducking: false,
    gameOver: false,
    hitAt: -100,
    obstacles: [],
    spawnIn: 1.75,
    rng: seed,
  };
}
export function random(state: RunState) {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 0x100000000;
}
export function jump(state: RunState, config: PixelConfig) {
  if (state.gameOver || state.y > 0) return false;
  state.velocity = config.jumpVelocity;
  state.ducking = false;
  return true;
}
export function obstacleBox(obstacle: Obstacle, config: PixelConfig) {
  const boxes = {
    stump: [40, 44, 0],
    mushroom: [43, 38, 0],
    crystal: [44, 31, 0],
    moth: [42, 18, 39],
  };
  const [width, height, lift] = boxes[obstacle.kind];
  return { x: obstacle.x + 6, y: config.ground - height - lift, width, height };
}
export function playerBox(state: RunState, config: PixelConfig) {
  const height = state.ducking && state.y === 0 ? 27 : 49;
  return { x: 146, y: config.ground - state.y - height, width: 37, height };
}
/** Optional mechanics live here; the renderer never changes the simulation. */
export function advanceRun(
  state: RunState,
  config: PixelConfig,
  elapsed: number,
): boolean {
  const dt = Math.max(0, Math.min(elapsed, 1 / 30));
  state.time += dt;
  if (state.gameOver) return false;
  state.speed = Math.min(
    config.maxSpeed,
    state.speed + config.acceleration * dt,
  );
  state.distance += state.speed * dt;
  state.score = Math.floor(state.distance / 14);
  if (state.y > 0 || state.velocity > 0) {
    state.velocity -= config.gravity * dt * (state.ducking ? 2.2 : 1);
    state.y = Math.max(0, state.y + state.velocity * dt);
    if (state.y === 0) state.velocity = 0;
  }
  state.spawnIn -= dt;
  if (state.spawnIn <= 0) {
    const types = config.obstacleTypes;
    state.obstacles.push({
      x: config.width + 40,
      kind: types[Math.floor(random(state) * types.length)],
    });
    state.spawnIn = 1.35 + random(state) * 0.85;
  }
  for (const obstacle of state.obstacles) obstacle.x -= state.speed * dt;
  state.obstacles = state.obstacles.filter((o) => o.x > -90);
  const player = playerBox(state, config);
  for (const o of state.obstacles) {
    const box = obstacleBox(o, config);
    if (
      player.x < box.x + box.width &&
      player.x + player.width > box.x &&
      player.y < box.y + box.height &&
      player.y + player.height > box.y
    ) {
      state.gameOver = true;
      state.hitAt = state.time;
      state.highScore = Math.max(state.highScore, state.score);
      return true;
    }
  }
  return false;
}
