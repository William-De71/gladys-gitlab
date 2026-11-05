// -----------------------------------------------------------------------------
// The devices of the GitLab integration, offered on the Discovery screen.
//
// One device per followed project, "GitLab group/project":
//   - counters (counter-sensor / integer): stars, forks, open issues, open
//     merge requests, merged merge requests;
//   - texts (text / text): the latest release, tag, commit of the default
//     branch, issue, merge request, and the state of the last pipeline of the
//     default branch (in the language of the integration).
// One device for the account that owns the token, "GitLab @username":
// followers, following, projects.
//
// External ids are built on the numeric ids GitLab gives projects and users:
// renaming or transferring a project, or changing a username, keeps the
// device. The path in the device params is only informative.
//
// The integration reads GitLab on its own timer (every 120 s by default,
// beyond the 60 s Gladys polls at most), so `should_poll` is false.
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';
import { t } from './i18n.js';

const DEVICE_TYPES = { REPOSITORY: 'repository', ACCOUNT: 'account' };

// Bounds of the counters: far beyond the largest repositories and accounts.
const MAX_COUNT = 100000000;
// A text state is a short label; longer ones are cut with an ellipsis.
const MAX_TEXT = 200;

const REPOSITORY_COUNTERS = [
  { key: 'stars', text: 'featureStars', read: (repo) => repo.stars },
  { key: 'forks', text: 'featureForks', read: (repo) => repo.forks },
  { key: 'open_issues', text: 'featureOpenIssues', read: (repo) => repo.openIssues },
  {
    key: 'open_merge_requests',
    text: 'featureOpenMergeRequests',
    read: (repo) => repo.openMergeRequests,
  },
  {
    key: 'merged_merge_requests',
    text: 'featureMergedMergeRequests',
    read: (repo) => repo.mergedMergeRequests,
  },
];

const REPOSITORY_TEXTS = [
  { key: 'latest_release', text: 'featureLatestRelease', read: (repo) => releaseLabel(repo) },
  { key: 'latest_tag', text: 'featureLatestTag', read: (repo) => repo.tag?.name || null },
  { key: 'latest_commit', text: 'featureLatestCommit', read: (repo) => commitLabel(repo) },
  {
    key: 'latest_issue',
    text: 'featureLatestIssue',
    read: (repo) => itemLabel(repo.issues[0], '#'),
  },
  {
    key: 'latest_merge_request',
    text: 'featureLatestMergeRequest',
    read: (repo) => itemLabel(repo.mergeRequests[0], '!'),
  },
  {
    key: 'pipeline',
    text: 'featurePipeline',
    read: (repo, language) =>
      repo.pipeline?.status ? t(`pipeline_${repo.pipeline.status}`, language) : null,
  },
];

const ACCOUNT_COUNTERS = [
  { key: 'followers', text: 'featureFollowers', read: (account) => account.followers },
  { key: 'following', text: 'featureFollowing', read: (account) => account.following },
  { key: 'projects', text: 'featureProjects', read: (account) => account.projects },
];

