# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for GitLab (gitlab.com or a
self-managed GitLab): a Node.js service (Node 22+, ESM, no build step) that
runs in its own sandboxed Docker container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It reads the GitLab REST API v4
(https://docs.gitlab.com/api/rest/) with an access token of scope `read_api`
(header `PRIVATE-TOKEN`), a few small requests per project each round (up to
30 projects), and never writes to GitLab.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/widgets.test.js          # one file
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, registered before connect()
src/gitlab-api.js       REST v4 client: account, projects and their parts, groups, error kinds
src/read.js             GitLab answers -> plain snapshots
src/watcher.js          the timer loop, snapshots, change detection
src/tracker.js          snapshots -> scene trigger transitions (pure logic)
src/events.js           scene trigger payloads
src/device.js           repository and account devices, their states
src/scene-actions.js    scene action outputs
src/widgets.js          dashboard widget contents
src/patterns.js         `group/*` and `group/prefix*` patterns -> projects
src/config.js           configuration (instance address, token, projects, interval, language)
src/i18n.js             runtime texts, en / fr / de / es
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
test/helpers/fixtures.js  a fake GitLab REST API behind the `fetch` option
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store: device and
  feature external ids (built on the numeric GitLab project and user ids,
  never on a path or a username), feature `category` / `type` / `unit` / `min` / `max` / `step`, the
  keys of `config_schema`, `actions`, widgets and their settings, scene
  triggers (fields, options, variables) and scene actions (fields, outputs).
  `test/structure.test.js` compares them to `test/fixtures/discovery.baseline.json`:
  never update the baseline to make a test pass without a documented migration.
- **`should_poll` stays false**: GitLab is read on the integration's own timer
  (60 to 3600 s), beyond what Gladys polls. It never resyncs on existing devices.
- **A missing part is left out, never 0.** A part a project does not have
  (merge requests or issues turned off, an empty repository: 403 / 404) is
  null, its features not published; the `x-total` counts may be absent beyond
  10,000 items. An upcoming release is not a release before its date.
- **The first round is a baseline**: no scene event replays history after a
  restart or a token change.
- **The container rootfs is read-only.** Write only under `/data`. Never log
  the token; it only goes to the configured instance, in `PRIVATE-TOKEN`.
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language. A field older cores
  do not know needs a higher `gladys_version` minimum (see `src/constants.js`
  of the integration-store). Transport: `["cloud"]`.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network.
