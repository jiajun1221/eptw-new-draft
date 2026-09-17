import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { ROLE_LABELS, USERS } from "./constants";
import { groupSeeds, readGroups, saveGroups, type StoredMtGroup } from "./groupStore";
import type { User } from "./types";

const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" /></svg>;
}

function EditIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>;
}

function GroupIllustration() {
  return <svg className="add-group-illustration" aria-hidden="true" viewBox="0 0 180 116">
    <circle cx="75" cy="33" r="16" fill="#c8dcff" />
    <circle cx="48" cy="45" r="13" fill="#ffe0d0" />
    <circle cx="102" cy="46" r="13" fill="#d9f1e7" />
    <path d="M47 91c0-25 12-39 28-39s29 14 29 39" fill="#6f8ee8" />
    <path d="M24 91c1-20 10-31 24-31 9 0 16 5 20 13-5 6-8 13-9 22H24Z" fill="#ffad82" />
    <path d="M91 73c4-8 11-13 20-13 14 0 23 11 24 31H99c-1-7-4-13-8-18Z" fill="#68c7a2" />
    <circle cx="140" cy="29" r="18" fill="#eef3ff" />
    <path d="M140 20v18M131 29h18" stroke="#5578db" strokeWidth="4" strokeLinecap="round" />
  </svg>;
}

