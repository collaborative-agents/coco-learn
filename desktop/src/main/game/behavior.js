// Optional new rules only. The engine owns collision, controls and rendering.
// state: { time, distance, y (height above ground), velocity, speed, score, over,
//          obstacles: [{ x, sprite, width, height }], ducking }
// dt is seconds; theme.physics contains the validated numeric settings.
// Keep these hooks quick and deterministic. No imports, DOM, network or timers.
export function onStep(state, theme, dt) {}
export function onJump(state, theme) {}
export function onHit(state, theme) {}
