import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readRepository, readAccount, readRateLimit, readPipelineStatus } from '../src/read.js';
import { rawRepository, RAW_VIEWER, RAW_RATE_LIMIT, NOW } from './helpers/fixtures.js';

test('a project becomes a plain snapshot', () => {
  const repo = readRepository(rawRepository());
  assert.equal(repo.id, 101);
  assert.equal(repo.fullName, 'octo/hello');
  assert.equal(repo.url, 'https://gitlab.com/octo/hello');
  assert.equal(repo.stars, 42);
  assert.equal(repo.forks, 7);
  assert.equal(repo.openIssues, 4);
  assert.equal(repo.openMergeRequests, 2);
  assert.equal(repo.mergedMergeRequests, 30);
  assert.equal(repo.branch, 'main');
  assert.deepEqual(repo.issues[0], {
    number: 12,
    title: 'Crash on start',
    url: 'https://gitlab.com/octo/hello/-/issues/12',
    createdAt: NOW - 2 * 3600000,
    author: 'alice',
    draft: false,
  });
  assert.equal(repo.mergeRequests[0].number, 13);
  assert.equal(repo.releases[0].tag, 'v1.2.0');
  assert.equal(repo.releases[0].id, 'v1.2.0');
  assert.equal(repo.tag.name, 'v1.2.0');
  assert.equal(repo.commits[0].shortSha, 'aaaaaaaa');
  assert.deepEqual(repo.pipeline, {
    id: 5000,
    status: 'success',
    sha: 'a'.repeat(40),
    url: 'https://gitlab.com/octo/hello/-/pipelines/5000',
  });
});

test('upcoming releases are left out; missing parts are null or empty, never 0', () => {
  const raw = rawRepository({
    releases: [{ name: 'Next', tag: 'v2.0.0', at: NOW + 86400000, upcoming: true }],
    pipeline: null,
  });
  raw.openMergeRequests = null;
  raw.issues = null;
  delete raw.project.star_count;
  const repo = readRepository(raw);
  assert.deepEqual(repo.releases, []);
  assert.equal(repo.pipeline, null);
  assert.equal(repo.openMergeRequests, null);
  assert.equal(repo.stars, null);
  assert.deepEqual(repo.issues, []);
  assert.equal(readRepository(null), null);
  assert.equal(readRepository({ project: { id: 'x' } }), null);
});

test('pipeline statuses of GitLab, as four states', () => {
  assert.equal(readPipelineStatus('success'), 'success');
  assert.equal(readPipelineStatus('failed'), 'failed');
  assert.equal(readPipelineStatus('canceled'), 'canceled');
  assert.equal(readPipelineStatus('skipped'), 'canceled');
  for (const status of ['created', 'pending', 'running', 'manual', 'scheduled', 'preparing']) {
    assert.equal(readPipelineStatus(status), 'running', status);
  }
  assert.equal(readPipelineStatus(undefined), null);
});

test('the account and the quota', () => {
  assert.deepEqual(readAccount(RAW_VIEWER), {
    id: 7,
    login: 'octo',
    name: 'Octo Cat',
    url: 'https://gitlab.com/octo',
    followers: 12,
    following: 3,
    projects: 9,
  });
  assert.equal(readAccount({ username: 'x' }), null);
  assert.deepEqual(readRateLimit(RAW_RATE_LIMIT), RAW_RATE_LIMIT);
  assert.equal(readRateLimit(null), null);
});