const clip = (value, max = MAX_TEXT) => {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

/**
 * @description "#12 Title" for an issue, "!34 Title" for a merge request.
 * @param {object|undefined} item - The item.
 * @param {string} [prefix] - `#` or `!`.
 * @returns {string|null} The label.
 */
function itemLabel(item, prefix = '#') {
  return item && Number.isInteger(item.number)
    ? clip(`${prefix}${item.number} ${item.title}`)
    : null;
}

/**
 * @description "v1.2.0" or "Name (v1.2.0)" for the latest release.
 * @param {object} repo - The repository snapshot.
 * @returns {string|null} The label.
 */
function releaseLabel(repo) {
  const release = repo.releases[0];
  if (!release) {
    return null;
  }
  return clip(
    release.name && release.name !== release.tag ? `${release.name} (${release.tag})` : release.tag,
  );
}

/**
 * @description "abc1234 Message" for the head commit of the default branch.
 * @param {object} repo - The repository snapshot.
 * @returns {string|null} The label.
 */
function commitLabel(repo) {
  const commit = repo.commits[0];
  return commit ? clip(`${commit.shortSha} ${commit.message}`) : null;
}

/**
 * @description The external ids of a repository or of the account.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} type - A DEVICE_TYPES value.
 * @param {number} id - The GitLab id of the project or user.
 * @returns {{ device: string, feature: Function }} The ids.
 * @example
 * idsOf(gladys, 'repository', 278964).device; // -> 'ext:gitlab:repository:278964'
 */
function idsOf(gladys, type, id) {
  return gladys.externalIds(type, String(id));
}

/**
 * @description The GitLab id a device (or feature) external id stands for.
 * @param {unknown} externalId - The external id.
 * @param {string} type - A DEVICE_TYPES value.
 * @returns {number|null} The id.
 * @example
 * idFromExternalId('ext:gitlab:repository:42:stars', 'repository'); // -> 42
 */
function idFromExternalId(externalId, type) {
  const match = new RegExp(`:${type}:(\\d+)(?::[a-z_]+)?$`).exec(String(externalId ?? ''));
  return match ? Number(match[1]) : null;
}

const counter = (ids, language, spec) => ({
  name: t(spec.text, language),
  external_id: ids.feature(spec.key),
  category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
  type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  min: 0,
  max: MAX_COUNT,
});

const label = (ids, language, spec) => ({
  name: t(spec.text, language),
  external_id: ids.feature(spec.key),
  category: DEVICE_FEATURE_CATEGORIES.TEXT,
  type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
  read_only: true,
  has_feedback: false,
  keep_history: false,
  min: 0,
  max: 0,
});

/**
 * @description The device of a repository.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} repo - The repository snapshot.
 * @param {string} [language] - Language of the names.
 * @returns {object} The discovered device.
 * @example
 * buildRepositoryDevice(gladys, snapshot, 'fr');
 */
function buildRepositoryDevice(gladys, repo, language = 'en') {
  const ids = idsOf(gladys, DEVICE_TYPES.REPOSITORY, repo.id);
  return {
    name: t('repositoryDeviceName', language, { repository: repo.fullName }),
    external_id: ids.device,
    should_poll: false,
    params: [{ name: 'GITLAB_PROJECT', value: repo.fullName }],
    features: [
      ...REPOSITORY_COUNTERS.map((spec) => counter(ids, language, spec)),
      ...REPOSITORY_TEXTS.map((spec) => label(ids, language, spec)),
    ],
  };
}

/**
 * @description The device of the account that owns the token.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} account - The account snapshot.
 * @param {string} [language] - Language of the names.
 * @returns {object} The discovered device.
 */
function buildAccountDevice(gladys, account, language = 'en') {
  const ids = idsOf(gladys, DEVICE_TYPES.ACCOUNT, account.id);
  return {
    name: t('accountDeviceName', language, { login: account.login }),
    external_id: ids.device,
    should_poll: false,
    params: [{ name: 'GITLAB_USERNAME', value: account.login }],
    features: ACCOUNT_COUNTERS.map((spec) => counter(ids, language, spec)),
  };
}

/**
 * @description States of a list of feature specs. An unknown value is
 * omitted, never published as 0 or an empty text.
 * @param {object} ids - The ids.
 * @param {object[]} specs - The feature specs.
 * @param {object} source - The snapshot.
 * @param {boolean} isText - Text features.
 * @param {string} [language] - Language of the texts.
 * @returns {Array<object>} The states.
 */
function statesOf(ids, specs, source, isText, language = 'en') {
  return specs.flatMap((spec) => {
    const value = spec.read(source, language);
    if (isText) {
      return value ? [{ device_feature_external_id: ids.feature(spec.key), text: value }] : [];
    }
    return Number.isInteger(value)
      ? [{ device_feature_external_id: ids.feature(spec.key), state: Math.min(value, MAX_COUNT) }]
      : [];
  });
}

/**
 * @description The states of a repository.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} repo - The repository snapshot.
 * @param {string} [language] - Language of the texts.
 * @returns {Array<object>} The states.
 */
function buildRepositoryStates(gladys, repo, language = 'en') {
  const ids = idsOf(gladys, DEVICE_TYPES.REPOSITORY, repo.id);
  return [
    ...statesOf(ids, REPOSITORY_COUNTERS, repo, false),
    ...statesOf(ids, REPOSITORY_TEXTS, repo, true, language),
  ];
}

/**
 * @description The states of the account.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} account - The account snapshot.
 * @returns {Array<object>} The states.
 */
function buildAccountStates(gladys, account) {
  return statesOf(
    idsOf(gladys, DEVICE_TYPES.ACCOUNT, account.id),
    ACCOUNT_COUNTERS,
    account,
    false,
  );
}

export {
  DEVICE_TYPES,
  MAX_COUNT,
  REPOSITORY_COUNTERS,
  REPOSITORY_TEXTS,
  ACCOUNT_COUNTERS,
  idsOf,
  idFromExternalId,
  itemLabel,
  releaseLabel,
  commitLabel,
  buildRepositoryDevice,
  buildAccountDevice,
  buildRepositoryStates,
  buildAccountStates,
};
