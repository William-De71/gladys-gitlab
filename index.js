// -----------------------------------------------------------------------------
// Entry point of the GitLab external integration.
//
// Follows GitLab projects (gitlab.com or a self-managed GitLab) and brings
// them into Gladys:
//   - a device per project and one for the account of the token
//     (Discovery screen): stars, forks, open issues and merge requests, the
//     latest release, tag, commit, issue, merge request and pipeline;
//   - scene triggers: release published, issue / merge request opened,
//     commit pushed, star added, pipeline of the default branch completed;
//   - a scene action: read a project's figures;
//   - dashboard widgets: a project, the latest activity, the account.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the GitLab integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
