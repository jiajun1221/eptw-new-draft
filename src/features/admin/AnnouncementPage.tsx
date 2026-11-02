import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { announcementDescriptionHtml, readLoginAnnouncement, removeLoginAnnouncement, saveLoginAnnouncement } from "../../domain/announcementStore";
import type { User } from "../../domain/types";

export default function AnnouncementPage({ user }: { user: User }) {
  const current = readLoginAnnouncement();
  const [title, setTitle] = useState(current?.title ?? "");
  const [description, setDescription] = useState(current?.description ?? "");
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(Boolean(current));
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = announcementDescriptionHtml(current?.description ?? "");
  }, []);

  if (!["SUPER_ADMIN", "USER_ADMIN"].includes(user.role)) return <Navigate to="/dashboard" replace />;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const editor = editorRef.current;
    if (!editor?.textContent?.trim()) { editor?.focus(); return; }
    const announcement = saveLoginAnnouncement({ title, description: editor.innerHTML });
    setDescription(announcement.description);
    editor.innerHTML = announcement.description;
    setPublished(true);
    setSaved(true);
  };
  const remove = () => {
    removeLoginAnnouncement();
    setTitle("");
    setDescription("");
    if (editorRef.current) editorRef.current.innerHTML = "";
    setPublished(false);
    setSaved(false);
  };
  const format = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setDescription(editorRef.current?.innerHTML ?? "");
    setSaved(false);
  };
  const addLink = () => {
    const href = window.prompt("Enter the link URL", "https://");
    if (href) format("createLink", href);
  };

  return <div className="page announcement-page">
    <header className="page-header"><div><span className="eyebrow">System management</span><h1>Announcement</h1><p>Edit the message users must acknowledge before they can access the login page.</p></div></header>
    <div className="announcement-layout">
      <form className="card announcement-editor" onSubmit={submit}>
        <div><span className={`announcement-status ${published ? "published" : ""}`}>{published ? "Published" : "Not published"}</span><h2>Pre-login message</h2><p>The saved announcement is shown to every user before sign-in.</p></div>
        <label><span>Title</span><input aria-label="Announcement title" required maxLength={120} value={title} onChange={(event) => { setTitle(event.target.value); setSaved(false); }} placeholder="Important announcement" /></label>
        <div className="announcement-description-field"><span>Description</span><div className="announcement-format-toolbar" role="toolbar" aria-label="Description formatting"><button type="button" aria-label="Bold" title="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => format("bold")}><b>B</b></button><button type="button" aria-label="Italic" title="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => format("italic")}><i>I</i></button><button type="button" aria-label="Underline" title="Underline" onMouseDown={(event) => event.preventDefault()} onClick={() => format("underline")}><u>U</u></button><span aria-hidden="true" /><button type="button" aria-label="Bulleted list" title="Bulleted list" onMouseDown={(event) => event.preventDefault()} onClick={() => format("insertUnorderedList")}>• List</button><button type="button" aria-label="Numbered list" title="Numbered list" onMouseDown={(event) => event.preventDefault()} onClick={() => format("insertOrderedList")}>1. List</button><button type="button" aria-label="Add link" title="Add link" onMouseDown={(event) => event.preventDefault()} onClick={addLink}>↗ Link</button><button type="button" aria-label="Clear formatting" title="Clear formatting" onMouseDown={(event) => event.preventDefault()} onClick={() => format("removeFormat")}>Clear</button></div><div ref={editorRef} className="announcement-rich-editor" role="textbox" aria-label="Announcement description" aria-multiline="true" aria-required="true" contentEditable suppressContentEditableWarning data-placeholder="Enter the message users need to read." onInput={(event) => { setDescription(event.currentTarget.innerHTML); setSaved(false); }} /></div>
        {saved && <p className="form-message success" role="status">Announcement saved and published.</p>}
        <div className="announcement-actions"><button className="button primary" type="submit">Save announcement</button>{published && <button className="button ghost" type="button" onClick={remove}>Remove announcement</button>}</div>
      </form>
      <section className="card announcement-preview" aria-label="Announcement preview">
        <span>Login popout preview</span>
        <div><small>System announcement</small><h2>{title.trim() || "Announcement title"}</h2><div className="announcement-rich-text" dangerouslySetInnerHTML={{ __html: description.trim() ? announcementDescriptionHtml(description) : "Your announcement description will appear here." }} /><label><input type="checkbox" disabled /> I have read and acknowledge this announcement</label><button className="button primary" type="button" disabled>Continue to login</button></div>
      </section>
    </div>
  </div>;
}
