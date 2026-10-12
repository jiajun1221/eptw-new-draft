# Frontend architecture and handoff guide

## System shape

The browser entry point in `src/main.tsx` mounts the router and imports the style layers. `src/app/App.tsx` owns the application shell and route composition. Feature folders contain page-level UI, while `src/domain` contains the framework-light permit rules and browser persistence layer.

```text
main.tsx
  -> app/App.tsx (routing and shared application context)
      -> features/* (page-level workflows)
      -> components/* (reusable presentation)
      -> domain/* (state, policy, and persistence)
```

## Folder ownership

### `src/app`

Owns navigation, shared application context, route declarations, and the core permit screens. `App.tsx` is the main future decomposition target: split route-level screens into `src/features/permits` as the product stabilizes.

### `src/components`

Contains UI elements shared across features. Components should receive data through props and avoid taking ownership of persistence.

### `src/domain`

- `types.ts`: shared domain contracts
- `constants.ts`: demo users, sites, labels, and fixed lists
- `data.ts`: seed-state factories and form defaults
- `policy.ts`: workflow decisions and permitted transitions
- `repository.ts`: localStorage-backed repository and lifecycle mutations
- `sectionAccess.ts`: section-level edit permissions
- `safetyChecklist.ts`: checklist definitions and validation
- `groupStore.ts`: demo MT-group browser storage
- `templateOptions.ts`: template field helpers

Keep workflow rules here rather than duplicating them in React event handlers. When a backend is introduced, the server must become authoritative for every authorization and transition decision.

### `src/features`

Feature folders own page-level presentation and local interaction state. Administrative registers, authentication demonstrations, analytics, and template editing are separated so teams can evolve them independently.

### `src/styles`

The CSS remains split by feature and is loaded centrally from `main.tsx`. New styles should follow the existing feature name rather than returning CSS files to the `src` root.

### `tests`

Unit tests cover policy, repository, access, and checklist behavior. `app.test.tsx` exercises the integrated application shell with React Testing Library.

## Runtime data flow

1. `App.tsx` reads state through the repository singleton.
2. UI actions request repository mutations.
3. The repository consults policy and validation helpers before changing state.
4. State is written to browser `localStorage` and the app refreshes its view.
5. Resetting demo data recreates the seed state from `data.ts`.

## Recommended backend seam

Preserve the repository method surface and replace `LocalPermitRepository` with an HTTP implementation. This limits UI churn while the backend takes responsibility for authentication, authorization, concurrency, persistence, audit integrity, notifications, and attachments.

## Prototype limitations

- Identity selection is a demo control, not authentication.
- Authorization runs in the browser and is not secure against tampering.
- Data is local to one browser profile and has no concurrency control.
- Upload fields and notifications are demonstrations only.
- Seeded directory data is not connected to corporate source systems.
- The production bundle has not been optimized for route-level code splitting.

## Change checklist

Before handing over a change, run:

```powershell
npm run check:handoff
npm run build
npm test
```

Add tests beside the relevant domain behavior whenever transition rules, access rules, or repository mutations change.
