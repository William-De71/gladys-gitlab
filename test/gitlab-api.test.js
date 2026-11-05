import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createGitlabClient,
  GitlabError,
  apiRoot,
  quotaOf,
  buildUserAgent,
  MAX_REPOSITORIES,
} from '../src/gitlab-api.js';
import { gitlabApi, rawRepository, response } from './helpers/fixtures.js';

const client = (fetch, token = 'glpat-good', baseUrl = 'https://gitlab.com') =>
  createGitlabClient({
    getToken: () => token,
    getBaseUrl: () => baseUrl,
    getUserAgent: () => 'gladys-gitlab/0.1.0',
    fetch,
  });

test('a round reads the account and each project with its parts', async () => {
  const projects = {
    'octo/hello': rawRepository(),
    'grp/sub/deep': rawRepository({ id: 202, fullName: 'grp/sub/deep' }),
  };
  const fetch = gitlabApi(() => projects);
  const answer = await client(fetch).round(['octo/hello', 'grp/sub/deep', 'gone/away']);
  assert.equal(answer.viewer.username, 'octo');
  assert.equal(answer.viewer.projects, 9);
  assert.equal(answer.repositories.get('octo/hello').project.id, 101);
  assert.equal(answer.repositories.get('octo/hello').openMergeRequests, 2);
  assert.equal(answer.repositories.get('octo/hello').mergedMergeRequests, 30);
  assert.equal(answer.repositories.get('grp/sub/deep').project.id, 202);
  assert.equal(answer.repositories.get('gone/away'), null);
  assert.deepEqual([...answer.missing.keys()], ['gone/away']);
  assert.deepEqual(answer.rateLimit, { limit: 2000, remaining: 1990, resetAt: 1793786460000 });
  // Nested paths are URL-encoded as one segment.
  assert.ok(fetch.calls.some((call) => call.url.includes('/projects/grp%2Fsub%2Fdeep/pipelines')));
  assert.ok(fetch.calls.every((call) => call.token === 'glpat-good'));
  const pipelines = fetch.calls.find((call) => call.path === '/projects/octo/hello/pipelines');
  assert.equal(pipelines.query.get('ref'), 'main');
});

test('a part turned off (403/404) is left out, the project is still read', async () => {
  const fetch = gitlabApi(() => ({ 'octo/hello': rawRepository() }), {
    fail: [
      [/merge_requests$/, 403],
      [/pipelines$/, 404],
    ],
  });
  const answer = await client(fetch).round(['octo/hello']);
  const raw = answer.repositories.get('octo/hello');
  assert.equal(raw.mergeRequests, null);
  assert.equal(raw.openMergeRequests, null);
  assert.equal(raw.pipeline, null);
  assert.equal(raw.issues.length, 1);
});

test('errors by kind', async () => {
  const kind = async (fetch, token) => {
    try {
      await client(fetch, token).round(['octo/hello']);
      return null;
    } catch (err) {
      assert.ok(err instanceof GitlabError);
      assert.doesNotMatch(err.message, /glpat/);
      return err.kind;
    }
  };
  const projects = () => ({ 'octo/hello': rawRepository() });
  assert.equal(await kind(gitlabApi(projects), 'bad'), 'auth');
  assert.equal(await kind(gitlabApi(projects), ''), 'auth');
  assert.equal(await kind(gitlabApi(projects, { fail: [[/^\/user$/, 403]] })), 'forbidden');
  assert.equal(await kind(gitlabApi(projects, { fail: [[/^\/projects/, 429]] })), 'rate_limit');
  assert.equal(await kind(gitlabApi(projects, { fail: [[/^\/projects/, 502]] })), 'server');
  assert.equal(
    await kind(async () => {
      throw new TypeError('getaddrinfo ENOTFOUND');
    }),
    'network',
  );
  assert.equal(await kind(async () => response(200, undefined)), 'invalid');
});

test('the projects of a group (subgroups included), else of a user; forks left out', async () => {
  const fetch = gitlabApi(() => ({}), {
    groups: { 'grp/sub': ['grp/sub/a', { path: 'grp/sub/fork' }, 'grp/sub/deeper/b'] },
    users: { alice: { id: 55, projects: ['alice/x'] } },
  });
  const api = client(fetch);
  assert.deepEqual(await api.listRepositories('grp/sub'), {
    found: true,
    repositories: ['grp/sub/a', 'grp/sub/deeper/b'],
  });
  const groupCall = fetch.calls.find((call) => call.path === '/groups/grp/sub/projects');
  assert.equal(groupCall.query.get('include_subgroups'), 'true');
  assert.equal(groupCall.query.get('archived'), 'false');
  assert.equal(groupCall.query.get('simple'), null, 'the full form names the forks');
  assert.deepEqual(await api.listRepositories('alice'), { found: true, repositories: ['alice/x'] });
  assert.deepEqual(await api.listRepositories('nobody'), { found: false, repositories: [] });
});

test('instance address, quota headers, User-Agent', () => {
  assert.equal(apiRoot('https://gitlab.example.com/'), 'https://gitlab.example.com/api/v4');
  assert.equal(apiRoot('https://git.x.org/gitlab/api/v4'), 'https://git.x.org/gitlab/api/v4');
  assert.equal(apiRoot(''), 'https://gitlab.com/api/v4');
  assert.equal(quotaOf(response(200, {}).headers), null);
  assert.equal(
    buildUserAgent({ name: 'gladys-gitlab', version: '0.1.0', homepage: 'https://x' }),
    'gladys-gitlab/0.1.0 (+https://x)',
  );
  assert.equal(MAX_REPOSITORIES, 30);
});

test('a self-managed instance is read at its own address', async () => {
  const fetch = gitlabApi(() => ({ 'octo/hello': rawRepository() }));
  await client(fetch, 'glpat-good', 'https://git.example.org/gitlab').round(['octo/hello']);
  assert.ok(
    fetch.calls.every((call) => call.url.startsWith('https://git.example.org/gitlab/api/v4/')),
  );
});
