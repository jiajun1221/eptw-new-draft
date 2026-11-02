export const TUTORIAL_CATEGORIES = ["Getting started", "Permit types", "Workflow"] as const;

export type TutorialCategory = typeof TUTORIAL_CATEGORIES[number];
export type TutorialResource = {
  id: string;
  order: number;
  /** Legacy display aliases retained for the tutorial card renderer. */
  number?: string;
  updated?: string;
  title: string;
  category: TutorialCategory;
  updateInfo: string;
  fileName?: string;
  videoDataUrl?: string;
};

const TUTORIALS_KEY = "eptw-tutorial-videos:v1";

export const DEFAULT_TUTORIAL_RESOURCES: TutorialResource[] = [
  { id: "intro", order: 1, title: "Introduction to ePTW", category: "Getting started", updateInfo: "Updated 10 April 2026" },
  { id: "login", order: 2, title: "ePTW system login", category: "Getting started", updateInfo: "Updated 10 April 2026" },
  { id: "user-guide", order: 3, title: "User guide", category: "Getting started", updateInfo: "Updated 10 April 2026" },
  { id: "parent-child", order: 4, title: "Parent and child permits", category: "Workflow", updateInfo: "Updated 10 April 2026" },
  { id: "hot-work", order: 5, title: "B1 Hot Work permit", category: "Permit types", updateInfo: "Updated 10 April 2026" },
  { id: "confined-space", order: 6, title: "B2 Confined Space", category: "Permit types", updateInfo: "Updated 10 April 2026" },
  { id: "lifting", order: 7, title: "B3 Lifting", category: "Permit types", updateInfo: "Updated 10 April 2026" },
  { id: "work-height", order: 8, title: "B4 Work at Height", category: "Permit types", updateInfo: "Updated 10 April 2026" },
  { id: "lss", order: 9, title: "B5 LSS", category: "Permit types", updateInfo: "Updated 10 April 2026" },
  { id: "live-electrical", order: 10, title: "B6 Live Electrical", category: "Permit types", updateInfo: "Updated 10 April 2026" },
  { id: "sipp", order: 11, title: "B7 SIPP", category: "Permit types", updateInfo: "Updated 10 April 2026" },
  { id: "dirty-permit", order: 12, title: "B8 Dirty Permit", category: "Permit types", updateInfo: "Updated 10 April 2026" },
  { id: "approval", order: 13, title: "Approval and rejection flow", category: "Workflow", updateInfo: "Updated 10 April 2026" },
  { id: "closure", order: 14, title: "Requester initiates pending closure", category: "Workflow", updateInfo: "Updated 10 April 2026" },
];

const validTutorial = (item: Partial<TutorialResource>): item is TutorialResource =>
  Boolean(item.id && item.title && TUTORIAL_CATEGORIES.includes(item.category as TutorialCategory) && Number(item.order) > 0);

const withDisplayFields = (item: TutorialResource): TutorialResource => ({
  ...item,
  number: String(item.order).padStart(2, "0"),
  updated: item.updateInfo.replace(/^Updated\s+/i, ""),
});

export function readTutorialResources(): TutorialResource[] {
  try {
    const stored = JSON.parse(localStorage.getItem(TUTORIALS_KEY) ?? "null") as Partial<TutorialResource>[] | null;
    if (!stored?.length) return DEFAULT_TUTORIAL_RESOURCES.map(withDisplayFields);
    return stored.filter(validTutorial).map((item) => withDisplayFields({ ...item, updateInfo: item.updateInfo?.trim() || "Update information not provided" })).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  } catch {
    return DEFAULT_TUTORIAL_RESOURCES.map(withDisplayFields);
  }
}

export function saveTutorialResources(resources: TutorialResource[]) {
  localStorage.setItem(TUTORIALS_KEY, JSON.stringify(resources));
}
