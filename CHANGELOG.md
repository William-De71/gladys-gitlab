# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - unreleased

### Added

- **devices:** GitLab projects (gitlab.com or a self-managed GitLab) through the official REST API v4, read only, with a `read_api` access token; one device per project with stars, forks, open issues, open and merged merge requests, the latest release, tag, commit, issue and merge request, and the pipeline of the default branch; one device for the account with followers, following and projects
- **scenes:** triggers when a release is published, an issue or a merge request is opened, a commit lands on the default branch, a star is added, and the pipeline of the default branch succeeds, fails or is canceled; an action that reads a project, with a ready-made sentence
- **widgets:** a project at a glance, the latest activity of the followed projects, and the account with the API quota left
- **configuration:** instance address, access token, projects with `group/*` and `group/prefix*` patterns (subgroups included), reading interval, language, "Test the connection" button
- **i18n:** English, French, German and Spanish for the manifest, the runtime texts, the documentation and the README
