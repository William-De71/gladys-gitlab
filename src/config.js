// -----------------------------------------------------------------------------
// Configuration of the GitLab integration.
//
// Fields of the config_schema:
//   - `url`            the GitLab instance: https://gitlab.com by default, or
//                      the address of a self-managed GitLab;
//   - `token`          a personal (or group / project) access token with the
//                      `read_api` scope: the API needs one;
//   - `repositories`   the projects to follow, `group/project` (subgroups
//                      included: `group/subgroup/project`) or their URL,
//                      separated by commas or new lines; `group/*` follows
//                      every project of a group (subgroups included) or of a
//                      user, `group/prefix*` those whose name starts with the
//                      prefix (see patterns.js);
//   - `poll_interval`  how often GitLab is read, in seconds;
//   - `language`       language of the texts Gladys does not ask for in a
//                      language (device names, scene summaries): `auto`
//                      follows the language of the last widget request.
//
// Internal key, outside the config_schema (never shown in the UI):
//   - `last_language`  language of the last widget request, for the device
//                      names and the scene texts after a restart.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';
import { MAX_REPOSITORIES, DEFAULT_BASE_URL } from './gitlab-api.js';

const POLL_INTERVAL = { min: 60, max: 3600, default: 120 };
const AUTO_LANGUAGE = 'auto';
// A namespace or project path segment: letters, digits, "_", "." and "-",
// not starting with "-" nor ending with "." (GitLab rules, loosely).
const SEGMENT = '[A-Za-z0-9_][A-Za-z0-9_.-]{0,254}';
// `group/project`, up to 20 nested groups.
const REPOSITORY_REGEX = new RegExp(`^(?:${SEGMENT}/){1,20}${SEGMENT}$`);
// `group/*` or `group/sub/prefix*`: the star only at the end.
const PATTERN_REGEX = new RegExp(`^((?:${SEGMENT}/){0,19}${SEGMENT})/([A-Za-z0-9_.-]{0,254})\\*$`);
// Patterns are expanded into projects, 30 at most in all: a few patterns are
// plenty.
const MAX_PATTERNS = 10;

const INTERNAL_KEYS = { language: 'last_language' };

/**
 * @description Read the address of the instance.
 * @param {unknown} raw - The raw field.
 * @returns {string} `https://host[/path]` without a trailing slash nor
 * `/api/v4`; gitlab.com when empty or not an http(s) address.
 * @example
 * readBaseUrl('gitlab.example.com/'); // -> 'https://gitlab.example.com'
 */
function readBaseUrl(raw) {
  let value = readString(raw);
  if (!value) {
    return DEFAULT_BASE_URL;
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) && !/^https?:\/\//i.test(value)) {
    return DEFAULT_BASE_URL;
  }
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
      return DEFAULT_BASE_URL;
    }
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '').replace(/\/api\/v4$/i, '');
  } catch {
    return DEFAULT_BASE_URL;
  }
}

/**
 * @description Read a bounded number field, falling back to its default.
 * @param {unknown} raw - The raw value (the form can send numbers as strings).
 * @param {{ min: number, max: number, default: number }} bounds - The bounds.
 * @returns {number} The value.
 * @example
 * readNumber('300', POLL_INTERVAL); // -> 300
 */
