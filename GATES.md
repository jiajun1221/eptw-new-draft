# Gates: frontend handoff cleanup

OWNS: src/**, tests/**, scripts/**, docs/**, README.md, .gitignore, package.json, GATES.md, .work/**, .codex-finalizer/**, output/**

Scope: organize the frontend repository for a clean engineering-team handoff while preserving its behavior

- [x] G1: source files are grouped by clear responsibility and stale generated work directories are absent
  CHECK: node scripts/check-handoff.mjs
  EXPECT: handoff structure verification passed
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\jchng\eptw-new-draft; path=86763347a2b8/17 entries; output=handoff structure verification passed

- [x] G2: the reorganized TypeScript application compiles and produces a production bundle
  CHECK: npm.cmd run build
  EXPECT: built in
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\jchng\eptw-new-draft; path=86763347a2b8/17 entries; output=dist/assets/index-Cwmqt3Vm.js   471.64 kB │ gzip: 138.60 kB | ✓ built in 1.77s

- [x] G3: the full automated test suite passes after file moves and import rewrites
  CHECK: npm.cmd test
  EXPECT: Test Files  5 passed
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\jchng\eptw-new-draft; path=86763347a2b8/17 entries; output=Start at  15:33:19 | Duration  16.36s (transform 1.66s, setup 1.09s, collect 2.96s, tests 12.46s, environment 6.97s, prepare 1.33s)

- [x] G4: handoff documentation explains the architecture, folder map, commands, demo limitations, and extension points
  EVIDENCE: README.md documents setup, folder map, commands, controls, and backend prerequisites; docs/ARCHITECTURE.md documents ownership, data flow, integration seam, limitations, and change checks.
