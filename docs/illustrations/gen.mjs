// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The three widgets for two followed projects, on 2026-11-04 at 11:00 in
// Paris: the answers are the ones of the fake GitLab server of the tests
// (test/helpers/fixtures.js, after the examples of the REST API
// documentation), read by the real reader (src/read.js) and drawn by the real
// widget builders (src/widgets.js).
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildRepositoryWidget, buildActivityWidget, buildAccountWidget } =
  await load('src/widgets.js');
const { readRepository, readAccount, readRateLimit } = await load('src/read.js');
const { LANGUAGES } = await load('src/i18n.js');
const { rawRepository, RAW_VIEWER, RAW_RATE_LIMIT, NOW } = await load('test/helpers/fixtures.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

const MIN = 60000;
const HOUR = 60 * MIN;
// Illustration: a home automation project and its companion app.
const cli = readRepository(
  rawRepository({
    id: 101,
    fullName: 'home/automation',
    stars: 128,
    releases: [{ name: 'v2.4.0', tag: 'v2.4.0', at: NOW - 26 * HOUR }],
    issues: [
      {
        number: 57,
        title: 'Shutters close too early in winter',
        author: 'alice',
        at: NOW - 3 * HOUR,
      },
    ],
    merges: [
      { number: 64, title: 'Add the garden irrigation scene', author: 'bob', at: NOW - 40 * MIN },
    ],
    commits: [{ sha: 'c'.repeat(40), message: 'Fix the heating schedule', at: NOW - 25 * MIN }],
    pipeline: { id: 9001, status: 'success', sha: 'c'.repeat(40) },
  }),
);
cli.description = 'Scenes and scripts of the house';
const app = readRepository(
  rawRepository({
    id: 102,
    fullName: 'home/dashboard-app',
    stars: 31,
    releases: [{ name: 'v0.9.0', tag: 'v0.9.0', at: NOW - 5 * HOUR }],
    issues: [],
    merges: [{ number: 12, title: 'Dark mode', author: 'carol', at: NOW - 2 * HOUR, draft: true }],
    commits: [{ sha: 'd'.repeat(40), message: 'Update the translations', at: NOW - 70 * MIN }],
    pipeline: { id: 9002, status: 'failed', sha: 'd'.repeat(40) },
  }),
);
const account = readAccount({ ...RAW_VIEWER, username: 'william', name: 'William' });
const rateLimit = readRateLimit({ ...RAW_RATE_LIMIT, remaining: 1960 });

const contents = {};
for (const language of LANGUAGES) {
  contents[language] = {
    repository: buildRepositoryWidget({ repo: cli, language, now: NOW, pollSeconds: 120 }),
    activity: buildActivityWidget({
      repos: [cli, app],
      language,
      settings: { kind: 'all', count: 6 },
      pollSeconds: 120,
    }),
    account: buildAccountWidget({
      account,
      rateLimit,
      repositories: 2,
      language,
      now: NOW,
      pollSeconds: 120,
    }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
