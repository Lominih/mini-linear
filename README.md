# Mini Linear

A lightweight project management tool inspired by Linear, built with Next.js 16, tRPC, Prisma, and SQLite.

## Features

- **Issue Tracking** — Kanban board, list view, and timeline views with drag-and-drop reordering
- **Sprint Planning** — Create sprints, auto-suggest backlog issues, track sprint health and burndown charts
- **Custom Fields** — Define text, number, select, multi-select, date, and person fields per project
- **RBAC** — System roles (Owner, Admin, Member, Viewer) with per-project role granularity
- **Auth** — JWT-based authentication with access/refresh token pairs, bcrypt password hashing
- **Search** — Full-text search with relevance ranking across issue titles and descriptions
- **Filters** — Composable AND/OR filter groups with sort orders and Prisma query building
- **Real-time** — Socket.io integration for live issue updates and typing indicators
- **Burndown Charts** — Sprint burndown and velocity charts powered by Recharts
- **Audit Logging** — Track all create, update, delete, assign, and comment actions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| API | tRPC v11 |
| ORM | Prisma 7 (SQLite) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Validation | Zod v4 |
| UI | Tailwind CSS v4 + Radix UI |
| Charts | Recharts |
| Realtime | Socket.io |
| Testing | Vitest + Playwright |

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
git clone <repo-url>
cd mini-linear
npm install
```

### Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your secrets. The defaults work for local development.

### Database Setup

```bash
npx prisma db push
npx prisma generate
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

### Unit Tests (Vitest)

```bash
npm run test            # Run once
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage report
```

Unit tests live in `src/server/__tests__/`:

| Test File | Module Under Test |
|-----------|-------------------|
| `auth.test.ts` | JWT tokens, password hashing, email/password validation |
| `rbac.test.ts` | Role hierarchy, permission checks, project permissions |
| `state-machine.test.ts` | Issue status transitions, workflow configuration |
| `filter-engine.test.ts` | Filter application, Prisma where clause building, sorting |
| `search.test.ts` | Full-text search with relevance ranking |
| `sprint-planning.test.ts` | Sprint start/complete validation |
| `burndown.test.ts` | Burndown chart data calculation |
| `custom-fields.test.ts` | Custom field validation, defaults, merge, serialization |

### E2E Tests (Playwright)

```bash
npx playwright install   # Install browsers (first time only)
npm run test:e2e         # Run tests
npm run test:e2e:ui      # Interactive UI mode
```

E2E tests live in `e2e/`:

| Spec File | Coverage |
|-----------|----------|
| `auth.spec.ts` | Login, register, protected routes |
| `project.spec.ts` | Project list, creation, board navigation |
| `issue.spec.ts` | Issue board, creation, detail, filters |
| `sprint.spec.ts` | Sprint list, creation, detail, actions |

## Docker

### Build and Run

```bash
docker compose up -d
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
docker compose build
docker compose up -d
```

### Tear Down

```bash
docker compose down -v
```

The multi-stage Dockerfile:

1. **deps** — Installs node_modules
2. **prisma** — Generates Prisma client
3. **builder** — Builds the Next.js app
4. **runner** — Minimal Alpine image with only production artifacts

## Project Structure

```
mini-linear/
├── prisma/                  # Prisma schema & migrations
├── public/                  # Static assets
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── (app)/           # Authenticated layouts
│   │   ├── api/             # API routes (tRPC, auth, register)
│   │   └── auth/            # Login & register pages
│   ├── components/          # React components (UI, layout, providers)
│   ├── generated/           # Prisma generated client
│   ├── hooks/               # React hooks (realtime, notifications, socket)
│   ├── lib/                 # Client-side utilities (tRPC client)
│   └── server/              # Server-side logic
│       ├── charts/          # Burndown & velocity calculations
│       ├── routers/         # tRPC router definitions
│       ├── views/           # Kanban, list, timeline view builders
│       ├── auth.ts          # JWT & password utilities
│       ├── rbac.ts          # Role-based access control
│       ├── state-machine.ts # Issue workflow state machine
│       ├── filter-engine.ts # Filter parsing & Prisma query building
│       ├── search.ts        # Full-text issue search
│       ├── sprint-planning.ts # Sprint validation & capacity
│       ├── custom-fields.ts # Custom field definitions & validation
│       └── __tests__/       # Unit tests
├── e2e/                     # Playwright E2E tests
├── Dockerfile               # Multi-stage production build
├── docker-compose.yml       # Docker Compose configuration
├── vitest.config.ts         # Vitest configuration
├── playwright.config.ts     # Playwright configuration
└── .github/workflows/ci.yml # CI pipeline
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/[...nextauth]` | * | NextAuth.js handlers |
| `/api/auth/register` | POST | User registration |
| `/api/auth/refresh` | POST | Token refresh |
| `/api/trpc/[trpc]` | * | tRPC API endpoint |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run docker:build` | Build Docker image |
| `npm run docker:up` | Start Docker containers |
| `npm run docker:down` | Stop Docker containers |

## License

MIT
