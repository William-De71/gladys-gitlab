// -----------------------------------------------------------------------------
// Reading the GitLab answers into plain snapshots.
//
// Everything the devices, the widgets, the scene triggers and the scene
// actions need comes from these snapshots: they never touch the raw answer.
// A missing or malformed field becomes null (or an empty list), never an
// exception: a counter GitLab did not send is not published, not set to 0.
// -----------------------------------------------------------------------------

const integer = (value) => (Number.isInteger(value) ? value : null);
const text = (value) => (typeof value === 'string' ? value : '');
const time = (value) => {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
};
const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

/**
 * @description An issue or a merge request. `number` is its iid (the number
 * shown in GitLab: #12, !34).
 * @param {object} raw - The issue or merge request.
 * @returns {{ number: number, title: string, url: string, createdAt: number|null, author: string, draft: boolean }} The item.
 */
function readItem(raw) {
  return {
    number: integer(raw.iid),
    title: text(raw.title),
    url: text(raw.web_url),
    createdAt: time(raw.created_at),
    author: text(raw.author?.username),
    draft: raw.draft === true || raw.work_in_progress === true,
  };
}

/**
 * @description A release. Its id is its tag (GitLab gives releases no number).
 * An upcoming release (date in the future) is not published yet.
 * @param {object} raw - The release.
 * @returns {object} The release.
 */
function readRelease(raw) {
  return {
    id: text(raw.tag_name),
    name: text(raw.name) || text(raw.tag_name),
    tag: text(raw.tag_name),
    url: text(raw._links?.self),
    upcoming: raw.upcoming_release === true,
    publishedAt: time(raw.released_at) ?? time(raw.created_at),
    author: text(raw.author?.username),
  };
}

/**
 * @description A commit of the default branch.
 * @param {object} raw - The commit.
 * @returns {object} The commit.
 */
function readCommit(raw) {
  return {
    sha: text(raw.id),
    shortSha: text(raw.short_id) || text(raw.id).slice(0, 8),
    message: text(raw.title),
    url: text(raw.web_url),
    committedAt: time(raw.committed_date) ?? time(raw.created_at),
    author: text(raw.author_name),
  };
}

/**
 * @description The state of a pipeline, as Gladys shows it.
 * @param {string|undefined} status - created, waiting_for_resource, preparing,
 * waiting_for_callback, pending, running, success, failed, canceling,
 * canceled, skipped, manual, scheduled.
 * @returns {'success'|'failed'|'canceled'|'running'|null} The state, null without a pipeline.
 */
function readPipelineStatus(status) {
  switch (status) {
    case 'success':
      return 'success';
    case 'failed':
      return 'failed';
    case 'canceled':
    case 'canceling':
    case 'skipped':
      return 'canceled';
    case 'created':
    case 'waiting_for_resource':
    case 'preparing':
    case 'waiting_for_callback':
    case 'pending':
    case 'running':
    case 'manual':
    case 'scheduled':
      return 'running';
    default:
      return null;
  }
}

/**
 * @description Read a project.
 * @param {object} raw - The raw project of gitlab-api.js `round`.
 * @returns {object|null} The snapshot, null when it has no stable id.
 * @example
 * readRepository(answer.repositories.get('gitlab-org/gitlab')).stars;
 */
function readRepository(raw) {
  const project = raw?.project;
  if (!project || !Number.isInteger(project.id)) {
    return null;
  }
  const tag = list(raw.tags)[0] ?? null;
  // An upcoming release is announced for a later date: not a release yet.
  const releases = list(raw.releases)
    .map(readRelease)
    .filter((release) => release.tag && !release.upcoming);
  const pipeline = raw.pipeline ?? null;
  return {
    id: project.id,
    fullName: text(project.path_with_namespace),
    url: text(project.web_url),
    description: text(project.description),
    archived: project.archived === true,
    private: project.visibility !== 'public',
    stars: integer(project.star_count),
    forks: integer(project.forks_count),
    openIssues: integer(project.open_issues_count),
    openMergeRequests: integer(raw.openMergeRequests),
    mergedMergeRequests: integer(raw.mergedMergeRequests),
    issues: list(raw.issues).map(readItem),
    mergeRequests: list(raw.mergeRequests).map(readItem),
    releases,
    tag: tag ? { name: text(tag.name), url: '' } : null,
    branch: text(project.default_branch),
    commits: list(raw.commits).map(readCommit),
    pipeline: pipeline
      ? {
          id: integer(pipeline.id),
          status: readPipelineStatus(pipeline.status),
          sha: text(pipeline.sha),
          url: text(pipeline.web_url),
        }
      : null,
  };
}

/**
 * @description Read the authenticated account.
 * @param {object} raw - `/user`, with `projects` (the count of its projects).
 * @returns {object|null} The account, null without a stable id.
 */
function readAccount(raw) {
  if (!raw || !Number.isInteger(raw.id)) {
    return null;
  }
  return {
    id: raw.id,
    login: text(raw.username),
    name: text(raw.name),
    url: text(raw.web_url),
    followers: integer(raw.followers),
    following: integer(raw.following),
    projects: integer(raw.projects),
  };
}

/**
 * @description Read the API quota.
 * @param {object} raw - `{ limit, remaining, resetAt }` from the headers.
 * @returns {{ limit: number, remaining: number, resetAt: number|null }|null} The quota.
 */
function readRateLimit(raw) {
  if (!raw || !Number.isInteger(raw.limit) || !Number.isInteger(raw.remaining)) {
    return null;
  }
  return {
    limit: raw.limit,
    remaining: raw.remaining,
    resetAt: Number.isFinite(raw.resetAt) ? raw.resetAt : null,
  };
}

export {
  readRepository,
  readAccount,
  readRateLimit,
  readPipelineStatus,
  readRelease,
  readCommit,
  readItem,
};
