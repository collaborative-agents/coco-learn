import {
  advanceRun,
  createRun,
  jump,
  obstacleBox,
} from '../renderer/components/getting-started/pixel/behavior';
import { pixelConfig } from '../renderer/components/getting-started/pixel/config';

it('jumps immediately, rejects double jumps, and lands on the ground', () => {
  const state = createRun(pixelConfig);
  expect(jump(state, pixelConfig)).toBe(true);
  advanceRun(state, pixelConfig, 1 / 60);
  expect(state.y).toBeGreaterThan(0);
  expect(jump(state, pixelConfig)).toBe(false);
  for (let i = 0; i < 70; i++) advanceRun(state, pixelConfig, 1 / 60);
  expect(state.y).toBe(0);
  expect(state.velocity).toBe(0);
});
it('requires ducking to clear a flying obstacle', () => {
  const standing = createRun(pixelConfig);
  standing.obstacles = [{ x: 150, kind: 'moth' }];
  expect(advanceRun(standing, pixelConfig, 1 / 60)).toBe(true);
  const ducking = createRun(pixelConfig);
  ducking.ducking = true;
  ducking.obstacles = [{ x: 150, kind: 'moth' }];
  expect(advanceRun(ducking, pixelConfig, 1 / 60)).toBe(false);
  expect(ducking.gameOver).toBe(false);
});
it('freezes the world on a hit, preserves best score, and restarts cleanly', () => {
  const state = createRun(pixelConfig, 20);
  state.distance = 1400;
  state.obstacles = [{ x: 150, kind: 'stump' }];
  expect(advanceRun(state, pixelConfig, 1 / 60)).toBe(true);
  const frozen = state.distance;
  advanceRun(state, pixelConfig, 1 / 30);
  expect(state.distance).toBe(frozen);
  expect(state.highScore).toBeGreaterThanOrEqual(100);
  const next = createRun(pixelConfig, state.highScore);
  expect(next.gameOver).toBe(false);
  expect(next.score).toBe(0);
  expect(next.highScore).toBe(state.highScore);
});
it('increases speed within its cap and uses obstacles at different heights', () => {
  const state = createRun(pixelConfig);
  state.spawnIn = Infinity;
  for (let i = 0; i < 12000; i++) advanceRun(state, pixelConfig, 1 / 60);
  expect(state.speed).toBe(pixelConfig.maxSpeed);
  expect(state.score).toBeGreaterThan(1000);
  expect(obstacleBox({ x: 100, kind: 'moth' }, pixelConfig).y).toBeLessThan(
    obstacleBox({ x: 100, kind: 'stump' }, pixelConfig).y,
  );
});
it('handles a suspended frame without teleporting through the world', () => {
  const state = createRun(pixelConfig);
  advanceRun(state, pixelConfig, 120);
  expect(state.distance).toBeLessThan(10);
});
