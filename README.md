# ePTW functional frontend draft

A frontend-only React and TypeScript demonstration of a controlled electronic Permit-to-Work lifecycle. Data is seeded and persisted in the browser; no real authentication, file upload, notification, or backend security is implied.

## Run locally

Requires Node.js 22 or newer.

```powershell
npm install
npm run dev
```

Open the URL printed by Vite. Use the **Demo identity** selector in the sidebar to walk a permit through Requestor, Individual Reviewer, MT Group, PM, and Administrator views. Use **Reset demo data** on the overview page to restore the walkthrough.

## Verify

```powershell
npm run build
npm test
```

## Demonstrated controls

- Sequential Individual → MT Group → PM approval
- Separation of duties and role/ownership checks in a centralized policy layer
- Automatic mandatory Hot Work child permit creation and parent gating
- Activation, daily logs, suspension/resumption, expiry, closure, and cancellation
- New-revision reapproval with prior revisions retained and superseded
- Append-only lifecycle audit history and read-only admin oversight
