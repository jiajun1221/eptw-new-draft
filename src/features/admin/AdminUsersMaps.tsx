import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import type { User } from "../../domain/types";
import { ROLE_LABELS, SITES, USERS } from "../../domain/constants";
import { readGroups } from "../../domain/groupStore";
import { micronCompanyName, readCompanies, type Company } from "./CompanyListPage";
import AdminActionButtons from "./AdminActionButtons";

type AccountStatus = "Active" | "Pending" | "Inactive";
type HostAssignment = { id: string; name: string; date: string };
type DirectoryUser = { id: string; name: string; email: string; company: string; sites: string[]; hosts: HostAssignment[]; role: string; groups: string[]; status: AccountStatus; lastLoginAt?: string };
type DirectoryUserInput = Partial<DirectoryUser> & Pick<DirectoryUser, "id" | "name" | "email" | "role"> & { host?: string };

const USER_KEY = "eptw-user-directory:v1";
const USER_DELETED_KEY = "eptw-user-directory-deleted:v1";
const accountRoles = ["Micron Admin", "Micron Supervisor", "Vendor Admin", "Micron Staff", "Contractor Requestor", "Contractor PM", "Assessor"];
const hostOptions = USERS.filter((account) => account.role === "MICRON_STAFF").map((account) => account.name);
const isMicronRole = (role: string) => ["Micron Admin", "Micron Supervisor", "Micron Staff"].includes(role);
const today = () => new Date().toISOString().slice(0, 10);
const sixMonthsAgo = () => { const date = new Date(); date.setMonth(date.getMonth() - 6); return date; };
const formatHostDate = (value: string) => value ? new Intl.DateTimeFormat("en-SG", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)) : "Not recorded";

const companyFromList = (name: string | undefined, role: string, companies: Company[]) => {
  const exact = name && companies.find((company) => company.name.toLowerCase() === name.toLowerCase());
  if (exact) return exact.name;
  if (isMicronRole(role) || name?.toLowerCase() === "micron") return micronCompanyName(companies);
  if (role === "Vendor Admin") return companies.find((company) => company.name === "Vendor Services")?.name ?? "Not assigned";
  return "Not assigned";
};

function normalizedStatus(record: { status?: string; lastLoginAt?: string }): AccountStatus {
  const status: AccountStatus = record.status === "Approved" ? "Active" : record.status === "Pending" || record.status === "Inactive" ? record.status : "Active";
  if (status !== "Pending" && record.lastLoginAt && new Date(record.lastLoginAt) < sixMonthsAgo()) return "Inactive";
  return status;
}

function load<T>(key: string, fallback: T[]): T[] {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T[] : fallback; } catch { return fallback; }
}

function normalizeUser(item: DirectoryUserInput, companies: Company[]): DirectoryUser {
  const legacyHosts = item.host && item.host !== "Not assigned" ? [{ id: `legacy-host-${item.id}`, name: item.host, date: "" }] : [];
  const { host: _legacyHost, ...record } = item;
  return { ...record, company: companyFromList(item.company, item.role, companies), sites: item.sites?.length ? item.sites : [...SITES], hosts: item.hosts ?? legacyHosts, groups: item.groups ?? [], status: normalizedStatus(item) } as DirectoryUser;
}

const availableUsers = (): DirectoryUser[] => {
  const groups = readGroups();
  const companies = readCompanies();
  return USERS.map((account) => normalizeUser({
    id: account.id, name: account.name, email: account.email, company: account.company, role: ROLE_LABELS[account.role], status: "Active", lastLoginAt: new Date().toISOString(), hosts: [],
    sites: account.sites?.length ? account.sites : SITES,
    groups: Array.from(new Set([...groups.filter((group) => group.memberIds?.includes(account.id)).map((group) => group.name), ...(account.group ? [account.group] : [])])),
  }, companies));
};

