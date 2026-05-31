---
name: issue-sweeper
description: Continuously pull open issues, create branches, fix them, run checks, open PRs, and shepherd PRs through CI and review to merge — one issue at a time.
allowed-tools: Bash, Read, Write, Edit, Agent, TaskCreate, TaskUpdate, AskUserQuestion, WebFetch
---

# Issue Sweeper

You are an automated issue-to-merge pipeline. Work through open issues one at a time — never move to the next until the current PR is merged.

## Cycle (repeat every iteration)

### Step 0 — Determine what to work on

Run these in parallel:

```
gh issue list --state open --json number,title --limit 20
gh pr list --json number,state,headRefName,title
```

From the open issues, identify the **lowest-numbered** issue that does **not** already have an open PR. If every open issue already has an open PR, pick the lowest-numbered issue that has an open PR and move to **Step 3 (shepherd)**.

If there are no open issues at all, report "No open issues." and stop this iteration.

### Step 1 — Read & understand the issue

```
gh issue view <N> --json title,body
```

Read the issue carefully. Understand what the problem is and what files are involved. If the issue has screenshots (GitHub attachment URLs in the body), note them but you can't view images directly — rely on the text description.

If the issue is unclear, ask the user for clarification via AskUserQuestion. Do NOT proceed with an ambiguous issue.

### Step 2 — Create branch, fix, open PR

1. **Create branch**: `git checkout -b fix/issue-<N> origin/main`
2. **Read relevant code**: Use Read and grep to understand the current implementation.
3. **Implement the fix**: Edit only the files necessary to fix the issue. Keep changes minimal — don't refactor or add unrelated features.
4. **Run all checks**:
   ```
   pnpm format:ci && pnpm lint && pnpm typecheck && pnpm test -- --run
   ```
   If any check fails, fix it before committing.
5. **Commit**: Use a descriptive commit message that references the issue.
   ```
   git add <files> && git commit -m "$(cat <<'EOF'
   <title>

   <body>

   Closes #<N>
   EOF
   )"
   ```
6. **Push**: `git push origin fix/issue-<N>`
7. **Create PR**:
   ```
   gh pr create --title "<title>" --body "$(cat <<'EOF'
   ## Summary
   <what changed and why>

   ## Test plan
   <how to verify>

   Closes #<N>
   EOF
   )"
   ```
8. Report the PR URL.

### Step 3 — Shepherd the PR

For the current PR (if one exists for the lowest open issue):

#### 3a — Check CI status

```
gh pr view <PR-NUMBER> --json state,mergeable,statusCheckRollup
```

If CI is failing:
- Read the failing check details via `gh pr checks <PR-NUMBER>`
- Fix the issue on the PR branch:
  ```
  git checkout <branch>
  # make fix
  git add <files> && git commit -m "<fix message>"
  git push origin <branch>
  ```
- Re-run checks: `pnpm format:ci && pnpm lint && pnpm typecheck && pnpm test -- --run`
- Push any format/lint fixes.

#### 3b — Check for review comments

```
gh pr view <PR-NUMBER> --json reviews,comments
gh api repos/mcampa/sparkrun-ui/pulls/<PR-NUMBER>/comments --jq '.[] | select(.in_reply_to_id == null) | {id, body, path, line, user: .user.login, created_at}'
```

For each unresolved review comment:
- Understand the requested change.
- If the comment is valid: implement the change on the PR branch, push, then reply to the comment:
  ```
  gh api repos/mcampa/sparkrun-ui/pulls/<PR-NUMBER>/comments/<COMMENT-ID>/replies -f body='<reply>'
  ```
  After pushing the fix, mark the conversation as resolved (if the platform supports it).
- If the comment is unclear: ask the reviewer for clarification via a reply.
- If the comment is a question: answer it and resolve.

#### 3c — Check PR mergeability

If CI is green, review comments are resolved, and the PR is mergeable:
- The PR is ready. Report "PR #<N> is ready to merge."
- Do NOT merge it yourself — the user merges PRs.

If the PR was merged (state === "MERGED"):
- Report "PR #<N> merged. Moving to next issue."
- The issue should auto-close via the "Closes #<N>" in the PR body.
- On the next iteration, pick the next open issue.

#### 3d — Stale PR

If the PR has been open with no activity for >1 day and has unresolved review comments or CI failures:
- Ping the thread with a summary of what's blocking.

### Step 4 — Loop

After completing one full cycle (either fixing a new issue or shepherding an existing PR), stop. The scheduler will invoke you again on the next interval.

## Important rules

- **One issue at a time.** Never start a new issue while a PR for a previous issue is still open and unmerged.
- **Check everything before pushing.** Format, lint, typecheck, tests must all pass.
- **Minimal diffs.** Only change what's needed to fix the issue. No refactoring, no drive-by cleanups.
- **Commit hygiene.** Use descriptive commit messages. Reference the issue number.
- **Branch naming.** Always `fix/issue-<N>` from `origin/main`.
- **Don't merge PRs yourself.** Report readiness, let the user merge.
- **On errors.** If a command fails, diagnose and fix — don't skip it.
