// -----------------------------------------------------------------------------
// The `group/*` and `group/prefix*` patterns of the projects field.
//
// A pattern is expanded into the projects of its group (subgroups included)
// or user whose name starts with the prefix, case-insensitive: forks and
// archived projects are left out, the most recently active come first. The
// projects named in full come before every pattern, and the whole list stays
// within the 30 projects a round reads.
//
// The owners' lists are read again every hour, and at once when the patterns
// or the token change: a new repository shows up on the Discovery screen
// within the hour. A failed read keeps the last lists (or none yet): the
// repositories named in full are read anyway.
// -----------------------------------------------------------------------------

import { MAX_REPOSITORIES } from './gitlab-api.js';

const EXPAND_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * @description Merge the repositories named in full and those of the patterns.
 * @param {string[]} exact - `owner/name`, as configured.
 * @param {Array<{ owner: string, prefix: string }>} patterns - The patterns.
 * @param {Map<string, string[]>} listings - Lowercased owner -> its repositories.
 * @returns {{ repositories: string[], matched: number }} At most 20
 * repositories, and how many there were before the cap.
 * @example
 * expandPatterns(['a/x'], [{ owner: 'b', prefix: '' }], new Map([['b', ['b/y']]]));
 * // -> { repositories: ['a/x', 'b/y'], matched: 2 }
 */
function expandPatterns(exact, patterns, listings) {
  const seen = new Set();
  const all = [];
  const add = (full) => {
    const key = full.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      all.push(full);
    }
  };
  exact.forEach(add);
  patterns.forEach(({ owner, prefix }) => {
    const wanted = prefix.toLowerCase();
    (listings.get(owner.toLowerCase()) ?? [])
      .filter((full) => full.split('/').at(-1).toLowerCase().startsWith(wanted))
      .forEach(add);
  });
  return { repositories: all.slice(0, MAX_REPOSITORIES), matched: all.length };
}

/**
 * @description Create the resolver of the followed repositories.
 * @param {object} options - Options.
 * @param {object} options.gitlab - The GitLab client (`listRepositories`).
 * @param {Function} options.getConfig - `() => config` (token, repositories, patterns).
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {object} [options.logger] - Logger.
 * @returns {object} The resolver.
 * @example
 * const followed = createResolver({ gitlab, getConfig: () => config });
 * await followed.resolve(); // -> ['GladysAssistant/Gladys', …]
 */
function createResolver({ gitlab, getConfig, now = () => Date.now(), logger = console }) {
  // Lowercased owner -> its repositories, for the patterns of `signature`.
  let listings = new Map();
  let signature = null;
  let readAt = null;
  let last = { repositories: [], matched: 0 };
  // The capped count last warned about: once, not every round.
  let warned = 0;

  const signatureOf = (config) =>
    JSON.stringify([
      config.url,
      config.token,
      config.patterns.map((pattern) => pattern.owner.toLowerCase()),
    ]);

  /**
   * @description Read the owners' lists.
   * @param {object} config - The config.
   * @returns {Promise<void>}
   */
  async function readOwners(config) {
    const owners = [...new Set(config.patterns.map((pattern) => pattern.owner))];
    const next = new Map();
    for (const owner of owners) {
      if (next.has(owner.toLowerCase())) {
        continue;
      }
      const { found, repositories } = await gitlab.listRepositories(owner);
      if (!found) {
        logger.warn(`No GitLab group or user named ${owner}`);
      }
      next.set(owner.toLowerCase(), repositories);
    }
    listings = next;
    signature = signatureOf(config);
    readAt = now();
  }

  /**
   * @description The repositories as of the last read of the owners, without reading.
   * @returns {string[]} At most 20 `owner/name`.
   */
  function current() {
    const config = getConfig();
    last = expandPatterns(
      config.repositories,
      signature === signatureOf(config) ? config.patterns : [],
      listings,
    );
    return last.repositories;
  }

  return {
    /**
     * @description The followed repositories, the owners read again when due.
     * @param {object} [options] - `{ force }` to read the owners now.
     * @returns {Promise<string[]>} At most 20 `owner/name`.
     */
    async resolve({ force = false } = {}) {
      const config = getConfig();
      const due =
        force ||
        signature !== signatureOf(config) ||
        readAt === null ||
        now() - readAt >= EXPAND_MAX_AGE_MS;
      if (config.patterns.length > 0 && due) {
        try {
          await readOwners(config);
        } catch (err) {
          logger.warn(`Unable to list the repositories of the patterns: ${err.message}`);
        }
      }
      const repositories = current();
      if (last.matched > repositories.length && last.matched !== warned) {
        warned = last.matched;
        logger.warn(
          `${last.matched} repositories match, only the first ${repositories.length} are followed`,
        );
      }
      return repositories;
    },
    current,
    /** @returns {{ repositories: string[], matched: number }} The last result. */
    last: () => last,
  };
}

export { EXPAND_MAX_AGE_MS, expandPatterns, createResolver };