export default function MtGroupsManager({ user }: { user: User }) {
  const [groups, setGroups] = useState(readGroups);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<StoredMtGroup>();
  const [memberQuery, setMemberQuery] = useState("");
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [editingUser, setEditingUser] = useState<User>();
  const [adding, setAdding] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: "", site: "F10A1", canClose: false, editable: false });

  if (!["SUPER_ADMIN", "USER_ADMIN"].includes(user.role)) return <Navigate to="/dashboard" replace />;

  const assignableUsers = USERS;
  const groupsForUser = (person: User) => groups.filter((group) => group.memberIds?.includes(person.id) || (!group.memberIds?.length && person.group === group.name));
  const visibleUsers = USERS.filter((person) => {
    const memberships = groupsForUser(person).map((group) => group.name).join(" ");
    return `${person.name} ${person.email} ${ROLE_LABELS[person.role] ?? person.role} ${person.company ?? ""} ${memberships}`.toLowerCase().includes(query.trim().toLowerCase());
  });
  const update = (next: StoredMtGroup[]) => { setGroups(next); saveGroups(next); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    update([...groups, {
      id: crypto.randomUUID(), number: Math.max(0, ...groups.map((group) => group.number)) + 1,
      name: form.name.trim(), site: form.site.trim().toUpperCase(), canClose: form.canClose,
      editable: form.editable, memberIds: [],
    }]);
    setForm({ name: "", site: "F10A1", canClose: false, editable: false });
    setAdding(false);
  };
  const toggleMember = (group: StoredMtGroup, userId: string) => {
    const members = group.memberIds ?? [];
    const memberIds = members.includes(userId) ? members.filter((id) => id !== userId) : [...members, userId];
    const next = groups.map((item) => item.id === group.id ? { ...item, memberIds } : item);
    update(next); setEditing(next.find((item) => item.id === group.id));
  };
  const visibleStaff = assignableUsers.filter((person) => (!assignedOnly || editing?.memberIds?.includes(person.id)) && `${person.name} ${person.email}`.toLowerCase().includes(memberQuery.trim().toLowerCase()));
  const setVisibleMembership = (selected: boolean) => {
    if (!editing) return;
    const visibleIds = new Set(visibleStaff.map((person) => person.id));
    const current = editing.memberIds ?? [];
    const memberIds = selected ? Array.from(new Set([...current, ...visibleIds])) : current.filter((id) => !visibleIds.has(id));
    const next = groups.map((item) => item.id === editing.id ? { ...item, memberIds } : item);
    update(next); setEditing(next.find((item) => item.id === editing.id));
  };
  const openMembers = (group: StoredMtGroup, showAssigned = false) => { setMemberQuery(""); setAssignedOnly(showAssigned); setEditing(group); };
  const assignedMembers = (group: StoredMtGroup) => assignableUsers.filter((person) => group.memberIds?.includes(person.id));
  const setUserGroup = (person: User, group: StoredMtGroup, selected: boolean) => {
    const memberIds = group.memberIds ?? [];
    const nextMemberIds = selected ? Array.from(new Set([...memberIds, person.id])) : memberIds.filter((id) => id !== person.id);
    update(groups.map((item) => item.id === group.id ? { ...item, memberIds: nextMemberIds } : item));
  };
  const memberAvatars = (group: StoredMtGroup, limit = 5, interactiveOverflow = true) => {
    const assigned = assignedMembers(group); const preview = assigned.slice(0, limit); const remaining = assigned.length - preview.length;
    return <div className="member-avatars" aria-label={`${assigned.length} Micron Staff assigned to ${group.name}`}>
      {preview.map((person, index) => <span className={`member-avatar avatar-${index % 5}`} title={`${person.name} — ${person.email}`} aria-label={person.name} key={person.id}>{initials(person.name)}</span>)}
      {remaining > 0 && (interactiveOverflow
        ? <button type="button" className="member-avatar member-overflow" aria-label={`View all ${assigned.length} assigned members for ${group.name}`} onClick={() => openMembers(group, true)}>+{remaining}</button>
        : <span className="member-avatar member-overflow" aria-label={`${remaining} more members`}>+{remaining}</span>)}
      {!assigned.length && <span className="no-members">No members assigned</span>}
    </div>;
  };
  const reset = () => { update(groupSeeds); setEditing(undefined); };

  return <div className="page directory-page mt-groups-page">
    <header className="page-header mt-groups-header">
      <div><span className="eyebrow">System management</span><h1>MT Groups</h1><p>Manage group membership, site ownership, and closure authority.</p></div>
      <button className="button ghost reset-groups-button" onClick={reset}>Reset groups</button>
    </header>

    <section className="group-overview" aria-labelledby="groups-overview-title">
      <div className="group-section-heading"><div><h2 id="groups-overview-title">Groups overview</h2><p>Configure who belongs to each MT group and what they are authorised to do.</p></div><span>{groups.length} groups · {assignableUsers.length} users</span></div>
      <div className="group-card-grid">
        {groups.map((group) => { const total = assignedMembers(group).length; return <article className="group-summary-card" key={group.id}>
          <div className="group-card-top"><span>Total {total} {total === 1 ? "member" : "members"}</span>{memberAvatars(group, 5)}</div>
          <div className="group-card-body"><span className="group-site-badge">{group.site}</span><h3>{group.name}</h3><div className="group-capabilities"><span className={group.canClose ? "enabled" : ""}><i>{group.canClose ? "✓" : "—"}</i> Confirm closure</span><span className={group.editable ? "enabled" : ""}><i>{group.editable ? "✓" : "—"}</i> Edit permits</span></div></div>
          <button type="button" className="group-card-action" onClick={() => openMembers(group)}>Manage members <span aria-hidden="true">→</span></button>
        </article>; })}
        <button type="button" className="group-summary-card add-group-card" onClick={() => setAdding(true)} aria-label="Add MT Group"><GroupIllustration /><span><strong>Add new group</strong><small>Create a group and assign its permissions.</small></span></button>
      </div>
    </section>

    {adding && <form className="card directory-form group-form redesigned-group-form" onSubmit={submit}>
      <div className="form-intro"><strong>Create MT group</strong><span>Set the group details and permissions.</span></div>
      <label>Group name<input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. F10A1 Process Engineer" /></label>
      <label>Site code<input required value={form.site} onChange={(event) => setForm({ ...form, site: event.target.value })} /></label>
      <label className="directory-check"><input type="checkbox" checked={form.canClose} onChange={(event) => setForm({ ...form, canClose: event.target.checked })} /> Can confirm closure</label>
      <label className="directory-check"><input type="checkbox" checked={form.editable} onChange={(event) => setForm({ ...form, editable: event.target.checked })} /> Can edit permit information</label>
      <div><button type="button" className="button ghost" onClick={() => setAdding(false)}>Cancel</button><button className="button primary">Save MT Group</button></div>
    </form>}

    <section className="group-directory-section" aria-labelledby="group-directory-title">
      <div className="group-section-heading"><div><h2 id="group-directory-title">Users and MT group access</h2><p>View every user account and its assigned MT groups.</p></div></div>
      <div className="card directory-card">
        <div className="directory-toolbar user-directory-toolbar"><label className="search group-search"><SearchIcon /><input aria-label="Search users" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search user or MT group" /></label><span className="result-count">Showing {visibleUsers.length} of {USERS.length} users</span></div>
        <div className="directory-table-scroll"><table className="directory-table user-directory-table"><thead><tr>
          <th><input type="checkbox" aria-label="Select all visible users" checked={visibleUsers.length > 0 && visibleUsers.every((person) => selectedUserIds.has(person.id))} onChange={(event) => setSelectedUserIds(event.target.checked ? new Set([...selectedUserIds, ...visibleUsers.map((person) => person.id)]) : new Set([...selectedUserIds].filter((id) => !visibleUsers.some((person) => person.id === id))))} /></th>
          <th>User</th><th>MT groups</th><th>Status</th><th>Actions</th>
        </tr></thead><tbody>
          {visibleUsers.map((person, index) => { const personGroups = groupsForUser(person); return <tr key={person.id}>
            <td><input type="checkbox" aria-label={`Select ${person.name}`} checked={selectedUserIds.has(person.id)} onChange={(event) => { const next = new Set(selectedUserIds); event.target.checked ? next.add(person.id) : next.delete(person.id); setSelectedUserIds(next); }} /></td>
            <td><div className="user-identity-cell"><span className={`user-list-avatar avatar-${index % 5}`}>{initials(person.name)}</span><span><strong>{person.name}</strong><small>{person.email}</small></span></div></td>
            <td><div className="user-group-tags">{personGroups.length ? personGroups.map((group) => <button type="button" key={group.id} onClick={() => openMembers(group)}>{group.name}</button>) : <span>Not assigned</span>}</div></td>
            <td><span className="user-status"><i />Active</span></td>
            <td><button type="button" className="user-row-action" onClick={() => setEditingUser(person)} aria-label={`Edit ${person.name}`}><EditIcon /><span>Edit</span></button></td>
          </tr>; })}
          {!visibleUsers.length && <tr><td colSpan={5}><div className="membership-empty">No users match “{query}”.</div></td></tr>}
        </tbody></table></div>
      </div>
    </section>

    {editing && <div className="admin-modal-backdrop" onMouseDown={() => setEditing(undefined)}><section className="admin-modal membership-modal" role="dialog" aria-modal="true" aria-labelledby="membership-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setEditing(undefined)} aria-label="Close">×</button><span className="modal-eyebrow">Manage membership</span><h2 id="membership-title">{editing.name}</h2><p>Assign user accounts to this MT group. Group membership does not change their account role.</p><div className="membership-summary"><strong>{editing.memberIds?.length ?? 0} selected</strong><span>{assignableUsers.length} available users</span></div><label className="member-search search"><SearchIcon /><input autoFocus aria-label="Search users for group" value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="Search by name or email" /></label><div className="membership-view-switch" role="group" aria-label="Member list view"><button type="button" className={!assignedOnly ? "active" : ""} onClick={() => setAssignedOnly(false)}>All users</button><button type="button" className={assignedOnly ? "active" : ""} onClick={() => setAssignedOnly(true)}>Assigned only ({editing.memberIds?.length ?? 0})</button></div><div className="membership-bulk"><span>{visibleStaff.length} user{visibleStaff.length === 1 ? "" : "s"} shown</span><button type="button" onClick={() => setVisibleMembership(true)}>Select visible</button><button type="button" onClick={() => setVisibleMembership(false)}>Clear visible</button></div><div className="membership-list">{visibleStaff.length ? visibleStaff.map((person) => <label key={person.id}><input type="checkbox" checked={editing.memberIds?.includes(person.id) ?? false} onChange={() => toggleMember(editing, person.id)} /><span><strong>{person.name}</strong><small>{person.email} · {ROLE_LABELS[person.role] ?? person.role} · {person.authMethod ?? "PASSWORD"}</small></span></label>) : <div className="membership-empty">{assignedOnly ? "No assigned users match your search." : "No users match your search."}</div>}</div><button className="button primary" onClick={() => setEditing(undefined)}>Done</button></section></div>}

    {editingUser && <div className="admin-modal-backdrop" onMouseDown={() => setEditingUser(undefined)}><section className="admin-modal user-groups-modal" role="dialog" aria-modal="true" aria-labelledby="user-groups-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setEditingUser(undefined)} aria-label="Close">×</button><span className="modal-eyebrow">Edit MT group access</span><div className="user-groups-heading"><span className="user-list-avatar">{initials(editingUser.name)}</span><div><h2 id="user-groups-title">{editingUser.name}</h2><p>{editingUser.email} · {ROLE_LABELS[editingUser.role] ?? editingUser.role}</p></div></div><p>Select every MT group this user should belong to. Changes take effect immediately.</p><div className="user-group-options">{groups.map((group) => { const checked = group.memberIds?.includes(editingUser.id) ?? false; return <label key={group.id}><input type="checkbox" checked={checked} onChange={(event) => setUserGroup(editingUser, group, event.target.checked)} /><span><strong>{group.name}</strong><small>{group.site} · {group.canClose ? "Can confirm closure" : "Cannot confirm closure"} · {group.editable ? "Can edit permits" : "Read-only permits"}</small></span><i>{checked ? "Assigned" : "Not assigned"}</i></label>; })}</div><div className="user-groups-footer"><span>{groupsForUser(editingUser).length} of {groups.length} groups assigned</span><button className="button primary" onClick={() => setEditingUser(undefined)}>Done</button></div></section></div>}
  </div>;
}
