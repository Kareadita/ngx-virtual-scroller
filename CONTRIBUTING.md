# Contributing

Issues and pull requests are welcome. This file covers working on the library and, for maintainers, releasing it.

## Setup

Use Node 24 (see `.nvmrc`).

```sh
npm ci
npx playwright install chromium   # once, for the browser tests and e2e
npm start                         # demo at http://localhost:4200
```

## Layout

- `projects/ngx-virtual-scroller/`: the library, the only thing published.
- `projects/demo/`: the demo and docs site, deployed to GitHub Pages. It imports the library's source, so it always
  runs your local changes. Every page in its nav needs a case in `e2e/scenarios.spec.ts`.
- `e2e/`: Playwright tests against the demo, including a jump probe that fails if any frame paints items out of place.
- `consumer/` and `scripts/consumer-check.mjs`: the packaging check (see below).

## Checks

| Command                                    | What it runs                                                                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`                           | Everything below except `consumer`. Run it before opening a pull request.                                                                 |
| `npm run lint`                             | ESLint. Format with `npx prettier --write <files>`.                                                                                       |
| `npm test`                                 | Unit tests (Vitest, jsdom), `*.spec.ts`.                                                                                                  |
| `npm run test:browser`                     | Browser tests (Vitest, Chromium), `*.browser.spec.ts`.                                                                                    |
| `npm run build:lib` / `npm run build:demo` | The library and demo builds.                                                                                                              |
| `npm run e2e`                              | Playwright against the demo.                                                                                                              |
| `npm run consumer`                         | Packs the library, installs the tarball into a fresh `ng new` app (zoneless, SSR), builds it and runs a smoke test. Needs network access. |

CI runs `verify` and `consumer` on every pull request and on pushes to `master`.

Changes to measuring or rendering need a test that fails without them, usually in `paint-consistency.browser.spec.ts`
or as a new demo page with an e2e case.

## Documentation

`README.md` at the root is the source. `projects/ngx-virtual-scroller/README.md` and `LICENSE` are copies, because the
npm package can only include files from the library folder. After editing the root files, copy them over:

```sh
cp README.md LICENSE projects/ngx-virtual-scroller/
```

## Releasing

Releases are published to npm by `.github/workflows/release.yml` when a `v*` tag is pushed. Nothing is published by
merging alone.

### Versions

- The **major** matches the Angular major the library supports (22.x for Angular 22).
- **Minor** for new features, **patch** for fixes.
- The version lives only in `projects/ngx-virtual-scroller/package.json`. The root `package.json` stays `0.0.0`.
- A version with a suffix, like `22.1.0-rc.0`, is a prerelease. It is published under the `next` dist-tag, so
  `npm install` keeps getting the current release; install it with `@next` or the exact version.

### Steps

1. **On a branch:**
   - Set `version` in `projects/ngx-virtual-scroller/package.json`.
   - Add a `# vX.Y.Z` section at the top of `CHANGELOG.md`, with a **Breaking changes** list for a major.
   - If the README or license changed, copy them into the library (see [Documentation](#documentation)).
2. **Check:** `npm run verify` and `npm run consumer`. Maintainers also check the build in Kavita, the main consumer.
3. **Merge** the pull request into `master` and wait for CI to pass there.
4. **Tag** the merge commit and push the tag:

   ```sh
   git fetch origin
   git tag vX.Y.Z origin/master
   git push origin vX.Y.Z
   ```

   Creating a GitHub release with a new `vX.Y.Z` tag on `master` does the same.

5. **Watch** the Release workflow in the Actions tab. It checks the tag matches the library version, builds the
   library and publishes it. Then check `npm view @kareadita/ngx-virtual-scroller dist-tags`.
6. **Afterwards:** add a GitHub release for the tag with the changelog section, and update Kavita to the new version.

### If a release fails

First check whether anything reached npm: `npm view @kareadita/ngx-virtual-scroller versions`.

**Nothing was published** (the workflow failed at any step, including `npm publish`). The version can be reused.

- If the fix is outside the repo, such as the npm trusted publisher settings, fix it and use "Re-run failed jobs" on
  the Release run in the Actions tab.
- If the fix needs a code or workflow change, merge it, then move the tag to the new commit. A re-run would use the
  old commit.

  ```sh
  git push --delete origin vX.Y.Z
  git tag -d vX.Y.Z
  git fetch origin
  git tag vX.Y.Z origin/master
  git push origin vX.Y.Z
  ```

### Reverting a published release

npm never accepts the same version number twice, even after an unpublish, so a published version can't be replaced.
Leave its tag in place too: it records what was released.

1. **Move users back** to the previous good version, so `npm install` stops picking up the bad one:

   ```sh
   npm dist-tag add @kareadita/ngx-virtual-scroller@<previous version> latest
   ```

2. **Warn anyone who installs it** by exact version:

   ```sh
   npm deprecate @kareadita/ngx-virtual-scroller@X.Y.Z "Broken, use X.Y.Z+1 instead"
   ```

3. **Release the fix** as the next patch, which becomes `latest` again.

These commands run on your machine after `npm login`; the release workflow only publishes. Avoid `npm unpublish`:
npm restricts it after 72 hours, it breaks anyone who already depends on that version, and the version number stays
unusable afterwards.

### A new Angular major

1. `npx ng update @angular/core@<major> @angular/cli@<major>` (and the other Angular and tooling packages).
2. In `projects/ngx-virtual-scroller/package.json`, set the peers to `^<major>.0.0` and the version to `<major>.0.0`.
3. Release as above. `npm run consumer` generates its test app with the Angular major from the peers, so it checks
   the new major automatically.

### One-time setup

- **npm trusted publisher**, so the release workflow can publish without a token: on npmjs.com, package → Settings →
  Trusted Publisher → GitHub Actions, with organization `Kareadita`, repository `ngx-virtual-scroller`, workflow
  `release.yml` (the file name only) and no environment. Without it, `npm publish` fails with `404 Not Found`.
- **GitHub Pages** source set to "GitHub Actions", for `.github/workflows/pages.yml`.
