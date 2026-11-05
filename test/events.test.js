import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildSceneEvent, PIPELINE_STATES } from '../src/events.js';
import { SCENE_TRIGGERS } from '../src/tracker.js';
import { readRepository } from '../src/read.js';
import { fakeGladys, rawRepository } from './helpers/fixtures.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const repo = readRepository(rawRepository());

/** One event of each trigger. */
export const EVENTS = [
  { key: SCENE_TRIGGERS.RELEASE_PUBLISHED, release: repo.releases[0] },
  { key: SCENE_TRIGGERS.ISSUE_OPENED, item: repo.issues[0] },
  { key: SCENE_TRIGGERS.MERGE_REQUEST_OPENED, item: repo.mergeRequests[0] },
  { key: SCENE_TRIGGERS.COMMIT_PUSHED, commit: repo.commits[0] },
  { key: SCENE_TRIGGERS.STAR_ADDED, stars: 43, added: 1 },
  {
    key: SCENE_TRIGGERS.PIPELINE_COMPLETED,
    state: 'failed',
    pipeline: repo.pipeline,
    commit: repo.commits[0],
  },
];

test('every trigger has an event carrying its filters and exactly its variables', () => {
  assert.deepEqual(EVENTS.map((event) => event.key).sort(), Object.values(SCENE_TRIGGERS).sort());
  for (const event of EVENTS) {
    const { key, data } = buildSceneEvent(fakeGladys, repo, event, 'en');
    const trigger = manifest.scene_triggers.find((entry) => entry.key === key);
    const declared = new Set([
      ...trigger.fields.map((field) => field.key),
      ...trigger.variables.map((variable) => variable.key),
    ]);
    assert.deepEqual(Object.keys(data).sort(), [...declared].sort(), key);
    for (const variable of trigger.variables) {
      const expected = variable.type;
      assert.equal(typeof data[variable.key], expected, `${key}.${variable.key}`);
    }
  }
});

test('payloads stay flat and within the limits', () => {
  for (const event of EVENTS) {
    const { data } = buildSceneEvent(fakeGladys, repo, event, 'fr');
    assert.ok(Object.keys(data).length <= 30);
    for (const value of Object.values(data)) {
      assert.ok(['string', 'number', 'boolean'].includes(typeof value));
      if (typeof value === 'string') {
        assert.ok(value.length <= 1000);
      }
    }
  }
  const long = { ...repo.commits[0], message: 'x'.repeat(5000) };
  const { data } = buildSceneEvent(
    fakeGladys,
    repo,
    { key: SCENE_TRIGGERS.COMMIT_PUSHED, commit: long },
    'en',
  );
  assert.equal(data.message.length, 1000);
});

test('the filter values match the options of the manifest', () => {
  const pipeline = manifest.scene_triggers.find((x) => x.key === 'pipeline_completed');
  assert.deepEqual(
    pipeline.fields.find((f) => f.key === 'state').options.map((o) => o.value),
    PIPELINE_STATES,
  );
});

test('summaries in the language of the texts', () => {
  const { data } = buildSceneEvent(fakeGladys, repo, EVENTS[0], 'fr');
  assert.equal(data.repository, 'ext:gitlab:repository:101');
  assert.equal(data.summary, 'octo/hello : la version Autumn est publiée.');
  const merge = buildSceneEvent(fakeGladys, repo, EVENTS[2], 'en').data;
  assert.equal(merge.summary, 'octo/hello: new merge request !13 "Fix the crash" by bob.');
  assert.equal(merge.draft, false);
  const star = buildSceneEvent(fakeGladys, repo, EVENTS[4], 'es').data;
  assert.equal(star.summary, 'octo/hello ha recibido una nueva estrella: 43 en total.');
  const pipeline = buildSceneEvent(fakeGladys, repo, EVENTS[5], 'de').data;
  assert.equal(pipeline.state, 'failed');
  assert.equal(pipeline.url, 'https://gitlab.com/octo/hello/-/pipelines/5000');
  assert.match(pipeline.summary, /Pipeline fehlgeschlagen für „Fix the crash“/);
});
