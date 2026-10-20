const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');
const { Platform } = require('app-builder-lib');
const { build } = require('../package.json');
const prepareUpdate = require('./prepare-mac-update.cjs');

// Exercise electron-builder's installed configuration resolver, using this
// repository's publishing settings and the nightly CLI channel override.
for (const channel of ['latest', 'nightly']) {
  test(`directory checkpoint embeds Coco Learn ${channel} updater metadata`, async (t) => {
    const resources = await mkdtemp(path.join(tmpdir(), 'coco-learn-update-'));
    t.after(() => rm(resources, { recursive: true, force: true }));
    const config = structuredClone(build);
    config.mac.publish.channel = channel;
    const product = channel === 'nightly' ? 'Coco Learn Nightly' : config.productName;
    const packager = {
      config,
      info: { config },
      platform: Platform.MAC,
      platformSpecificBuildOptions: config.mac,
      appInfo: { updaterCacheDirName: 'coco-learn-updater' },
      expandMacro: (value) => value,
      getResourcesDir: () => resources,
    };
    await prepareUpdate({
      electronPlatformName: 'darwin',
      packager,
      arch: 1,
      appOutDir: path.join(resources, `${product}.app`),
      targets: [{ name: 'dir' }],
    });
    const metadata = yaml.load(await readFile(path.join(resources, 'app-update.yml'), 'utf8'));
    assert.deepEqual(metadata, {
      provider: 'github',
      owner: 'collaborative-agents',
      repo: 'coco-learn',
      channel,
      updaterCacheDirName: 'coco-learn-updater',
    });
  });
}
