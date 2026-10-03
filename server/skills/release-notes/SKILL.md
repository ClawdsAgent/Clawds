---
name: release-notes
description: Write release notes or a changelog from git history. Use when preparing a release, a version bump or a summary of recent work.
---

# Release notes

1. Find the range: last tag to HEAD (`git describe --tags --abbrev=0`, then `git log <tag>..HEAD --oneline --no-merges`).
2. Group changes for a reader, not for a developer: **New**, **Improved**, **Fixed**, and **Notes** (breaking changes, requirements).
3. One line per change, written as the user-visible effect, no commit hashes in the text.
4. Merge related commits into one line. Drop pure refactors and chores unless they matter.
5. Put anything that can break users (config, data, API) at the top under **Notes**.
6. Output Markdown. Write it in the language of the project README unless told otherwise.
