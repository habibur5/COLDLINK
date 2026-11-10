# Repository instructions

## Commit and push changes

For every task that changes project files, complete the work as a coherent Git commit and push that commit to the current branch's configured GitHub remote before reporting the task complete.

1. Check `git status` before editing so pre-existing work is identifiable.
2. Run the relevant checks, then review the staged diff and run `git diff --cached --check`.
3. Stage only files changed for the current task. Never include unrelated user changes in the commit.
4. Create a descriptive commit for the task and push the current branch to its configured remote. Do not force-push or rewrite shared history.
5. Verify the push succeeded and report the commit hash and result.

If a remote, permission, branch-protection rule, or other blocker prevents the push, preserve the local commit, do not bypass the blocker, and report exactly what remains to be done. If the task makes no project-file changes, no commit is needed.
