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
