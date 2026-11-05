import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  buildRepositoryWidget,
  buildActivityWidget,
  buildAccountWidget,
  readActivitySettings,
  messageContent,
  tileValue,
  ACTIVITY_KINDS,
} from '../src/widgets.js';
import { readRepository, readAccount, readRateLimit } from '../src/read.js';
import { LANGUAGES } from '../src/i18n.js';
import { rawRepository, RAW_VIEWER, RAW_RATE_LIMIT, NOW } from './helpers/fixtures.js';

const repo = readRepository(rawRepository());
const other = readRepository(
  rawRepository({
    id: 102,
    fullName: 'octo/world',
    releases: [{ tag: 'v0.9.0-rc.1', name: 'v0.9.0-rc.1', at: NOW - 60000 }],
    merges: [{ number: 3, title: 'WIP', author: 'x', at: NOW - 120000, draft: true }],
  }),
);
const account = readAccount(RAW_VIEWER);
const rateLimit = readRateLimit(RAW_RATE_LIMIT);
const types = (content) => content.components.map((component) => component.type);

test('every widget content is valid in every language, within the budget', () => {
  for (const language of LANGUAGES) {
    const contents = [
      buildRepositoryWidget({ repo, language, now: NOW, pollSeconds: 120 }),
      buildRepositoryWidget({
        repo: {
          ...repo,
          archived: true,
          pipeline: { ...repo.pipeline, status: 'running' },
          description: 'd'.repeat(300),
        },
        language,
        now: NOW,
        pollSeconds: 120,
      }),
      ...ACTIVITY_KINDS.map((kind) =>
        buildActivityWidget({
          repos: [repo, other],
          language,
          settings: { kind, count: 8 },
          pollSeconds: 120,
        }),
      ),
      buildActivityWidget({
        repos: [readRepository({ project: { id: 9, path_with_namespace: 'a/b' } })],
        language,
        pollSeconds: 60,
      }),
      buildAccountWidget({
        account,
        rateLimit,
        repositories: 2,
        language,
        now: NOW,
        pollSeconds: 120,
      }),
      buildAccountWidget({
        account: { ...account, name: '' },
        rateLimit: null,
        repositories: 0,
        language,
        now: NOW,
        pollSeconds: 5000,
      }),
      messageContent('x'.repeat(400)),
    ];
    for (const content of contents) {
      assert.deepEqual(
        validateWidgetContent(content),
        [],
        `${language}: ${JSON.stringify(types(content))}`,
      );
      assert.ok(content.components.length <= 8);
    }
  }
});

test('project: heading, caption, four tiles, status, GitLab link', () => {
  const content = buildRepositoryWidget({ repo, language: 'fr', now: NOW, pollSeconds: 120 });
  assert.deepEqual(types(content), [
    'text',
    'text',
    'value',
    'value',
    'value',
    'value',
    'status',
    'button',
  ]);
  assert.equal(content.ttl_seconds, 120);
  const [release, pipeline, commit] = content.components[6].items;
  assert.equal(release.value, 'v1.2.0 · il y a 1 j');
  assert.deepEqual(
    [pipeline.label, pipeline.value, pipeline.color],
    ['Pipeline (main)', 'Réussi', 'success'],
  );
  assert.equal(commit.value, 'il y a 30 min');
  assert.deepEqual(content.components[7].link, { url: 'https://gitlab.com/octo/hello' });
  assert.equal(content.components[7].icon, 'gitlab');
});

test('activity: newest first across projects, with badges, capped', () => {
  const content = buildActivityWidget({
    repos: [repo, other],
    language: 'en',
    settings: { count: 3 },
    pollSeconds: 120,
  });
  const [caption, list] = content.components;
  assert.equal(caption.text, 'Activity of 2 projects');
  assert.deepEqual(
    list.items.map((item) => `${item.badge.text} ${item.title}`),
    ['Release v0.9.0-rc.1', 'Draft !3 WIP', 'Commit aaaaaaaa Fix the crash'],
  );
  assert.equal(list.items[0].description, 'octo/world · by carol');
  assert.deepEqual(list.items[0].links, [
    { url: 'https://gitlab.com/octo/world/-/releases/v0.9.0-rc.1', label: 'GitLab' },
  ]);
  const releases = buildActivityWidget({
    repos: [repo],
    language: 'en',
    settings: { kind: 'releases' },
    pollSeconds: 120,
  });
  assert.equal(releases.components[0].text, 'Activity of octo/hello');
  assert.deepEqual(
    releases.components[1].items.map((item) => item.title),
    ['v1.2.0 Autumn'],
  );
});

test('account: tiles, quota gauge colored by what is left', () => {
  const content = buildAccountWidget({
    account,
    rateLimit,
    repositories: 2,
    language: 'en',
    now: NOW,
    pollSeconds: 120,
  });
  assert.deepEqual(types(content), [
    'text',
    'text',
    'value',
    'value',
    'value',
    'gauge',
    'status',
    'button',
  ]);
  const gauge = content.components[5];
  assert.deepEqual([gauge.value, gauge.max, gauge.color], [1990, 2000, 'success']);
  assert.equal(content.components[6].items[1].value, 'in 1 min');
  assert.equal(content.components[4].value, 9, 'projects');
  const low = buildAccountWidget({
    account,
    rateLimit: { ...rateLimit, remaining: 100 },
    repositories: 2,
    language: 'en',
    now: NOW,
    pollSeconds: 120,
  });
  assert.equal(low.components[5].color, 'danger');
});

test('settings and tile values', () => {
  assert.deepEqual(readActivitySettings({}), { kind: 'all', count: 6 });
  assert.deepEqual(readActivitySettings({ kind: 'nope', count: '50' }), { kind: 'all', count: 8 });
  assert.equal(tileValue(42, 'en'), 42);
  assert.equal(tileValue(91418, 'en'), 91418);
  assert.equal(tileValue(1234567, 'en'), '1.2M');
  assert.equal(tileValue(null, 'en'), '–');
});
