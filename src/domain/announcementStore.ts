export type LoginAnnouncement = {
  title: string;
  description: string;
  updatedAt: string;
};

export const LOGIN_ANNOUNCEMENT_KEY = "eptw-login-announcement:v1";

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function announcementDescriptionHtml(value: string): string {
  if (!/<[a-z][\s\S]*>/i.test(value)) return escapeHtml(value).replace(/\r?\n/g, "<br>");
  const documentValue = new DOMParser().parseFromString(value, "text/html");
  const cleanNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? "");
    if (!(node instanceof HTMLElement)) return "";
    const children = Array.from(node.childNodes).map(cleanNode).join("");
    const tag = node.tagName.toLowerCase();
    if (["strong", "b", "em", "i", "u", "p", "div", "ul", "ol", "li"].includes(tag)) return `<${tag}>${children}</${tag}>`;
    if (tag === "br") return "<br>";
    if (tag === "a") {
      const href = node.getAttribute("href")?.trim() ?? "";
      const safeHref = /^(https?:|mailto:)/i.test(href) ? href.replaceAll('"', "&quot;") : "";
      return safeHref ? `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${children}</a>` : children;
    }
    return children;
  };
  return Array.from(documentValue.body.childNodes).map(cleanNode).join("");
}

export function readLoginAnnouncement(): LoginAnnouncement | null {
  try {
    const value = JSON.parse(localStorage.getItem(LOGIN_ANNOUNCEMENT_KEY) ?? "null") as Partial<LoginAnnouncement> | null;
    if (!value?.title?.trim() || !value.description?.trim() || !value.updatedAt) return null;
    return { title: value.title.trim(), description: value.description.trim(), updatedAt: value.updatedAt };
  } catch {
    return null;
  }
}

export function saveLoginAnnouncement(input: Pick<LoginAnnouncement, "title" | "description">): LoginAnnouncement {
  const announcement = { title: input.title.trim(), description: announcementDescriptionHtml(input.description.trim()), updatedAt: new Date().toISOString() };
  localStorage.setItem(LOGIN_ANNOUNCEMENT_KEY, JSON.stringify(announcement));
  return announcement;
}

export function removeLoginAnnouncement() {
  localStorage.removeItem(LOGIN_ANNOUNCEMENT_KEY);
}
