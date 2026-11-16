import { rebuild } from '@electron/rebuild';
import fs from 'fs';
import { version as electronVersion } from 'electron/package.json';
import { dependencies } from '../../release/app/package.json';
import webpackPaths from '../configs/webpack.paths';

if (
  Object.keys(dependencies || {}).length > 0 &&
  fs.existsSync(webpackPaths.appNodeModulesPath)
) {
  // The CLI's yargs entry point fails to load under Node 26. Use the API
  // directly, targeting the installed Electron version rather than host Node.
  rebuild({
    buildPath: webpackPaths.appPath,
    electronVersion,
    arch: process.arch,
    force: true,
    types: ['prod', 'dev', 'optional'],
  }).catch((error) => {
    console.error('Electron native dependency rebuild failed:', error);
    process.exitCode = 1;
  });
}
