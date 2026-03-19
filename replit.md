# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + Framer Motion

## Artifacts

### RafflePop (`artifacts/rafflepop`)
A "Watch to Win" daily raffle web app. Features:
- Home: jackpot display, ticket count, "Watch to Play" ad button, countdown to midnight draw (WAT)
- Daily streak tracker with 7-day dot display and milestone rewards
- Stats page: jackpot, participants, odds, and stat cards
- Winners page: past draw winners with emoji, username, prize, date
- Profile page: user summary and menu items
- Win popup with confetti animation
- All API calls via React Query generated hooks

### API Server (`artifacts/api-server`)
Express 5 backend serving the RafflePop API.

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── rafflepop/          # React + Vite frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

- `users` — user profile, tickets, streak, ad watch tracking
- `draws` — past draw results (winners, prize, date)

## API Endpoints

- `GET /api/user/me` — get current user
- `POST /api/user/watch-ad` — earn a ticket by watching ad
- `POST /api/user/claim-streak` — claim daily streak reward
- `GET /api/raffle/stats` — jackpot, pool size, odds
- `GET /api/draws` — past winners list

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes
