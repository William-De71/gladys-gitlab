// -----------------------------------------------------------------------------
// GitLab REST API v4 client (gitlab.com or a self-managed instance).
//
// A round reads the authenticated account and every followed project, each
// project with a few small requests (https://docs.gitlab.com/api/rest/):
//   GET /projects/:id                                  counters, default branch
//   GET /projects/:id/issues?per_page=5                newest issues
//   GET /projects/:id/merge_requests?per_page=5        newest merge requests
//   GET /projects/:id/merge_requests?state=opened&per_page=1   x-total: open
//   GET /projects/:id/merge_requests?state=merged&per_page=1   x-total: merged
//   GET /projects/:id/releases?per_page=5              newest releases
//   GET /projects/:id/repository/tags?per_page=1       newest tag
//   GET /projects/:id/repository/commits?ref_name=…    newest commits of the default branch
//   GET /projects/:id/pipelines?ref=…&per_page=1       last pipeline of the default branch
// `:id` is the URL-encoded path (`group/subgroup/project`). The projects are
// read PROJECT_CONCURRENCY at a time, the requests of a project one after the
// other: 30 projects every 120 s use about 135 requests a minute, far below
// the 2,000 a minute gitlab.com grants to an authenticated user.
//
// A part the project does not have (merge requests or issues turned off, an
// empty repository) answers 403 or 404: its counters and items are left out,
// the rest is read. A project itself answering 404 is missing (renamed,
// deleted, or not visible to the token).
//
// The quota comes from the `ratelimit-*` headers gitlab.com sends (a
// self-managed instance may send none).
//
// Errors are GitlabError with a `kind`:
//   - `auth`        401: the token is missing, wrong, expired or revoked;
//   - `rate_limit`  429;
//   - `forbidden`   403 on the account (token without the `read_api` scope);
//   - `server`      5xx;
//   - `network`     no answer (DNS, timeout, connection reset, bad URL);
//   - `invalid`     an answer that is not the expected JSON.
// -----------------------------------------------------------------------------

const DEFAULT_BASE_URL = 'https://gitlab.com';
const TIMEOUT_MS = 20000;
const MAX_REPOSITORIES = 30;
const RECENT_COUNT = 5;
const PROJECT_CONCURRENCY = 3;
const MAX_OWNER_PAGES = 3;

class GitlabError extends Error {
  /**
   * @param {string} kind - auth | rate_limit | forbidden | not_found | server | network | invalid.
   * @param {string} message - The message (never the token).
   * @param {object} [extra] - `{ status, resetAt }`.
   */
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'GitlabError';
    this.kind = kind;
    this.status = extra.status ?? 0;
    this.resetAt = extra.resetAt ?? null;
  }
}

/**
 * @description An integer header, or null.
 * @param {Headers} headers - The headers.
 * @param {string} name - The header name.
 * @returns {number|null} The value.
 */