function readNumber(raw, bounds) {
  const value = Number(raw ?? bounds.default);
  if (raw === '' || !Number.isFinite(value)) {
    return bounds.default;
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

const readString = (raw) => (typeof raw === 'string' ? raw.trim() : '');

/**
 * @description The path of an entry: `group/project`, or the path of a GitLab
 * URL (any host), without `.git` nor what follows `/-/`.
 * @param {string} raw - The entry.
 * @returns {string} The path.
 */
function pathOf(raw) {
  let value = raw.trim();
  const url = /^(https?:\/\/)?[^/\s]+\.[^/\s]+\/(.+)$/i.exec(value);
  // A host is only taken out when it is one: a scheme, or a path of at least
  // two segments left after it (`my.group/project` stays a project path).
  if (
    url &&
    (url[1] ||
      url[2]
        .replace(/\/-\/.*$/, '')
        .replace(/\/+$/, '')
        .includes('/'))
  ) {
    value = url[2];
  }
  return value
    .replace(/\/-\/.*$/, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '');
}

/**
 * @description Read one project: `group/project`, with subgroups, or its URL.
 * @param {string} raw - The entry.
 * @returns {string|null} The path, null when it cannot be one.
 * @example
 * parseRepository('https://gitlab.com/gitlab-org/cli/-/issues'); // -> 'gitlab-org/cli'
 */
function parseRepository(raw) {
  const value = pathOf(raw);
  if (value.endsWith('*') || value.split('/').some((part) => part.endsWith('.'))) {
    return null;
  }
  return REPOSITORY_REGEX.test(value) ? value : null;
}

/**
 * @description Read one pattern: `group/*` or `group/prefix*`, also as a link.
 * @param {string} raw - The entry.
 * @returns {{ owner: string, prefix: string, text: string }|null} The pattern,
 * null when the entry is not one.
 * @example
 * parsePattern('gitlab-org/gitlab-*'); // -> { owner: 'gitlab-org', prefix: 'gitlab-', text: 'gitlab-org/gitlab-*' }
 */
function parsePattern(raw) {
  const value = pathOf(raw);
  const match = PATTERN_REGEX.exec(value);
  return match ? { owner: match[1], prefix: match[2], text: value } : null;
}

/**
 * @description The entries of the repositories field.
 * @param {unknown} raw - The raw field.
 * @returns {string[]} The entries.
 */
const entries = (raw) =>
  readString(raw)
    .split(/[\s,;]+/)
    .filter(Boolean);

/**
 * @description Parse the patterns of the repositories field, duplicates removed.
 * @param {unknown} raw - The raw field.
 * @returns {Array<{ owner: string, prefix: string, text: string }>} The patterns.
 * @example
 * parsePatterns('octo/*, octo/a'); // -> [{ owner: 'octo', prefix: '', text: 'octo/*' }]
 */
function parsePatterns(raw) {
  const seen = new Set();
  return entries(raw)
    .map(parsePattern)
    .filter((pattern) => {
      const key = pattern?.text.toLowerCase();
      if (!pattern || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, MAX_PATTERNS);
}

/**
 * @description Parse the repositories field: separated by commas, semicolons,
 * spaces or new lines, invalid entries dropped, duplicates removed
 * (GitLab paths are case-insensitive), capped.
 * @param {unknown} raw - The raw field.
 * @returns {string[]} The repositories, as typed.
 * @example
 * parseRepositories('octo/a, Octo/A; octo/b'); // -> ['octo/a', 'octo/b']
 */
function parseRepositories(raw) {
  const seen = new Set();
  const list = [];
  entries(raw)
    .map(parseRepository)
    .filter(Boolean)
    .forEach((full) => {
      const key = full.toLowerCase();
      if (!seen.has(key) && list.length < MAX_REPOSITORIES) {
        seen.add(key);
        list.push(full);
      }
    });
  return list;
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {{ url: string, token: string, repositories: string[], patterns: object[], pollInterval: number, language: string }}
 * The config (poll interval in seconds, language 'auto' or a language code).
 * @example
 * normalizeConfig({ token: 'glpat-…', repositories: 'gitlab-org/cli' });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  return {
    url: readBaseUrl(config.url),
    // A token never holds spaces: a pasted one may carry a new line.
    token: readString(config.token).replace(/\s+/g, ''),
    repositories: parseRepositories(config.repositories),
    patterns: parsePatterns(config.repositories),
    pollInterval: readNumber(config.poll_interval, POLL_INTERVAL),
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

/**
 * @description Read the stored language of the last request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 * @example
 * readLanguage({ last_language: 'fr' }, 'en'); // -> 'fr'
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : fallback;
}

export {
  POLL_INTERVAL,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  normalizeConfig,
  readBaseUrl,
  parseRepository,
  parseRepositories,
  parsePattern,
  parsePatterns,
  readLanguage,
};
