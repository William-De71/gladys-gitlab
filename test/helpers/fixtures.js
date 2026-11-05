// Shapes of the GitLab REST v4 answers (as the API documents them), a fake
// GitLab server behind `fetch`, and a stand-in for the SDK external ids.
// Tests never touch the network.

export const NOW = Date.parse('2026-11-04T10:00:00Z');
const HOUR = 3600000;
const iso = (ms) => new Date(ms).toISOString();

/**
 * @description The answers of a project, as gitlab-api.js gathers them.
 * @param {object} [options] - Overrides.
 * @returns {object} The raw project of `round`.
 */
export function rawRepository({
  id = 101,
  fullName = 'octo/hello',
  stars = 42,
  issues = [{ number: 12, title: 'Crash on start', author: 'alice', at: NOW - 2 * HOUR }],
  merges = [{ number: 13, title: 'Fix the crash', author: 'bob', at: NOW - HOUR, draft: false }],
  releases = [{ name: 'Autumn', tag: 'v1.2.0', at: NOW - 24 * HOUR, upcoming: false }],
  commits = [{ sha: 'a'.repeat(40), message: 'Fix the crash', at: NOW - HOUR / 2 }],
  pipeline = { id: 5000, status: 'success', sha: 'a'.repeat(40) },
  branch = 'main',
} = {}) {
  const web = `https://gitlab.com/${fullName}`;
  return {
    project: {
      id,
      path_with_namespace: fullName,
      web_url: web,
      description: 'A friendly project',
      archived: false,
      visibility: 'public',
      star_count: stars,
      forks_count: 7,
      open_issues_count: 4,
      default_branch: branch,
    },
    issues: issues.map((item) => ({
      iid: item.number,
      title: item.title,
      web_url: `${web}/-/issues/${item.number}`,
      created_at: iso(item.at),
      author: { username: item.author },
    })),
    mergeRequests: merges.map((item) => ({
      iid: item.number,
      title: item.title,
      web_url: `${web}/-/merge_requests/${item.number}`,
      created_at: iso(item.at),
      draft: item.draft === true,
      author: { username: item.author },
    })),
    openMergeRequests: 2,
    mergedMergeRequests: 30,
    releases: releases.map((release) => ({
      name: release.name,
      tag_name: release.tag,
      released_at: iso(release.at),
      created_at: iso(release.at),
      upcoming_release: release.upcoming === true,
      author: { username: 'carol' },
      _links: { self: `${web}/-/releases/${release.tag}` },
    })),
    tags: releases.length ? [{ name: releases[0].tag }] : [],
    commits: commits.map((commit) => ({
      id: commit.sha,
      short_id: commit.sha.slice(0, 8),
      title: commit.message,
      web_url: `${web}/-/commit/${commit.sha}`,
      committed_date: iso(commit.at),
      author_name: commit.author ?? 'Dana',
    })),
    pipeline: pipeline
      ? { ...pipeline, ref: branch, web_url: `${web}/-/pipelines/${pipeline.id}` }
      : null,
  };
}

export const RAW_VIEWER = {
  id: 7,
  username: 'octo',
  name: 'Octo Cat',
  web_url: 'https://gitlab.com/octo',
  followers: 12,
  following: 3,
  projects: 9,
};

export const RAW_RATE_LIMIT = { limit: 2000, remaining: 1990, resetAt: NOW + 60000 };

/**
 * @description A fetch Response stand-in.
 * @param {number} status - The status.
 * @param {unknown} body - The JSON body.
 * @param {object} [headers] - The headers.
 * @returns {object} The response.
 */
export function response(status, body, headers = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) =>
        lower[name.toLowerCase()] === undefined ? null : String(lower[name.toLowerCase()]),
      has: (name) => lower[name.toLowerCase()] !== undefined,
    },
    json: async () => {
      if (body === undefined) {
        throw new SyntaxError('no JSON');
      }
      return JSON.parse(JSON.stringify(body));
    },
  };
}

const QUOTA = {
  'RateLimit-Limit': 2000,
  'RateLimit-Remaining': 1990,
  'RateLimit-Reset': 1793786460,
};

