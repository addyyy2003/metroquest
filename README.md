# MetroQuest

MetroQuest turns three conventional metro feedback questions into a short, mobile-friendly ride recap. The prototype asks about crowding, platform waiting time, and journey disruption while keeping each survey measurement intact.

## Features

- Six-stage experience: welcome, demo route, three survey rounds, and completion summary.
- Interactive train-crowding illustrations, time selection, and a journey timeline.
- Changeable answers, guarded progression, progress indicator, and replay.
- Per-question response times and total session duration measured from actual interactions.
- Session-only event log and independent quality and engagement indicators.
- Demo-only credit note; no real reward is issued and no travel history is accessed.

## Technology

React 19, Vite, JavaScript, Tailwind CSS v4, React hooks, and local structured question data. There is no backend, database, authentication, or external API.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Create a production bundle with `npm run build`; preview it with `npm run preview`.

## Project structure

```text
src/
  data/questions.js       Survey wording and answer options
  lib/events.js           In-memory session event logger
  lib/scoring.js          Pure quality and engagement indicators
  App.jsx                 Six-stage experience and UI components
  index.css               Tailwind import and responsive visual system
CHALLENGE-1-ARCHITECTURE.md
CHALLENGE-2-AGEGUARD.md
```

## Interaction and scoring

The event logger records actual starts, each question view, answer changes, submissions, round completions, and session completion. It timestamps question visibility and answer submissions, calculates each response duration in milliseconds, and records total session duration. Revisiting a question starts a new view interval; answer changes are logged separately, and the indicator uses only the latest submitted response time per question to avoid double-counting. The logger exposes cloned, read-only snapshots through `getAllEvents()` and `getSessionEvents(sessionId)`. Events remain in memory; refreshing the page clears them. Quality and engagement are reported independently. Quality currently includes response-time plausibility and completeness only; consistency and repeated-pattern metrics need more evidence and remain unavailable. Engagement includes completion, participation, and round progression; voluntary return is unavailable in a single session. Missing metrics do not receive points. A quality indicator describes response conditions and is not proof that an answer is true.

## Demo limitations

Andheri → Ghatkopar is illustrative sample journey context and is not based on a user’s travel history. The 60–90 second duration is an estimate, not a guaranteed completion time. Ride credit is illustrative and not issued. Events and scores are local, temporary, and not submitted to any service. Quality metrics are intentionally partial; the app does not detect fraud or validate a response. Both challenge documents are proposals, not implemented infrastructure.

## Deploy to Vercel

1. Push this project to a Git provider and import it in Vercel, or run `vercel` from the project directory.
2. Select **Vite** as the framework preset.
3. Use `npm run build` as the build command and `dist` as the output directory.
4. No environment variables are required.

Vite’s static output works with Vercel’s default SPA handling. Deploy a preview first, check the full flow at desktop and mobile widths, then promote the deployment.
