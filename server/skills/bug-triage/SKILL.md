---
name: bug-triage
description: Find the root cause of a bug and fix it with the smallest change. Use when something is broken, flaky, or an error message needs diagnosing.
---

# Bug triage

1. Reproduce first. Write down the exact steps, input and the observed vs expected result. If you cannot reproduce it, say so and ask for details.
2. Narrow it down: read the error and the stack trace, check recent changes (`git log -p -n 5 -- <file>`), add a temporary log or a failing test.
3. Name the root cause in one sentence before changing anything.
4. Fix at the narrowest responsible place. Keep unrelated code untouched.
5. Prove the fix: the failing test now passes, the original steps work, related tests still pass.
6. Report: cause, fix (files), proof. If the fix is risky or large, propose it instead of applying it.
