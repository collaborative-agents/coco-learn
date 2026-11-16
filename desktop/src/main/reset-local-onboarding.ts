import fs from 'fs';
import path from 'path';

/** Opt-in reset of the isolated local-agent profile, before any stores load. */
export default function resetLocalOnboarding(
  options: {
    packaged: boolean;
    localAgent: boolean;
    hasSingleInstanceLock: boolean;
    directory: string;
  },
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  if (options.packaged || !options.localAgent || !options.hasSingleInstanceLock ||
      environment.NODE_ENV !== 'development' || environment.COCO_RESET_ON_START !== '1') return false;

  const directory = path.resolve(options.directory);
  if (path.basename(directory) !== 'interface-preview' || fs.lstatSync(directory).isSymbolicLink()) {
    throw new Error('Onboarding reset requires Coco’s isolated local profile directory.');
  }
  // Remove profile contents, never selected project folders outside the profile.
  // rmSync removes child symlinks without following them.
  for (const entry of fs.readdirSync(directory)) {
    fs.rmSync(path.join(directory, entry), { recursive: true, force: true });
  }
  return true;
}
