# ePTW functional frontend draft

A frontend-only React and TypeScript demonstration of a controlled electronic Permit-to-Work lifecycle. The application uses seeded browser data; it does not provide production authentication, backend authorization, file storage, notifications, or an API.

## Quick start

### Prerequisites

- Node.js 22 or newer
- npm 10 or newer

```powershell
npm ci
npm run dev
```

Open the URL printed by Vite. Expand **Use a demo account** on the sign-in page, then use **Account settings** to switch identities while walking a permit through the Requestor, Individual Reviewer, MT Group, PM, and Administrator views. Use **Reset demo data** on the Dashboard to restore the walkthrough.

## Project map

```text
.
|-- docs/                  Project handoff material and proposal deck
|-- scripts/               Repository and handoff verification utilities
|-- src/
|   |-- app/               Application shell, routes, and permit screens
|   |-- components/        Reusable UI components
|   |-- domain/            Types, policy, data, persistence, and business rules
|   |-- features/          Feature-specific pages
|   |   |-- admin/         Users, companies, disciplines, and MT groups
|   |   |-- analytics/     Analytics dashboard
|   |   |-- auth/          Login, registration, and tutorial flows
|   |   `-- templates/     Permit-template builder
|   |-- styles/            Global and feature-specific CSS
|   `-- main.tsx           Browser entry point and global style imports
|-- tests/                 Vitest unit and UI integration tests
|-- index.html             Vite HTML entry point
`-- vite.config.ts         Build and test configuration
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for ownership boundaries, data flow, extension points, and known prototype limitations.

For a colleague-friendly setup and walkthrough, see [docs/CLONE_AND_RUN_GUIDE.md](docs/CLONE_AND_RUN_GUIDE.md).

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create a production bundle in `dist/` |
| `npm test` | Run the complete Vitest suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run check:handoff` | Verify the expected repository structure |
| `npm run preview` | Preview the production bundle locally |

## Demonstrated controls

- Sequential Individual Reviewer -> MT Group -> PM approval
- Separation of duties and role/ownership checks in a centralized policy layer
- Automatic mandatory Hot Work child-permit creation and parent gating
- Activation, daily logs, suspension/resumption, expiry, closure, and cancellation
- New-revision reapproval with prior revisions retained and superseded
- Append-only lifecycle audit history and read-only administrator oversight

## Before backend integration

Replace browser storage with an API-backed repository, enforce policy server-side, connect identity and role claims to the organization identity provider, and add durable audit/file services. The current UI and client-side rules are a functional prototype, not a security boundary.
