/** Installed as real behavior.js code; the locked engine supplies held inputs. */
export const flightBehavior = `// Hold Space / Up / Fly to rise. Release to fall; Down descends faster.
export function onStep(state, theme, dt) {
  if (state.input.jumpHeld) state.velocity = Math.min(theme.controls.riseSpeed, state.velocity + (theme.physics.gravity + theme.controls.lift) * dt);
  if (state.input.duckHeld) state.velocity = Math.max(-theme.controls.riseSpeed, state.velocity - theme.controls.lift * .5 * dt);
}
export function onJump(state, theme) {}
export function onHit(state, theme) {}
`;
export const runningBehavior = `// Optional new mechanics. Engine input is state.input.{jumpHeld,duckHeld}.
export function onStep(state, theme, dt) {}
export function onJump(state, theme) {}
export function onHit(state, theme) {}
`;
