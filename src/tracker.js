// -----------------------------------------------------------------------------
// Scene trigger transitions: what happened on a repository between two
// rounds. Pure logic, no I/O.
//
// One event per transition, never a periodic snapshot:
//   - `release_published`     a release that was not there (an upcoming one
//                             counts on its release date);
//   - `issue_opened`          an issue numbered above the newest one seen;
//   - `merge_request_opened`  same for merge requests;
//   - `commit_pushed`         each new commit on the default branch;
//   - `star_added`            the star count went up;
//   - `pipeline_completed`    the last pipeline of the default branch
//                             succeeded, failed or was canceled.
//
// The first round of a repository is the baseline: it reports nothing, or a
// restart of the container would replay the latest release, issue and commit.
// At most RECENT_COUNT items of each kind are read per round, so a burst
// beyond that between two rounds reports its newest items only.
// -----------------------------------------------------------------------------

const SCENE_TRIGGERS = {
  RELEASE_PUBLISHED: 'release_published',
  ISSUE_OPENED: 'issue_opened',
  MERGE_REQUEST_OPENED: 'merge_request_opened',
  COMMIT_PUSHED: 'commit_pushed',
  STAR_ADDED: 'star_added',
  PIPELINE_COMPLETED: 'pipeline_completed',
};

const FINAL_PIPELINES = new Set(['success', 'failed', 'canceled']);

/**
 * @description The items numbered above every item seen before, oldest first.
 * @param {object[]} before - The previous items.
 * @param {object[]} after - The current items.
 * @returns {object[]} The new items.
 */
function newerItems(before, after) {
  const seen = Math.max(0, ...before.map((item) => item.number ?? 0));
  return after.filter((item) => Number.isInteger(item.number) && item.number > seen).reverse();
}

/**
 * @description The releases published since the previous round, oldest first.
 * @param {object[]} before - The previous releases.
 * @param {object[]} after - The current releases.
 * @returns {object[]} The new releases.
 */
function newerReleases(before, after) {
  const known = new Set(before.map((release) => release.id));
  const latest = Math.max(0, ...before.map((release) => release.publishedAt ?? 0));
  return after
    .filter((release) => !known.has(release.id) && (release.publishedAt ?? 0) >= latest)
    .sort((a, b) => (a.publishedAt ?? 0) - (b.publishedAt ?? 0));
}

/**
 * @description The commits pushed since the previous round, oldest first.
 * @param {object} before - The previous snapshot.
 * @param {object} after - The current snapshot.
 * @returns {object[]} The new commits.
 */
function newerCommits(before, after) {
  const head = before.commits[0];
  if (!head) {
    return after.commits.slice().reverse();
  }
  const index = after.commits.findIndex((commit) => commit.sha === head.sha);
  if (index !== -1) {
    return after.commits.slice(0, index).reverse();
  }
  // The previous head is out of reach (more commits than read, or a rewritten
  // history): the commits newer than it.
  return after.commits
    .filter((commit) => (commit.committedAt ?? 0) > (head.committedAt ?? 0))
    .reverse();
}

/**
 * @description What happened between two snapshots of a repository.
 * @param {object|null} before - The previous snapshot (null: first round).
 * @param {object} after - The current snapshot.
 * @returns {Array<{ key: string }>} The events, each with its item.
 * @example
 * diffRepository(previous, current); // -> [{ key: 'star_added', stars: 12, added: 1 }]
 */
function diffRepository(before, after) {
  if (!before) {
    return [];
  }
  const events = [];
  newerReleases(before.releases, after.releases).forEach((release) =>
    events.push({ key: SCENE_TRIGGERS.RELEASE_PUBLISHED, release }),
  );
  newerItems(before.issues, after.issues).forEach((item) =>
    events.push({ key: SCENE_TRIGGERS.ISSUE_OPENED, item }),
  );
  newerItems(before.mergeRequests, after.mergeRequests).forEach((item) =>
    events.push({ key: SCENE_TRIGGERS.MERGE_REQUEST_OPENED, item }),
  );
  newerCommits(before, after).forEach((commit) =>
    events.push({ key: SCENE_TRIGGERS.COMMIT_PUSHED, commit }),
  );
  if (Number.isInteger(before.stars) && Number.isInteger(after.stars)) {
    if (after.stars > before.stars) {
      events.push({
        key: SCENE_TRIGGERS.STAR_ADDED,
        stars: after.stars,
        added: after.stars - before.stars,
      });
    }
  }
  const pipeline = after.pipeline;
  if (pipeline && FINAL_PIPELINES.has(pipeline.status)) {
    const previous = before.pipeline;
    if (previous?.id !== pipeline.id || previous?.status !== pipeline.status) {
      const commit = after.commits.find((c) => c.sha === pipeline.sha) ?? after.commits[0] ?? null;
      events.push({
        key: SCENE_TRIGGERS.PIPELINE_COMPLETED,
        state: pipeline.status,
        pipeline,
        commit,
      });
    }
  }
  return events;
}

export { SCENE_TRIGGERS, diffRepository };
