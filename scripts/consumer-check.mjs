// Packaging check: packs the library, installs the tarball into a fresh `ng new` app (zoneless, SSR with
// prerendering) outside this workspace, builds it for production, and runs consumer/consumer.spec.ts against it.
// Catches packaging mistakes (exports, peers, .d.ts, SSR safety) that the workspace's tsconfig paths hide.
import { execSync } from 'node:child_process';
import { copyFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(process.env.CONSUMER_DIR ?? join(tmpdir(), 'ngx-virtual-scroller-consumer'));
const lib = JSON.parse(
  readFileSync(join(root, 'projects/ngx-virtual-scroller/package.json'), 'utf8'),
);
// The app is generated with the Angular major the library supports
const angularMajor = /\d+/.exec(lib.peerDependencies['@angular/core'])[0];

const run = (command, cwd, env = {}) => {
  console.log(`\n> ${command}`);
  execSync(command, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
};

run('npm run pack', root);
const tarball = join(root, 'dist', `kareadita-ngx-virtual-scroller-${lib.version}.tgz`);

rmSync(dir, { recursive: true, force: true });
run(
  `npx -y @angular/cli@${angularMajor} new consumer --directory "${basename(dir)}" --defaults --zoneless --ssr ` +
    '--style css --skip-git --skip-tests --skip-install --ai-config none --package-manager npm',
  dirname(dir),
);
run(`npm install "${tarball}"`, dir);
copyFileSync(join(root, 'consumer/app.ts'), join(dir, 'src/app/app.ts'));
run('npx ng build', dir);
run('npx playwright test -c playwright.consumer.config.ts', root, { CONSUMER_DIR: dir });