/**
 * @description A fake GitLab server: the routes of gitlab-api.js.
 * @param {Function} getProjects - `() => object` path -> raw project (rawRepository), or null.
 * @param {object} [options] - `{ viewer, groups, users, fail }`: `fail` path regex -> status.
 * @returns {Function} The fetch, with `calls`.
 */
export function gitlabApi(
  getProjects,
  { viewer = RAW_VIEWER, groups = {}, users = {}, fail = [] } = {},
) {
  const api = async (url, init = {}) => {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname.replace(/^.*?\/api\/v4/, ''));
    api.calls.push({
      url,
      path,
      query: parsed.searchParams,
      token: init.headers?.['PRIVATE-TOKEN'],
    });
    for (const [pattern, status] of fail) {
      if (pattern.test(path)) {
        return response(status, { message: `${status}` }, status === 429 ? QUOTA : {});
      }
    }
    if (!init.headers?.['PRIVATE-TOKEN'] || init.headers['PRIVATE-TOKEN'] === 'bad') {
      return response(401, { message: '401 Unauthorized' });
    }
    if (path === '/user') {
      const { projects, ...user } = viewer;
      void projects;
      return response(200, user, QUOTA);
    }
    let match = /^\/users\/(\d+)\/projects$/.exec(path);
    if (match) {
      const owner = Object.values(users).find((u) => String(u.id) === match[1]);
      if (parsed.searchParams.get('per_page') === '1') {
        return response(200, [], { 'X-Total': viewer.projects, ...QUOTA });
      }
      return response(
        200,
        (owner?.projects ?? []).map((p) => ({ path_with_namespace: p })),
        QUOTA,
      );
    }
    if (path === '/users') {
      const user = users[parsed.searchParams.get('username')];
      return response(200, user ? [{ id: user.id }] : [], QUOTA);
    }
    match = /^\/groups\/(.+?)(\/projects)?$/.exec(path);
    if (match) {
      const group = groups[match[1]];
      if (!group) {
        return response(404, { message: '404 Group Not Found' });
      }
      return response(
        200,
        match[2]
          ? group.map((p) =>
              typeof p === 'string'
                ? { path_with_namespace: p }
                : { path_with_namespace: p.path, forked_from_project: { id: 1 } },
            )
          : { full_path: match[1] },
        QUOTA,
      );
    }
    match =
      /^\/projects\/(.+?)(\/(?:issues|merge_requests|releases|repository\/tags|repository\/commits|pipelines))?$/.exec(
        path,
      );
    if (!match) {
      return response(404, { message: '404 Not Found' });
    }
    const raw = getProjects()[match[1]];
    if (!raw) {
      return response(404, { message: '404 Project Not Found' });
    }
    switch (match[2]) {
      case undefined:
        return response(200, raw.project, QUOTA);
      case '/issues':
        return response(200, raw.issues, QUOTA);
      case '/merge_requests': {
        const state = parsed.searchParams.get('state');
        if (state === 'opened') {
          return response(200, [], { 'X-Total': raw.openMergeRequests, ...QUOTA });
        }
        if (state === 'merged') {
          return response(200, [], { 'X-Total': raw.mergedMergeRequests, ...QUOTA });
        }
        return response(200, raw.mergeRequests, QUOTA);
      }
      case '/releases':
        return response(200, raw.releases, QUOTA);
      case '/repository/tags':
        return response(200, raw.tags, QUOTA);
      case '/repository/commits':
        return response(200, raw.commits, QUOTA);
      case '/pipelines':
        return response(200, raw.pipeline ? [raw.pipeline] : [], QUOTA);
      default:
        return response(404, {});
    }
  };
  api.calls = [];
  return api;
}

export const fakeGladys = {
  externalIds: (type, id) => ({
    device: `ext:gitlab:${type}:${id}`,
    feature: (key) => `ext:gitlab:${type}:${id}:${key}`,
  }),
};

export const silent = { debug() {}, info() {}, warn() {}, error() {} };
