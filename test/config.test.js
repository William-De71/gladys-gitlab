import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeConfig,
  parseRepository,
  parseRepositories,
  parsePattern,
  readBaseUrl,
  readLanguage,
  POLL_INTERVAL,
} from '../src/config.js';

test('reads group/project, nested groups, links of any instance and .git suffixes', () => {
  assert.equal(parseRepository('octo/hello'), 'octo/hello');
  assert.equal(parseRepository('gitlab-org/cli'), 'gitlab-org/cli');
  assert.equal(parseRepository('grp/sub/deeper/proj'), 'grp/sub/deeper/proj');
  assert.equal(parseRepository('https://gitlab.com/gitlab-org/cli'), 'gitlab-org/cli');
  assert.equal(parseRepository('https://gitlab.com/gitlab-org/cli/-/issues/3'), 'gitlab-org/cli');
  assert.equal(parseRepository('gitlab.example.com/grp/proj.git'), 'grp/proj');
  assert.equal(parseRepository('my.group/project'), 'my.group/project');
  assert.equal(parseRepository('octo/my.repo_2-x'), 'octo/my.repo_2-x');
  for (const bad of ['octo', 'octo/', '/hello', 'octo/hello.', '-octo/x', 'oc to/x', 'octo/*']) {
    assert.equal(parseRepository(bad), null, bad);
  }
});

test('patterns: group/*, group/sub/prefix*, as links too', () => {
  assert.deepEqual(parsePattern('grp/*'), { owner: 'grp', prefix: '', text: 'grp/*' });
  assert.deepEqual(parsePattern('grp/sub/gladys-*'), {
    owner: 'grp/sub',
    prefix: 'gladys-',
    text: 'grp/sub/gladys-*',
  });
  assert.equal(parsePattern('https://gitlab.com/grp/*').owner, 'grp');
  assert.equal(parsePattern('grp/a*b'), null);
  assert.equal(parsePattern('grp/hello'), null);
});

test('projects: separators, duplicates (case-insensitive), cap at 30', () => {
  assert.deepEqual(parseRepositories('octo/a, Octo/A; octo/b\nocto/c  nope'), [
    'octo/a',
    'octo/b',
    'octo/c',
  ]);
  const many = Array.from({ length: 40 }, (_, i) => `octo/r${i}`).join(',');
  assert.equal(parseRepositories(many).length, 30);
  assert.deepEqual(parseRepositories(undefined), []);
});

test('the address of the instance', () => {
  assert.equal(readBaseUrl(''), 'https://gitlab.com');
  assert.equal(readBaseUrl('gitlab.example.com/'), 'https://gitlab.example.com');
  assert.equal(readBaseUrl('http://10.0.0.5:8080/gitlab/api/v4'), 'http://10.0.0.5:8080/gitlab');
  assert.equal(readBaseUrl('ftp://x'), 'https://gitlab.com');
});

test('normalizes the whole config, with defaults and bounds', () => {
  assert.deepEqual(normalizeConfig(), {
    url: 'https://gitlab.com',
    token: '',
    repositories: [],
    patterns: [],
    pollInterval: POLL_INTERVAL.default,
    language: 'auto',
  });
  const config = normalizeConfig({
    token: ' glpat-abc\n',
    repositories: 'octo/a',
    poll_interval: '5',
    language: 'de',
  });
  assert.equal(config.token, 'glpat-abc');
  assert.equal(config.pollInterval, POLL_INTERVAL.min);
  assert.equal(config.language, 'de');
  assert.equal(normalizeConfig({ poll_interval: 99999 }).pollInterval, POLL_INTERVAL.max);
  assert.equal(normalizeConfig({ language: 'it' }).language, 'auto');
  assert.equal(normalizeConfig(null).token, '');
});

test('reads the stored language', () => {
  assert.equal(readLanguage({ last_language: 'fr' }, 'en'), 'fr');
  assert.equal(readLanguage({ last_language: 'french' }, 'en'), 'en');
  assert.equal(readLanguage(undefined, 'es'), 'es');
});
