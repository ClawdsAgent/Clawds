---
name: code-review
description: Review a git diff or branch for correctness bugs, risky changes and missing tests. Use when asked to review code, a branch or a pull request.
---

# Code review

1. Get the change: `git diff <base>...<branch>` (or `git diff` for uncommitted work). Read the whole diff before judging.
2. Look for real problems first: wrong logic, unhandled errors, off-by-one, race conditions, security issues (injection, path traversal, secrets), breaking API changes.
3. Then missing or weak tests, then maintainability. Skip pure style nits unless asked.
4. For every finding give: `file:line`, what is wrong, a concrete failing example, and the fix.
5. Rank findings by severity. If nothing is wrong, say so plainly and name what you checked.
6. Do not edit the code unless asked. Report in the chat, short.
