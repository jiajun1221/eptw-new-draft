# Clone and run the ePTW mockup

This guide is for who wants to run and interact with the ePTW functional mockup on their own computer.

> This repository is a frontend-only prototype. It uses seeded data stored in the browser and does not connect to a production backend, identity provider, or shared database.

## 1. Get access and install the prerequisites

Make sure you have:

- Access to the GitHub repository: `https://github.com/jiajun1221/eptw-new-draft`
- [Git](https://git-scm.com/downloads)
- Node.js 22 or newer
- npm 10 or newer (included with Node.js)
- A current version of Chrome, Edge, or Firefox
- Optional: Visual Studio Code

Open PowerShell, Terminal, or the terminal in your code editor and verify the tools:

```text
git --version
node --version
npm --version
```

The Node.js version should begin with `v22` or a higher major version.

## 2. Clone the repository

Choose a folder where you keep source code, then run:

```text
git clone https://github.com/jiajun1221/eptw-new-draft.git
cd eptw-new-draft
```

If GitHub asks you to authenticate, sign in with an account that has access to the repository. If your team is testing a branch other than the default branch, switch to the branch name provided by the developer:

```text
git switch <branch-name>
```

## 3. Install the dependencies

From the repository folder, run:

```text
npm ci
```

`npm ci` installs the exact dependency versions recorded in `package-lock.json`. Run it again whenever that lock file changes.

On Windows, if PowerShell reports that `npm.ps1` cannot be loaded because script execution is disabled, use:

```powershell
npm.cmd ci
```

## 4. Start the mockup

Run:

```text
npm run dev
```

On Windows, either of these alternatives works:

```powershell
npm.cmd run dev
```

```powershell
.\start-dev.cmd
```

Vite will print a local address, normally:

```text
http://localhost:5173/
```

Open the printed address in your browser. Keep the terminal running while you use the mockup. To stop it, return to the terminal and press `Ctrl+C`.

## 5. Sign in with a demo identity

The sign-in screen does not require a real Micron account for the prototype walkthrough.

1. Expand **Use a demo account**.
2. Select a user representing the role you want to test.
3. Continue into the application.
4. Use **Account settings** when you want to switch to another demo identity.

Useful identities include:

| Demo identity | Role | Suggested use |
| --- | --- | --- |
| Aisha Rahman | Contractor Requestor | Create, edit, and submit a permit |
| Irene Lim | Micron Staff | Review permit information and assigned workflow items |
| Priya Menon | Contractor PM | Exercise the contractor PM approval stage |
| Micron Supervisor | Micron Supervisor | Review permits and reporting views |
| Micron Administrator | Micron Admin | Explore administrative and reporting functions |
| Vendor Administrator | Vendor Admin | Manage configuration, templates, users, and the Report issue link |
| Permit Assessor | Assessor | Review the assessor experience |

The repository also contains additional requestor and Micron Staff identities for testing ownership, assignment, and separation-of-duty scenarios.

## 6. Suggested walkthrough

### Explore the permit workflow

1. Sign in as **Aisha Rahman**.
2. Open **Parent permits** and create or inspect a permit.
3. Complete available sections and submit the permit.
4. Switch identity through **Account settings** as the permit moves through review and approval stages.
5. Return to the requestor or administrator view to inspect the updated status and audit history.

The mockup demonstrates individual review, MT Group review, contractor PM approval, activation, daily logs, suspension and resumption, expiry, closure, cancellation, and revision handling. The exact actions shown depend on the permit's current state and the selected identity.

### Explore templates

1. Sign in as **Vendor Administrator** or **Micron Administrator**.
2. Open **Templates**.
3. Select a parent or child template.
4. Use the view action to see an interactive mockup of how the form will appear.
5. Use the template builder to inspect configurable sections and elements.

### Explore analytics

1. Sign in with an administrative or supervisor identity.
2. Open **Analytics**.
3. Change the date range, date basis, year, or dashboard filters.
4. Inspect the bar charts for approval volume, type and status, contractor, discipline, level, and ePTW paper-saving initiatives.

### Explore Report issue configuration

1. Sign in as **Vendor Administrator**.
2. Open **Report issue** and configure the support URL.
3. Switch to another demo identity.
4. Select **Report issue** to confirm that the configured destination opens.

Use a safe test URL such as an internal test page. The configured value is stored only in that browser profile.

## 7. Understand the demo data

- Data is stored in the browser's `localStorage`; it is not shared with colleagues or other browsers.
- Refreshing the page normally keeps your changes.
- A private/incognito window gives you a separate test session.
- **Reset demo data** on the Dashboard restores the seeded permit walkthrough.
- To clear every locally saved mockup setting, open the browser developer tools, go to **Application** or **Storage**, clear local storage for the local Vite address, and reload the page. You will need to select a demo identity again.

Do not enter confidential, personal, or production information into the mockup.

## 8. Run the project checks

Before sharing a code change, run:

```text
npm test
npm run build
npm run check:handoff
```

To inspect the production build locally:

```text
npm run preview
```

Open the URL printed by Vite. The preview command should be run after `npm run build`.

## 9. Get the latest changes later

Stop the development server, then run:

```text
git status
git pull --ff-only
npm ci
npm run dev
```

If `git status` shows local changes, commit or save them before pulling. Do not discard them unless you are certain they are no longer needed.

## Troubleshooting

### The default port is already in use

Start Vite on a different port and open the address it prints:

```text
npm run dev -- --port 5174
```

### The page looks stale after an update

Perform a hard refresh. If the issue is caused by older saved demo state, use **Reset demo data** or clear local storage as described above.

### Installation fails or dependencies appear inconsistent

Confirm that you are using Node.js 22 or newer, then run `npm ci` again from the repository root. Include the complete terminal error when asking a developer for help.

### GitHub says the repository cannot be found

Confirm that you are signed into the correct GitHub account and that the repository owner has granted that account access. Private repositories can return a not-found message when access is missing.

## Where to look in the code

| Location | Purpose |
| --- | --- |
| `src/app/App.tsx` | Application shell, navigation, routes, and core permit screens |
| `src/features/` | Analytics, authentication, templates, and administrative pages |
| `src/domain/` | Demo data, workflow rules, permissions, and browser persistence |
| `src/styles/` | Global and feature-specific styling |
| `tests/` | Unit and integrated UI tests |
| `docs/ARCHITECTURE.md` | Architecture, data flow, extension points, and prototype limitations |

