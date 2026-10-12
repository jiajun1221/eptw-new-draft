import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const required = [
  "src/app/App.tsx",
  "src/components/SectionPermissionSummary.tsx",
  "src/domain/policy.ts",
  "src/domain/repository.ts",
  "src/features/admin/AdminDirectories.tsx",
  "src/features/analytics/AnalyticsPage.tsx",
  "src/features/auth/AuthPages.tsx",
  "src/features/templates/TemplateBuilderPage.tsx",
  "src/styles/styles.css",
  "docs/ARCHITECTURE.md",
];

const missing = required.filter((path) => !existsSync(path));
if (missing.length) throw new Error(`Missing required handoff paths:\n${missing.join("\n")}`);

const staleWorkDirectories = [".work", ".codex-finalizer", "output"].filter(existsSync);
if (staleWorkDirectories.length) throw new Error(`Remove stale generated work directories: ${staleWorkDirectories.join(", ")}`);

const looseSourceFiles = readdirSync("src", { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name !== "main.tsx")
  .map((entry) => join("src", entry.name));
if (looseSourceFiles.length) throw new Error(`Unexpected uncategorized source files:\n${looseSourceFiles.join("\n")}`);

console.log("handoff structure verification passed");
