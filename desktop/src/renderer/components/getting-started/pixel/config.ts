import { moonlitTheme, type PixelTheme } from './theme';
export interface PixelConfig {
  width: number;
  height: number;
  ground: number;
  startSpeed: number;
  maxSpeed: number;
  acceleration: number;
  gravity: number;
  jumpVelocity: number;
  sounds: boolean;
  obstacleTypes: readonly ('stump' | 'mushroom' | 'crystal' | 'moth')[];
  theme: PixelTheme;
}
export const pixelConfig: PixelConfig = {
  width: 960,
  height: 420,
  ground: 342,
  startSpeed: 270,
  maxSpeed: 510,
  acceleration: 3.8,
  gravity: 1700,
  jumpVelocity: 650,
  sounds: false,
  obstacleTypes: ['stump', 'mushroom', 'crystal', 'moth'],
  theme: moonlitTheme,
};