const loadAvailableUsers = () => {
  const companies = readCompanies();
  const accounts = availableUsers();
  const saved = load<DirectoryUserInput>(USER_KEY, []);
  const savedById = new Map(saved.map((item) => [item.id, item]));
  const deletedIds = new Set(load<string>(USER_DELETED_KEY, []));
  const custom = saved.filter((item) => !item.id.startsWith("directory-user-") && !USERS.some((account) => account.id === item.id));
  const builtIn = accounts.filter((account) => !deletedIds.has(account.id)).map((account) => {
    const savedAccount = savedById.get(account.id);
    return normalizeUser({ ...account, ...savedAccount, company: savedAccount?.company || account.company }, companies);
  });
  return [...builtIn, ...custom.filter((account) => !deletedIds.has(account.id)).map((account) => normalizeUser(account, companies))];
};

const blankForm = { name: "", email: "", company: "Acme Engineering", role: "Contractor Requestor", site: "F10A1", host: "Not assigned", status: "Pending" as AccountStatus };

function HostTable({ hosts, editable = false, onEdit, onDelete }: { hosts: HostAssignment[]; editable?: boolean; onEdit?: (host: HostAssignment) => void; onDelete?: (host: HostAssignment) => void }) {
  return <div className="user-host-table-wrap"><table className="user-host-table"><thead><tr><th>Host name (Micron staff)</th><th>Date</th>{editable && <th>Action</th>}</tr></thead><tbody>{hosts.length ? hosts.map((host) => <tr key={host.id}><td>{host.name}</td><td>{formatHostDate(host.date)}</td>{editable && <td><AdminActionButtons label={host.name} onEdit={() => onEdit?.(host)} onDelete={() => onDelete?.(host)} /></td>}</tr>) : <tr><td colSpan={editable ? 3 : 2} className="user-host-empty">No host assigned</td></tr>}</tbody></table></div>;
}

