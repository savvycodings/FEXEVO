# Web e2e (Playwright)

The real FEXevo app runs as a web build at phone size, against a local BEXevo in **fakes mode**. The paid and home-PC AI calls (Modal analyzer, LLM, correction images and video, Resend) are served from fixtures, so a run is free and repeatable. Everything else is real: routing, auth, Postgres and uploads.

## Setup (once)

```bash
# BEXevo: local Postgres + pgvector in Docker (port 5444), schema from schema.ts
cd ../BEXevo && cp .env.e2e.example .env.e2e && pnpm db:e2e
# FEXevo: browsers for Playwright
cd ../FEXevo && npx playwright install chromium
```

## Run

```bash
pnpm e2e            # everything except @live; English and Spanish projects
pnpm e2e --project=en
pnpm e2e:live       # @live specs only: real providers, costs money (see BEXevo .env)
npx playwright show-report
```

`playwright.config.ts` starts or reuses two servers:
- BEXevo with `pnpm --dir ../BEXevo dev:e2e`. Its `.env.e2e` wins over `.env`: local database, fakes on.
- The web build: `pnpm web:export:e2e`, served on **:8090**.

To work by hand, run `pnpm web:local` (dev server on :8090 against local BEXevo) or `pnpm web:prod` (:8091 against production, for a quick check only). A badge in the corner shows which backend the app is using.

## Safety

The global setup refuses to run unless `GET /__e2e/health` reports `fakes: true` and the database is local (or `E2E_ALLOW_REMOTE_DB=1`, for a Neon test branch). BEXevo refuses to start fakes mode in production. Then it seeds these accounts, and saves a signed-in session per role in `e2e/.auth/`:

| Role | Email | Notes |
| --- | --- | --- |
| player | `e2e-player@xevo.test` | student, linked to the coach, 120 XP, one notification |
| coach | `e2e-coach@xevo.test` | coach of the player |
| admin | `e2e-admin@xevo.test` | admin hub gate password `axevodev` (set in both `.env.e2e` and the e2e web build) |

The password for all three is `E2E-test-password-1!`.

## Specs

| Spec | Covers |
| --- | --- |
| `onboarding-auth` | welcome slides; sign-in and reload; sign-up with the emailed code (fake outbox), account created, profile setup; password reset |
| `technique` | upload through the file picker, the analysis score, Magic Shot (correction video) to `done`, Activities |
| `magic-shot-video` | the pose-correction Magic Shot: result with the video, skeleton, overlay and corrections against the seeded pro reference. Its `@live` variant sends the same request to the real model on fal (about $0.20) |
| `progress` | progress overview, daily quests, achievements list and detail, leaderboard, notifications |
| `people` | coach review round trip (player sends, coach comments and submits, player sees it), clubs (create, approve, page, search), profile settings save, admin hub |
| `route-smoke` | every route opens on the web without crashing, as the role that uses it |
| `web-fallbacks` | screens using thumbnails and screenshots open cleanly; web thumbnails return a real frame |

The `es` project re-runs `onboarding-auth` and `technique` with a Spanish UI. Specs select controls by `data-testid` (from `testID`, defined in `src/lib/testIds.ts`), never by visible text.

## Notes

- **Navigation:** e2e builds (`EXPO_PUBLIC_E2E=1`) expose `window.__xevoNav.navigate(name, params)` to open any screen directly. Normal builds don't.
- **Unminified test build:** a crash shows real names (for example `birthDayInput`, not `Rt`). `--clear` stops a cached build from keeping another environment's backend URL.
- **Video:** Playwright 1.63's bundled Chromium decodes H.264, so the app's MP4s load. Generated videos are still checked by fetching them (status and MP4 `ftyp` header). Headless Google Chrome stalls on this app on macOS, so it isn't used.
- **Not on the web:**
  - Local push notifications are a no-op.
  - Saving to the camera roll isn't offered by the app.
  - Every other route opens; see `route-smoke`.
- **Port 8081** is often taken by another project's Metro server, which is why the harness uses 8090. BEXevo trusts it through `WEB_TEST_ORIGIN`.
