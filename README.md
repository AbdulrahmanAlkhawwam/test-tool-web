# Ejad Test Cases — Web

The front end of Ejad's test case tool: projects, test cases (in the Ejad template), test runs with
instant-save results, Excel import/export, dashboards and user admin.
Next.js 14 · Tailwind + shadcn/ui · TanStack Query. The backend is `ejad-testcases-api`.

The design spec is in `../ejad-testcases-api/docs/superpowers/specs/`, and the plans are in `docs/superpowers/plans/`.

## Local development

```bash
cp .env.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:3000/api
npm install
npm run dev                     # http://localhost:3001
```
The API must be running on port 3000 with `CORS_ORIGIN=http://localhost:3001`. Sign in with its seeded admin.

## GitLab automation

These features appear only when the API has GitLab configured (`GITLAB_URL` and the OAuth app; see "GitLab setup" in the API README). Without it, the app looks exactly like Phase 1.

- **Profile → GitLab:** each tester connects their own GitLab account. Everything the tool does in GitLab uses that account.
- **Project Settings → Repository** (admins): link the GitLab project, default branch, tests folder (e.g. `e2e`) and Playwright config.
- **Automation tab** (linked projects): browse the tests folder by branch and edit files in the Monaco editor. Save commits to your work branch `tests/<gitlab-username>/<work name>` and opens a merge request, never touching the default branch. The tab also shows coverage by `@TC-…` tags, the "Not automated yet" list, and the CI job to add to `.gitlab-ci.yml`.
- **Run tests** (Automation or Runs tab): starts a GitLab CI pipeline for a branch and scope. The automated run shows the pipeline status, refreshes every 10 s, and fills its results from GitLab's test report.

The editor is Monaco, served from `public/monaco`. `npm run dev` and `npm run build` copy it from `node_modules/monaco-editor` (the folder is git-ignored). If you add a Content-Security-Policy, allow `worker-src 'self' blob:` and `style-src 'self' 'unsafe-inline'` for the editor.

## Connect your AI (MCP)

The API hosts an MCP server at `<NEXT_PUBLIC_API_URL>/mcp` (i.e. `/api/mcp`), so Claude Code, Claude Desktop, Cursor
or any MCP client can read projects and write test cases for you.

- **Profile → AI access:** create a personal token (name + 30 / 90 / 180 day expiry, 90 by default). The full
  `ejad_pat_…` value is shown **once**, right after you create it — copy it then. It is never stored by this app: not in
  local storage, not in a URL, not in a log. Lost it? Revoke it and make another one. The same card has ready-made setup
  snippets for Claude Code, Claude Desktop and Cursor, already pointing at this deployment's API URL.
- The token acts as you, with your role. The list shows each token's name, visible prefix, when it was created, when it
  was last used and when it expires, with **Revoke** on the active ones.
- **AI drafts:** everything the AI writes arrives as an AI draft. Drafts carry an "AI draft" badge and stay out of runs,
  reports, dashboard counts and exports until a tester approves them. The Test Cases tab has an **AI drafts (N)** chip,
  per-row **Approve** / **Edit** / **Reject**, and checkbox selection with **Approve selected**. Rejecting a draft throws
  it away; its ID is never reused.
- **Suggested changes:** when the AI edits a case that is already approved, the edit arrives as a suggestion instead. The
  case page shows **Suggested changes by AI** — each field old → new with the AI's rationale — with **Accept** and
  **Reject**. If the case changed after the AI read it, Accept is refused and the panel reloads so you review the real
  current values.

## Tests

```bash
npm test            # unit/component tests (Vitest)
npm run e2e         # end-to-end happy path (Playwright; needs the API running)
```

## Deploy (Dokploy)

Build with the API's public URL. It is compiled into the bundle:
```bash
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.tests.ejad.example/api -t ejad-testcases-web .
```
The container serves on port 3001. On the API, set `CORS_ORIGIN` to this site's URL. If the web and API are on
different sites (not just different subdomains), also set `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true` there.