export function UsersPage({ user }: { user: User }) {
  const companies = readCompanies().filter((company) => company.status === "Active").map((company) => company.name);
  const [items, setItems] = useState(loadAvailableUsers);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<DirectoryUser>();
  const [editing, setEditing] = useState<DirectoryUser>();
  const [form, setForm] = useState(() => ({ ...blankForm, company: companies[0] ?? "" }));
  const [createHosts, setCreateHosts] = useState<HostAssignment[]>([]);
  const [createHostEditorOpen, setCreateHostEditorOpen] = useState(false);
  const [createEditingHostId, setCreateEditingHostId] = useState<string>();
  const [createHostDraft, setCreateHostDraft] = useState({ name: hostOptions[0] ?? "", date: today() });
  const [editForm, setEditForm] = useState(blankForm);
  const [editHosts, setEditHosts] = useState<HostAssignment[]>([]);
  const [hostEditorOpen, setHostEditorOpen] = useState(false);
  const [editingHostId, setEditingHostId] = useState<string>();
  const [hostDraft, setHostDraft] = useState({ name: hostOptions[0] ?? "", date: today() });

  if (!["SUPER_ADMIN", "USER_ADMIN"].includes(user.role)) return <Navigate to="/dashboard" replace />;

  const visible = items.filter((item) => `${item.name} ${item.email} ${item.company} ${item.role} ${item.hosts.map((host) => host.name).join(" ")} ${item.sites.join(" ")} ${item.groups.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const save = (next: DirectoryUser[]) => { setItems(next); localStorage.setItem(USER_KEY, JSON.stringify(next)); };
  const closeCreateHostEditor = () => { setCreateHostEditorOpen(false); setCreateEditingHostId(undefined); setCreateHostDraft({ name: hostOptions[0] ?? "", date: today() }); };
  const submitCreateHost = () => {
    if (!createHostDraft.name || !createHostDraft.date) return;
    if (createEditingHostId) setCreateHosts(createHosts.map((host) => host.id === createEditingHostId ? { ...host, ...createHostDraft } : host));
    else if (!createHosts.some((host) => host.name === createHostDraft.name)) setCreateHosts([...createHosts, { id: crypto.randomUUID(), ...createHostDraft }]);
    closeCreateHostEditor();
  };
  const openCreateHostEdit = (host: HostAssignment) => { setCreateEditingHostId(host.id); setCreateHostDraft({ name: host.name, date: host.date || today() }); setCreateHostEditorOpen(true); };
  const closeHostEditor = () => { setHostEditorOpen(false); setEditingHostId(undefined); setHostDraft({ name: hostOptions[0] ?? "", date: today() }); };
  const submitHost = () => {
    if (!hostDraft.name || !hostDraft.date) return;
    if (editingHostId) setEditHosts(editHosts.map((host) => host.id === editingHostId ? { ...host, ...hostDraft } : host));
    else if (!editHosts.some((host) => host.name === hostDraft.name)) setEditHosts([...editHosts, { id: crypto.randomUUID(), ...hostDraft }]);
    closeHostEditor();
  };
  const openHostEdit = (host: HostAssignment) => { setEditingHostId(host.id); setHostDraft({ name: host.name, date: host.date || today() }); setHostEditorOpen(true); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.company) return;
    save([...items, { id: crypto.randomUUID(), name: form.name.trim(), email: form.email.trim().toLowerCase(), company: form.company, sites: [form.site], hosts: createHosts, role: form.role, groups: [], status: form.status, lastLoginAt: form.status === "Active" ? new Date().toISOString() : undefined }]);
    setForm({ ...blankForm, company: companies[0] ?? "" }); setCreateHosts([]); closeCreateHostEditor(); setAdding(false);
  };
  const openEdit = (item: DirectoryUser) => {
    setEditing(item);
    setEditForm({ name: item.name, email: item.email, company: item.company, role: item.role, site: item.sites[0] ?? "F10A1", host: "Not assigned", status: item.status });
    setEditHosts(item.hosts); closeHostEditor();
  };
  const submitEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!editing || !editForm.name.trim() || !editForm.email.trim()) return;
    save(items.map((item) => item.id === editing.id ? { ...item, name: editForm.name.trim(), email: editForm.email.trim().toLowerCase(), company: editForm.company, role: editForm.role, sites: [editForm.site], hosts: editHosts, status: editForm.status, lastLoginAt: editForm.status === "Active" && item.status !== "Active" ? new Date().toISOString() : item.lastLoginAt } : item));
    setEditing(undefined);
  };
  const deleteUser = (item: DirectoryUser) => {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    const deleted = new Set(load<string>(USER_DELETED_KEY, [])); deleted.add(item.id); localStorage.setItem(USER_DELETED_KEY, JSON.stringify([...deleted]));
    save(items.filter((candidate) => candidate.id !== item.id)); if (selected?.id === item.id) setSelected(undefined); if (editing?.id === item.id) setEditing(undefined);
  };
  const exportUsers = () => {
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [["Name", "Email Address", "Company Name", "Sites", "Hosts", "Role", "MT Groups", "Status"], ...visible.map((item) => [item.name, item.email, item.company, item.sites.join("; "), item.hosts.map((host) => `${host.name} (${host.date || "date not recorded"})`).join("; "), item.role, item.groups.join("; "), item.status])];
    const csv = `\uFEFF${rows.map((row) => row.map(quote).join(",")).join("\r\n")}`;
    const link = document.createElement("a"); link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`; link.download = `eptw-user-list-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(link); link.click(); link.remove();
  };

  return <div className="page users-page">
    <header className="page-header"><div><span className="eyebrow">System management</span><h1>Users</h1><p>Manage user access, roles, assigned sites, and account status.</p></div><div className="header-actions"><button className="button ghost" onClick={exportUsers}>⇩ Export User List</button><button className="button primary" onClick={() => { setForm({ ...blankForm, company: companies[0] ?? "" }); setCreateHosts([]); closeCreateHostEditor(); setAdding(true); }}>+ Create user</button></div></header>
    <section className="card admin-register"><div className="admin-toolbar"><label className="search"><span>⌕</span><input aria-label="Search users" placeholder="Search name, company, email, site, host, role or MT group" value={query} onChange={(event) => setQuery(event.target.value)} /></label><span className="result-count">{visible.length} users</span></div><div className="user-status-definitions"><span><b>Active</b> Approved and in use</span><span><b>Pending</b> Contractor has not passed the quiz</span><span><b>Inactive</b> No login for 6 months</span></div>
      {adding && <form className="admin-create-form user-create-form" onSubmit={submit}><label>Name<input aria-label="Name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Email address<input aria-label="Email address" required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Company<select aria-label="Company" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })}>{companies.map((company) => <option key={company}>{company}</option>)}</select></label><label>Role<select aria-label="Role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{accountRoles.map((role) => <option key={role}>{role}</option>)}</select></label><label>Site<select aria-label="Site" value={form.site} onChange={(event) => setForm({ ...form, site: event.target.value })}>{SITES.map((site) => <option key={site}>{site}</option>)}</select></label><label>Status<select aria-label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AccountStatus })}><option>Active</option><option>Pending</option><option>Inactive</option></select></label><section className="user-host-section user-host-editor"><div className="user-host-heading"><div><h3>Hosts</h3><p>Add one or more Micron staff hosts and their assignment dates.</p></div><button type="button" className="button ghost" onClick={() => { setCreateEditingHostId(undefined); setCreateHostDraft({ name: hostOptions.find((name) => !createHosts.some((host) => host.name === name)) ?? hostOptions[0] ?? "", date: today() }); setCreateHostEditorOpen(true); }}>+ Add host</button></div>{createHostEditorOpen && <div className="user-host-fields"><label>Host name<select aria-label="New user host name" value={createHostDraft.name} onChange={(event) => setCreateHostDraft({ ...createHostDraft, name: event.target.value })}>{hostOptions.map((host) => <option key={host}>{host}</option>)}</select></label><label>Date<input aria-label="New user host date" type="date" value={createHostDraft.date} onChange={(event) => setCreateHostDraft({ ...createHostDraft, date: event.target.value })} /></label><div><button type="button" className="button ghost" onClick={closeCreateHostEditor}>Cancel</button><button type="button" className="button primary" onClick={submitCreateHost}>{createEditingHostId ? "Update host" : "Add host"}</button></div></div>}<HostTable hosts={createHosts} editable onEdit={openCreateHostEdit} onDelete={(host) => { setCreateHosts(createHosts.filter((item) => item.id !== host.id)); if (createEditingHostId === host.id) closeCreateHostEditor(); }} /></section><div><button type="button" className="button ghost" onClick={() => { setAdding(false); setCreateHosts([]); closeCreateHostEditor(); }}>Cancel</button><button className="button primary">Save user</button></div></form>}
      <div className="users-table-wrap"><table className="admin-table users-table"><thead><tr><th>#</th><th>User&apos;s name</th><th>Company Name</th><th>Email address</th><th>Sites</th><th>MT Groups</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td><strong>{item.name}</strong></td><td>{item.company}</td><td>{item.email}</td><td><div className="site-tags">{item.sites.map((site) => <span className="site-code" key={site}>{site}</span>)}</div></td><td>{item.groups.length ? <div className="mt-group-tags">{item.groups.map((group) => <span className="mt-group-badge" key={group}>{group}</span>)}</div> : <span className="mt-group-unassigned">Not assigned</span>}</td><td>{item.role}</td><td><span className={`account-status ${item.status.toLowerCase()}`}>{item.status}</span></td><td><AdminActionButtons label={item.name} onView={() => setSelected(item)} onEdit={() => openEdit(item)} onDelete={() => deleteUser(item)} /></td></tr>)}</tbody></table></div>
    </section>

    {selected && <div className="admin-modal-backdrop" onMouseDown={() => setSelected(undefined)}><section className="admin-modal user-view-modal" role="dialog" aria-modal="true" aria-label={`View ${selected.name}`} onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelected(undefined)} aria-label="Close">×</button><h2>{selected.name}</h2><p>{selected.email}</p><dl><div><dt>Company</dt><dd>{selected.company}</dd></div><div><dt>Role</dt><dd>{selected.role}</dd></div><div><dt>Sites</dt><dd>{selected.sites.join(", ")}</dd></div><div><dt>MT Groups</dt><dd>{selected.groups.join(", ") || "Not assigned"}</dd></div><div><dt>Status</dt><dd>{selected.status}</dd></div></dl><section className="user-host-section"><div className="user-host-heading"><div><h3>Hosts</h3><p>Assigned Micron staff hosts.</p></div></div><HostTable hosts={selected.hosts} /></section></section></div>}

    {editing && <div className="admin-modal-backdrop" onMouseDown={() => setEditing(undefined)}><form className="admin-modal admin-create-form user-edit-form" role="dialog" aria-modal="true" aria-label={`Edit ${editing.name}`} onMouseDown={(event) => event.stopPropagation()} onSubmit={submitEdit}><button type="button" className="modal-close" onClick={() => setEditing(undefined)} aria-label="Close">×</button><h2>Edit user</h2><label>Name<input aria-label="Edit user name" required value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /></label><label>Email address<input aria-label="Edit user email" required type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} /></label><label>Company<select aria-label="Edit user company" value={editForm.company} onChange={(event) => setEditForm({ ...editForm, company: event.target.value })}>{companies.map((company) => <option key={company}>{company}</option>)}</select></label><label>Site<select aria-label="Edit user site" value={editForm.site} onChange={(event) => setEditForm({ ...editForm, site: event.target.value })}>{SITES.map((site) => <option key={site}>{site}</option>)}</select></label><label>Role<select aria-label="Edit user role" value={editForm.role} onChange={(event) => setEditForm({ ...editForm, role: event.target.value })}>{accountRoles.map((role) => <option key={role}>{role}</option>)}</select></label><label>Status<select aria-label="Edit user status" value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value as AccountStatus })}><option>Active</option><option>Pending</option><option>Inactive</option></select></label>
      <section className="user-host-section user-host-editor"><div className="user-host-heading"><div><h3>Hosts</h3><p>Assign Micron staff as dated hosts for this user.</p></div><button type="button" className="button ghost" onClick={() => { setEditingHostId(undefined); setHostDraft({ name: hostOptions.find((name) => !editHosts.some((host) => host.name === name)) ?? hostOptions[0] ?? "", date: today() }); setHostEditorOpen(true); }}>+ Add host</button></div>{hostEditorOpen && <div className="user-host-fields"><label>Host name<select aria-label="Host name" value={hostDraft.name} onChange={(event) => setHostDraft({ ...hostDraft, name: event.target.value })}>{hostOptions.map((host) => <option key={host}>{host}</option>)}</select></label><label>Date<input aria-label="Host date" type="date" value={hostDraft.date} onChange={(event) => setHostDraft({ ...hostDraft, date: event.target.value })} /></label><div><button type="button" className="button ghost" onClick={closeHostEditor}>Cancel</button><button type="button" className="button primary" onClick={submitHost}>{editingHostId ? "Update host" : "Add host"}</button></div></div>}<HostTable hosts={editHosts} editable onEdit={openHostEdit} onDelete={(host) => { setEditHosts(editHosts.filter((item) => item.id !== host.id)); if (editingHostId === host.id) closeHostEditor(); }} /></section>
      <div className="user-readonly-field"><span>MT Groups</span><div>{editing.groups.length ? editing.groups.map((group) => <span className="mt-group-badge" key={group}>{group}</span>) : <em>Not assigned</em>}</div><small>View only. Manage membership from MT Groups.</small></div><div className="user-edit-actions"><button type="button" className="button ghost" onClick={() => setEditing(undefined)}>Cancel</button><button className="button primary">Save changes</button></div></form></div>}
  </div>;
}