function intHeader(headers, name) {
  const raw = headers?.get?.(name);
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * @description The quota of an answer, from the `ratelimit-*` headers.
 * @param {Headers} headers - The headers.
 * @returns {{ limit: number, remaining: number, resetAt: number|null }|null} The quota.
 */
function quotaOf(headers) {
  const limit = intHeader(headers, 'ratelimit-limit');
  const remaining = intHeader(headers, 'ratelimit-remaining');
  if (limit === null || remaining === null) {
    return null;
  }
  const reset = intHeader(headers, 'ratelimit-reset');
  return { limit, remaining, resetAt: reset ? reset * 1000 : null };
}

/**
 * @description The root of the API of an instance.
 * @param {string} baseUrl - `https://gitlab.example.com` (a trailing `/` or `/api/v4` is fine).
 * @returns {string} `https://gitlab.example.com/api/v4`.
 */
function apiRoot(baseUrl) {
  return `${String(baseUrl || DEFAULT_BASE_URL)
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/v4$/i, '')}/api/v4`;
}

/**
 * @description The GitLab client.
 * @param {object} options - Options.
 * @param {Function} options.getToken - `() => string`.
 * @param {Function} [options.getBaseUrl] - `() => string`.
 * @param {Function} options.getUserAgent - `() => string`.
 * @param {Function} [options.fetch] - The fetch implementation (tests).
 * @returns {object} `{ round, listRepositories }`.
 */
function createGitlabClient({
  getToken,
  getBaseUrl = () => DEFAULT_BASE_URL,
  getUserAgent,
  fetch = globalThis.fetch,
}) {
  let lastQuota = null;

  /**
   * @description One GET.
   * @param {string} path - The path under /api/v4, with its query.
   * @returns {Promise<{ body: unknown, total: number|null }>} The JSON and the `x-total` header.
   * @throws {GitlabError} On any failure.
   */
  async function get(path) {
    const token = getToken();
    if (!token) {
      throw new GitlabError('auth', 'No GitLab token configured');
    }
    let response;
    try {
      response = await fetch(`${apiRoot(getBaseUrl())}${path}`, {
        headers: {
          'PRIVATE-TOKEN': token,
          Accept: 'application/json',
          'User-Agent': getUserAgent(),
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new GitlabError('network', `GitLab unreachable: ${err.message}`);
    }
    lastQuota = quotaOf(response.headers) ?? lastQuota;
    const status = response.status;
    if (status === 401) {
      throw new GitlabError('auth', 'GitLab refused the token (401)', { status });
    }
    if (status === 429) {
      throw new GitlabError('rate_limit', 'GitLab answered 429', {
        status,
        resetAt: quotaOf(response.headers)?.resetAt ?? null,
      });
    }
    if (status === 403) {
      throw new GitlabError('forbidden', 'GitLab answered 403', { status });
    }
    if (status === 404) {
      throw new GitlabError('not_found', 'GitLab answered 404', { status });
    }
    if (status >= 500) {
      throw new GitlabError('server', `GitLab answered ${status}`, { status });
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw new GitlabError('invalid', `GitLab sent no JSON (HTTP ${status})`, { status });
    }
    if (!response.ok) {
      throw new GitlabError('invalid', `GitLab answered ${status}`, { status });
    }
    return { body, total: intHeader(response.headers, 'x-total') };
  }

  /**
   * @description A part of a project: null when the project does not have it
   * (403 / 404: turned off, empty repository); other errors fail the round.
   * @param {string} path - The path.
   * @returns {Promise<{ body: unknown, total: number|null }|null>} The answer.
   */
  async function part(path) {
    try {
      return await get(path);
    } catch (err) {
      if (err.kind === 'forbidden' || err.kind === 'not_found') {
        return null;
      }
      throw err;
    }
  }

  /**
   * @description Read one project and its parts.
   * @param {string} path - `group/project`.
   * @returns {Promise<object|null>} The raw project, null when GitLab does not show it.
   */
  async function readProject(path) {
    const base = `/projects/${encodeURIComponent(path)}`;
    let project;
    try {
      ({ body: project } = await get(base));
    } catch (err) {
      if (err.kind === 'forbidden' || err.kind === 'not_found') {
        return null;
      }
      throw err;
    }
    if (!project || !Number.isInteger(project.id)) {
      return null;
    }
    const branch = typeof project.default_branch === 'string' ? project.default_branch : '';
    const ref = encodeURIComponent(branch);
    const recent = `per_page=${RECENT_COUNT}&order_by=created_at&sort=desc`;
    const issues = await part(`${base}/issues?${recent}`);
    const mergeRequests = await part(`${base}/merge_requests?${recent}`);
    const openMergeRequests = await part(`${base}/merge_requests?state=opened&per_page=1`);
    const mergedMergeRequests = await part(`${base}/merge_requests?state=merged&per_page=1`);
    const releases = await part(`${base}/releases?per_page=${RECENT_COUNT}`);
    const tags = await part(`${base}/repository/tags?per_page=1`);
    const commits = branch
      ? await part(`${base}/repository/commits?ref_name=${ref}&per_page=${RECENT_COUNT}`)
      : null;
    const pipelines = branch ? await part(`${base}/pipelines?ref=${ref}&per_page=1`) : null;
    return {
      project,
      issues: issues?.body ?? null,
      mergeRequests: mergeRequests?.body ?? null,
      openMergeRequests: openMergeRequests ? openMergeRequests.total : null,
      mergedMergeRequests: mergedMergeRequests ? mergedMergeRequests.total : null,
      releases: releases?.body ?? null,
      tags: tags?.body ?? null,
      commits: commits?.body ?? null,
      pipeline: Array.isArray(pipelines?.body) ? (pipelines.body[0] ?? null) : null,
    };
  }

  /**
   * @description Read the account of the token and how many projects it owns.
   * @returns {Promise<object>} The raw account.
   */
  async function readViewer() {
    const { body: user } = await get('/user');
    let projects = null;
    if (Number.isInteger(user?.id)) {
      const owned = await part(`/users/${user.id}/projects?per_page=1&simple=true`);
      projects = owned ? owned.total : null;
    }
    return { ...user, projects };
  }

  /**
   * @description Read the account and the projects: one failed project fails the round.
   * @param {string[]} repositories - `group/project` (MAX_REPOSITORIES at most).
   * @returns {Promise<{ viewer: object, rateLimit: object|null, repositories: Map<string, object|null>, missing: Map<string, string> }>}
   * The raw answer: each project by its configured path, null when GitLab
   * does not show it.
   */
  async function round(repositories) {
    const list = repositories.slice(0, MAX_REPOSITORIES);
    const viewer = await readViewer();
    const found = new Map();
    const missing = new Map();
    for (let start = 0; start < list.length; start += PROJECT_CONCURRENCY) {
      const slice = list.slice(start, start + PROJECT_CONCURRENCY);
      const answers = await Promise.all(slice.map((path) => readProject(path)));
      slice.forEach((path, index) => {
        found.set(path, answers[index]);
        if (!answers[index]) {
          missing.set(path, 'NOT_FOUND');
        }
      });
    }
    return { viewer, rateLimit: lastQuota, repositories: found, missing };
  }

  /**
   * @description The projects of a group (subgroups included) or of a user.
   * @param {string} owner - The group path or the username.
   * @returns {Promise<{ found: boolean, repositories: string[] }>} The paths of
   * the projects not archived, most recently active first; `found` is false
   * when GitLab knows no such group or user.
   */
  async function listRepositories(owner) {
    // Not `simple=true`: the simple form leaves out `forked_from_project`.
    const query = 'archived=false&order_by=last_activity_at&sort=desc&per_page=100';
    let path = `/groups/${encodeURIComponent(owner)}/projects?include_subgroups=true&${query}`;
    try {
      await get(`/groups/${encodeURIComponent(owner)}?with_projects=false`);
    } catch (err) {
      if (err.kind !== 'not_found') {
        throw err;
      }
      const { body: users } = await get(`/users?username=${encodeURIComponent(owner)}`);
      const user = Array.isArray(users) ? users[0] : null;
      if (!Number.isInteger(user?.id)) {
        return { found: false, repositories: [] };
      }
      path = `/users/${user.id}/projects?${query}`;
    }
    const repositories = [];
    for (let page = 1; page <= MAX_OWNER_PAGES; page += 1) {
      const { body } = await get(`${path}&page=${page}`);
      const projects = Array.isArray(body) ? body : [];
      projects
        .filter((project) => project && typeof project.path_with_namespace === 'string')
        .filter((project) => !project.forked_from_project)
        .forEach((project) => repositories.push(project.path_with_namespace));
      if (projects.length < 100) {
        break;
      }
    }
    return { found: true, repositories };
  }

  return { round, listRepositories, quota: () => lastQuota };
}

/**
 * @description The User-Agent of the integration.
 * @param {{ name: string, version: string, homepage: string }} pkg - package.json fields.
 * @returns {string} The User-Agent.
 * @example
 * buildUserAgent({ name: 'gladys-gitlab', version: '0.1.0', homepage: 'https://…' });
 */
function buildUserAgent({ name, version, homepage }) {
  return `${name}/${version} (+${homepage})`;
}

export {
  DEFAULT_BASE_URL,
  MAX_REPOSITORIES,
  RECENT_COUNT,
  PROJECT_CONCURRENCY,
  GitlabError,
  apiRoot,
  quotaOf,
  buildUserAgent,
  createGitlabClient,
};
