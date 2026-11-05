// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices and the states like the host API does, and a fake GitLab REST API.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { createApp } from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { gitlabApi, rawRepository, silent, NOW } from './helpers/fixtures.js';

const CONFIG = { token: 'glpat-test', repositories: 'octo/hello, octo/gone' };

/**
 * @description The integration, connected to a fake Gladys and a fake GitLab.
 * @param {object} [options] - `{ config }`.
 * @returns {Promise<object>} `{ gladys, app, github }`.
 */
async function startApp({ config = CONFIG } = {}) {
  const github = { repos: { 'octo/hello': rawRepository() } };
  const fetch = gitlabApi(() => github.repos, {
    users: { octo: { id: 7, projects: ['octo/hello'] } },
  });
  const gladys = createFakeGladys({ config });
  const app = createApp(gladys, { fetchImpl: fetch, now: () => NOW, logger: silent });
  await gladys.connect();
  return { gladys, app, github, fetch };
}

test('the account and each repository read are offered, accepted by the host API checks', async (t) => {
  const { gladys, fetch } = await startApp();
  t.after(() => gladys.fake.shutdown());
  // The account (2 requests), the project (1 + 8 parts), the missing one (1).
  assert.equal(fetch.calls.length, 12);
  assert.ok(fetch.calls.every((call) => call.url.startsWith('https://gitlab.com/api/v4/')));
  const devices = gladys.fake.discoveredDevices;
  assert.deepEqual(
    devices.map((device) => device.external_id),
    ['ext:test-integration:account:7', 'ext:test-integration:repository:101'],
  );
  assert.ok(devices.every((device) => device.should_poll === false));
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(gladys.fake.connectionStatus.message.fr, /octo\/gone/);
  assert.equal(gladys.fake.states.length, 0, 'nothing before a device exists');
});

test('creating a device publishes all its states, then only what changed', async (t) => {
  const { gladys, app, github } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const repoDevice = gladys.fake.discoveredDevices[1];
  await gladys.fake.deviceCreated(repoDevice);
  const id = repoDevice.external_id;
  assert.equal(gladys.fake.lastState(`${id}:stars`), 42);
  assert.equal(gladys.fake.lastState(`${id}:latest_release`), 'Autumn (v1.2.0)');
  assert.equal(gladys.fake.lastState(`${id}:pipeline`), 'Passed');
  assert.equal(gladys.fake.lastState(`${id}:open_merge_requests`), 2);
  assert.ok(gladys.fake.widgetRefreshes.includes(WIDGETS.REPOSITORY));

  const before = gladys.fake.states.length;
  github.repos = { 'octo/hello': rawRepository({ stars: 44 }) };
  await app.watcher.round();
  const sent = gladys.fake.states.slice(before);
  assert.deepEqual(
    sent.map((state) => [state.device_feature_external_id, state.state]),
    [[`${id}:stars`, 44]],
  );
  const event = gladys.fake.sceneEvents.at(-1);
  assert.equal(event.key ?? event.trigger_key ?? event.type, 'star_added');
});

test('a new release fires its scene trigger with the repository filter value', async (t) => {
  const { gladys, app, github } = await startApp();
  t.after(() => gladys.fake.shutdown());
  github.repos = {
    'octo/hello': rawRepository({
      releases: [
        { tag: 'v1.3.0', name: 'v1.3.0', at: NOW },
        { tag: 'v1.2.0', name: 'Autumn', at: NOW - 86400000 },
      ],
    }),
  };
  await app.watcher.round();
  assert.equal(gladys.fake.sceneEvents.length, 1);
  const json = JSON.stringify(gladys.fake.sceneEvents[0]);
  assert.match(json, /release_published/);
  assert.match(json, /ext:test-integration:repository:101/);
  assert.match(json, /"tag":"v1.3.0"/);
});

test('widgets, the scene action and the test action answer', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  for (const key of Object.values(WIDGETS)) {
    const ack = await gladys.fake.widgetGet(key, { settings: {}, language: 'de' });
    assert.equal(ack.success, true, key);
    assert.deepEqual(validateWidgetContent(ack.data.content), [], key);
  }
  const action = await gladys.fake.sceneAction('get_repository', {
    repository: 'ext:test-integration:repository:101',
  });
  assert.equal(action.success, true);
  assert.equal(action.data.outputs.stars, 42);
  const tested = await gladys.fake.action('test_connection', {});
  assert.equal(tested.success, true);
  assert.match(JSON.stringify(tested.data), /@octo/);
  assert.match(tested.data.message.fr, /octo\/gone/);
});

test('without a token: no request, a clear status and widget message', async (t) => {
  const { gladys, fetch } = await startApp({ config: { repositories: 'octo/hello' } });
  t.after(() => gladys.fake.shutdown());
  assert.equal(fetch.calls.length, 0);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /token/);
  assert.deepEqual(gladys.fake.discoveredDevices, []);
  const ack = await gladys.fake.widgetGet(WIDGETS.REPOSITORY, { settings: {}, language: 'fr' });
  assert.match(ack.data.content.components[0].text, /jeton/);
});

test('a refused token is reported, and a new token resets the baseline', async (t) => {
  const { gladys } = await startApp({ config: { token: 'bad', repositories: 'octo/hello' } });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /refused the token/);
  await gladys.fake.configUpdated({ token: 'glpat-test', repositories: 'octo/hello' });
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(gladys.fake.sceneEvents.length, 0, 'first round after a token change: baseline');
});

test('a user/* pattern offers every project of the user', async (t) => {
  const { gladys, app } = await startApp({
    config: { token: 'glpat-test', repositories: 'octo/*' },
  });
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => device.external_id),
    ['ext:test-integration:account:7', 'ext:test-integration:repository:101'],
  );
  assert.ok(app.watcher.peek('octo/hello'));
});

test('a pipeline that fails fires pipeline_completed; a self-managed address is used', async (t) => {
  const { gladys, app, github, fetch } = await startApp({
    config: { ...CONFIG, url: 'https://git.example.org/' },
  });
  t.after(() => gladys.fake.shutdown());
  assert.ok(fetch.calls.every((call) => call.url.startsWith('https://git.example.org/api/v4/')));
  github.repos = {
    'octo/hello': rawRepository({ pipeline: { id: 5001, status: 'failed', sha: 'a'.repeat(40) } }),
  };
  await app.watcher.round();
  const [event] = gladys.fake.sceneEvents;
  assert.equal(event.key, 'pipeline_completed');
  assert.equal(event.data.state, 'failed');
  assert.equal(event.data.repository, 'ext:test-integration:repository:101');
});
