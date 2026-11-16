/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';
import resetLocalOnboarding from './reset-local-onboarding';

let root: string;
let directory: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-onboarding-reset-'));
  directory = path.join(root, 'interface-preview');
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, 'chat-conversations.json'), 'old history');
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const enabled = { NODE_ENV: 'development', COCO_RESET_ON_START: '1' };
const options = () => ({ packaged: false, localAgent: true, hasSingleInstanceLock: true, directory });

it('clears all local history, progress, caches and credentials on each launch', () => {
  fs.mkdirSync(path.join(directory, 'runner-tutorial'));
  fs.writeFileSync(path.join(directory, 'runner-tutorial', 'state.json'), '{}');
  fs.writeFileSync(path.join(directory, 'coco-model-credentials.json'), 'test credential');
  fs.writeFileSync(path.join(root, 'normal-profile.json'), 'preserve');
  expect(resetLocalOnboarding(options(), enabled)).toBe(true);
  expect(fs.readdirSync(directory)).toEqual([]);
  fs.writeFileSync(path.join(directory, 'coco-profile.json'), '{"onboardingComplete":true}');
  expect(resetLocalOnboarding(options(), enabled)).toBe(true);
  expect(fs.readdirSync(directory)).toEqual([]);
  expect(fs.readFileSync(path.join(root, 'normal-profile.json'), 'utf8')).toBe('preserve');
});

it.each([
  [{ packaged: true }, enabled],
  [{ localAgent: false }, enabled],
  [{ hasSingleInstanceLock: false }, enabled],
  [{}, { ...enabled, NODE_ENV: 'production' }],
  [{}, { NODE_ENV: 'development' }],
  [{}, { ...enabled, COCO_RESET_ON_START: '0' }],
])('preserves data outside an explicitly enabled local development launch (%j, %j)', (overrides, environment) => {
  expect(resetLocalOnboarding({ ...options(), ...overrides }, environment)).toBe(false);
  expect(fs.readFileSync(path.join(directory, 'chat-conversations.json'), 'utf8')).toBe('old history');
});

it('does not follow links to external projects', () => {
  const project = path.join(root, 'my-project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'game.html'), 'my game');
  fs.symlinkSync(project, path.join(directory, 'linked-project'));
  resetLocalOnboarding(options(), enabled);
  expect(fs.readFileSync(path.join(project, 'game.html'), 'utf8')).toBe('my game');
});

it('refuses a different directory or a linked profile root', () => {
  expect(() => resetLocalOnboarding({ ...options(), directory: root }, enabled)).toThrow('isolated local profile');
  const parent = path.join(root, 'linked');
  fs.mkdirSync(parent);
  const link = path.join(parent, 'interface-preview');
  fs.symlinkSync(directory, link);
  expect(() => resetLocalOnboarding({ ...options(), directory: link }, enabled)).toThrow('isolated local profile');
  expect(fs.existsSync(path.join(directory, 'chat-conversations.json'))).toBe(true);
});
