# VolleyBoard

A real-time volleyball match tracking platform where team staff record the game live and every connected device stays in sync.

## Overview

VolleyBoard lets team staff record every action as the match unfolds. Each action is validated against the game rules and shared instantly with everyone following the match, on any device. When the match ends, the recorded data becomes a detailed match report and season statistics for every player.

![Live match](docs/assets/live-analyst.png)

| Coach view | Phone view |
|---|---|
| ![Coach view](docs/assets/live-coach.png) | ![Phone view](docs/assets/live-phone.png) |

![Match report](docs/assets/report.png)

## Features

- **Live match tracking:** staff record each action as it happens, and the score, rotation and statistics update in **real time**.
- **Synchronized devices:** every screen in a match receives the same ordered updates and **resyncs automatically** when it falls behind.
- **Rule enforcement:** rotations, substitutions, time-outs and challenges are **validated on the server**, so invalid actions never reach the match.
- **Safe concurrent editing:** several staff members can record at the same time **without conflicting updates**, and retried scoring requests are **saved once**.
- **Corrections:** the latest point or coded event can be **undone**, and a point can be **reversed** after a successful challenge.
- **Role-based access:** each team role with his own permissions.
- **Reports and profiles:** finished matches become **detailed reports**, and every player gets **season statistics**.
- **Responsive interface:** designed for different devices, with every view fitting a single screen.

## Architecture

```mermaid
flowchart LR
    C["React client"] <-->|REST| A["Express API"]
    C <-->|WebSocket| S["Socket.io"]
    A --> P[("PostgreSQL")]
    A -->|domain events| S
    S <--> R[("Redis")]

    classDef client fill:none,stroke:#38D9A9,stroke-width:2px
    classDef api fill:none,stroke:#12B886,stroke-width:2px
    classDef socket fill:none,stroke:#099268,stroke-width:2px
    classDef store fill:none,stroke:#087F5B,stroke-width:2px
    class C client
    class A api
    class S socket
    class P,R store
```

- **Express API:** layered as routes -> controllers -> services -> database.
- **Rules engine:** pure functions in `fsm/match.fsm.ts` and `rotation.service.ts`, with no database access.
- **Event bus:** services publish domain events, and `socket/match.publisher.ts` is the only place that emits to Socket.io.
- **PostgreSQL (Prisma):** the source of truth.
- **Redis:** Socket.io adapter for sharing match rooms across API instances.

Request flow for a live action:

```text
controller  -> validate the request
service     -> check permission, lock the set row, apply the rules
transaction -> save the action, new state and set version together
commit      -> publish domain events -> broadcast to the match room
```

## Design Decisions

1. **Pure rules:**

   Game rules are plain functions (state in, decision out), so they are **tested without a database**.

2. **Broadcast after commit:**

   Events are published **only after the transaction commits**, so clients never see unsaved changes.

   ```ts
   const { result, events } = await prisma.$transaction(async (tx) => {
     const scored = await scorePointWithin(tx, setId, userId, scorer, { clientEventId })
     return { result: scored.result, events: await stampWithin(tx, setId, scored.events) }
   })
   publishAll(events)
   ```

3. **Row locks:**

   Live actions lock the set row (`SELECT ... FOR UPDATE`), so concurrent requests on the same set **run one at a time**.

4. **Versioned updates:**

   Every set-level change increments a **set version**. The client ignores old messages and **reloads a full snapshot** when it detects a gap.

5. **Idempotent scoring:**

   Point and event-coding requests accept a `clientEventId` with a unique constraint, so a retried request is **saved once**.

6. **Undo:**

   The **latest point or coded event** in a set can be undone. Points store the state from before them, which undo restores.

7. **One permission table:**

   Role permissions are defined once in `lib/permissions.ts` and **checked in the services**.

## Tech Stack

| Layer | Tools |
|---|---|
| Backend | Node.js, TypeScript, Express 5 |
| Database | PostgreSQL, Prisma |
| Real time | Socket.io, Redis adapter |
| Frontend | React 19, Vite, Tailwind CSS |
| Testing | Vitest |

## Getting Started

Requirements: Node.js 22+ and Docker.

```sh
docker compose up -d
```

Create `backend/.env`:

```text
DATABASE_URL=postgresql://postgres:password@localhost:5432/volleyboard
JWT_SECRET=change-me
PORT=3000
REDIS_URL=redis://localhost:6379
```

Backend:

```sh
cd backend
npm install
npx prisma migrate deploy
npm run dev
```

Frontend (second terminal):

```sh
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` and register an account to get started.

## API Overview

All routes start with `/api/v1` and require a JWT, except register and login.

| Area | Routes |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Teams | `/teams`, `/teams/:teamId/players`, `/teams/:teamId/lineups`, `/teams/:teamId/matches` |
| Matches | `POST /matches/:matchId/start`, `GET /matches/:matchId/live`, `GET /matches/:matchId/report`, `POST /matches/:matchId/next-set`, `POST /matches/:matchId/end` |
| Scoring | `POST /matches/sets/:setId/point`, `POST /sets/:setId/events`, `DELETE /sets/:setId/events/last` |
| Set actions | `POST /sets/:setId/libero`, `POST /sets/:setId/substitutions`, `POST /sets/:setId/timeouts`, `POST /sets/:setId/challenges`, `POST /sets/:setId/challenges/:challengeId/resolve` |

## Testing

```sh
cd backend && npx vitest run src
cd frontend && npm test
```

Backend tests cover the rules engine, permissions, scoring, set versions and stats. Frontend tests cover live state handling.

## Notes

The backend CORS origin and the frontend API and socket URLs are hardcoded to `localhost`. Deploying requires changing them in code.
