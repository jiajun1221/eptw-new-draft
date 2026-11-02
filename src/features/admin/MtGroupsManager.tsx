import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { ROLE_LABELS, USERS } from "../../domain/constants";
import { groupSeeds, readGroups, saveGroups, type StoredMtGroup } from "../../domain/groupStore";
import type { User } from "../../domain/types";
import AdminActionButtons from "./AdminActionButtons";
import { userAvatarColorClass, userInitials } from "../../domain/userAvatar";

const USER_DELETED_KEY = "eptw-user-directory-deleted:v1";
const readDeletedUserIds = () => { try { return JSON.parse(localStorage.getItem(USER_DELETED_KEY) ?? "[]") as string[]; } catch { return []; } };

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" /></svg>;
}

function ManageMembersIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.5-4 2.4-6 5.5-6s5 2 5.5 6" /><path d="M18 7v6M15 10h6" /></svg>;
}

export default function MtGroupsManager({ user }: { user: User }) {
  const [groups, setGroups] = useState(readGroups);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<StoredMtGroup>();
  const [memberQuery, setMemberQuery] = useState("");
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [editingUser, setEditingUser] = useState<User>();
  const [editingGroup, setEditingGroup] = useState<StoredMtGroup>();
  const [adding, setAdding] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [deletedUserIds, setDeletedUserIds] = useState(readDeletedUserIds);
  const [form, setForm] = useState({ name: "", site: "F10A1", canClose: false, editable: false });
  const [editForm, setEditForm] = useState({ name: "", site: "F10A1", canClose: false, editable: false });

  if (!["SUPER_ADMIN", "USER_ADMIN"].includes(user.role)) return <Navigate to="/dashboard" replace />;

  const assignableUsers = USERS.filter((person) => !deletedUserIds.includes(person.id));
  const groupsForUser = (person: User) => groups.filter((group) => group.memberIds?.includes(person.id) || (!group.memberIds?.length && person.group === group.name));
  const visibleUsers = assignableUsers.filter((person) => {
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
  const openGroupEdit = (group: StoredMtGroup) => { setEditingGroup(group); setEditForm({ name: group.name, site: group.site, canClose: group.canClose, editable: group.editable }); };
  const submitGroupEdit = (event: FormEvent) => { event.preventDefault(); if (!editingGroup || !editForm.name.trim() || !editForm.site.trim()) return; update(groups.map((group) => group.id === editingGroup.id ? { ...group, name: editForm.name.trim(), site: editForm.site.trim().toUpperCase(), canClose: editForm.canClose, editable: editForm.editable } : group)); setEditingGroup(undefined); };
  const deleteGroup = (group: StoredMtGroup) => { if (!window.confirm(`Delete ${group.name}?`)) return; update(groups.filter((item) => item.id !== group.id)); if (editing?.id === group.id) setEditing(undefined); if (editingGroup?.id === group.id) setEditingGroup(undefined); };
  const deleteUser = (person: User) => {
    if (!window.confirm(`Delete ${person.name}?`)) return;
    const nextDeletedIds = Array.from(new Set([...deletedUserIds, person.id]));
    localStorage.setItem(USER_DELETED_KEY, JSON.stringify(nextDeletedIds));
    setDeletedUserIds(nextDeletedIds);
    update(groups.map((group) => ({ ...group, memberIds: (group.memberIds ?? []).filter((id) => id !== person.id) })));
    setSelectedUserIds(new Set([...selectedUserIds].filter((id) => id !== person.id)));
    if (editingUser?.id === person.id) setEditingUser(undefined);
  };
  const assignedMembers = (group: StoredMtGroup) => assignableUsers.filter((person) => group.memberIds?.includes(person.id));
  const setUserGroup = (person: User, group: StoredMtGroup, selected: boolean) => {
    const memberIds = group.memberIds ?? [];
    const nextMemberIds = selected ? Array.from(new Set([...memberIds, person.id])) : memberIds.filter((id) => id !== person.id);
    update(groups.map((item) => item.id === group.id ? { ...item, memberIds: nextMemberIds } : item));
  };
  const memberAvatars = (group: StoredMtGroup, limit = 5, interactiveOverflow = true) => {
    const assigned = assignedMembers(group); const preview = assigned.slice(0, limit); const remaining = assigned.length - preview.length;
    return <div className="member-avatars" aria-label={`${assigned.length} Micron Staff assigned to ${group.name}`}>
      {preview.map((person) => <span className={`member-avatar ${userAvatarColorClass(person.role)}`} title={`${person.name} — ${person.email}`} aria-label={person.name} key={person.id}>{userInitials(person.name)}</span>)}
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
      <div className="group-section-heading"><div><h2 id="groups-overview-title">Groups overview</h2><p>Configure who belongs to each MT group and what they are authorised to do.</p></div><div className="group-heading-actions"><span>{groups.length} groups · {assignableUsers.length} users</span><button type="button" className="button primary" onClick={() => setAdding(true)}>＋ Add MT Group</button></div></div>
      <div className="card directory-card mt-group-table-card"><div className="directory-table-scroll"><table className="directory-table mt-group-table"><thead><tr><th>#</th><th>Group name</th><th>Site</th><th>Members</th><th>Confirm closure</th><th>Edit permits</th><th>Action</th></tr></thead><tbody>
        {groups.map((group) => { const total = assignedMembers(group).length; return <tr key={group.id}>
          <td>{group.number}</td>
          <td><strong>{group.name}</strong></td>
          <td><span className="table-site">{group.site}</span></td>
          <td><div className="mt-group-members-cell"><b>{total}</b>{memberAvatars(group, 5)}</div></td>
          <td><span className={`group-permission ${group.canClose ? "enabled" : ""}`}><i>{group.canClose ? "✓" : "—"}</i>{group.canClose ? "Yes" : "No"}</span></td>
          <td><span className={`group-permission ${group.editable ? "enabled" : ""}`}><i>{group.editable ? "✓" : "—"}</i>{group.editable ? "Yes" : "No"}</span></td>
          <td><div className="mt-group-row-actions"><button type="button" className="mt-group-manage-action" aria-label={`Manage members for ${group.name}`} title={`Manage members for ${group.name}`} onClick={() => openMembers(group)}><ManageMembersIcon /></button><AdminActionButtons label={group.name} onEdit={() => openGroupEdit(group)} onDelete={() => deleteGroup(group)} /></div></td>
        </tr>; })}
        {!groups.length && <tr><td colSpan={7}><div className="membership-empty">No MT groups configured.</div></td></tr>}
      </tbody></table></div></div>
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
        <div className="directory-toolbar user-directory-toolbar"><label className="search group-search"><SearchIcon /><input aria-label="Search users" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search user or MT group" /></label><span className="result-count">Showing {visibleUsers.length} of {assignableUsers.length} users</span></div>
        <div className="directory-table-scroll"><table className="directory-table user-directory-table"><thead><tr>
          <th><input type="checkbox" aria-label="Select all visible users" checked={visibleUsers.length > 0 && visibleUsers.every((person) => selectedUserIds.has(person.id))} onChange={(event) => setSelectedUserIds(event.target.checked ? new Set([...selectedUserIds, ...visibleUsers.map((person) => person.id)]) : new Set([...selectedUserIds].filter((id) => !visibleUsers.some((person) => person.id === id))))} /></th>
          <th>User</th><th>MT groups</th><th>Actions</th>
        </tr></thead><tbody>
          {visibleUsers.map((person) => { const personGroups = groupsForUser(person); return <tr key={person.id}>
            <td><input type="checkbox" aria-label={`Select ${person.name}`} checked={selectedUserIds.has(person.id)} onChange={(event) => { const next = new Set(selectedUserIds); event.target.checked ? next.add(person.id) : next.delete(person.id); setSelectedUserIds(next); }} /></td>
            <td><div className="user-identity-cell"><span className={`user-list-avatar ${userAvatarColorClass(person.role)}`} aria-label={`${person.name} initials`}>{userInitials(person.name)}</span><span><strong>{person.name}</strong><small>{person.email}</small></span></div></td>
            <td><div className="user-group-tags">{personGroups.length ? personGroups.map((group) => <button type="button" key={group.id} onClick={() => openMembers(group)}>{group.name}</button>) : <span>Not assigned</span>}</div></td>
            <td><AdminActionButtons label={person.name} onEdit={() => setEditingUser(person)} onDelete={() => deleteUser(person)} /></td>
          </tr>; })}
          {!visibleUsers.length && <tr><td colSpan={4}><div className="membership-empty">No users match “{query}”.</div></td></tr>}
        </tbody></table></div>
      </div>
    </section>

    {editing && <div className="admin-modal-backdrop" onMouseDown={() => setEditing(undefined)}><section className="admin-modal membership-modal" role="dialog" aria-modal="true" aria-labelledby="membership-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setEditing(undefined)} aria-label="Close">×</button><span className="modal-eyebrow">Manage membership</span><h2 id="membership-title">{editing.name}</h2><p>Assign user accounts to this MT group. Group membership does not change their account role.</p><div className="membership-summary"><strong>{editing.memberIds?.length ?? 0} selected</strong><span>{assignableUsers.length} available users</span></div><label className="member-search search"><SearchIcon /><input autoFocus aria-label="Search users for group" value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="Search by name or email" /></label><div className="membership-view-switch" role="group" aria-label="Member list view"><button type="button" className={!assignedOnly ? "active" : ""} onClick={() => setAssignedOnly(false)}>All users</button><button type="button" className={assignedOnly ? "active" : ""} onClick={() => setAssignedOnly(true)}>Assigned only ({editing.memberIds?.length ?? 0})</button></div><div className="membership-bulk"><span>{visibleStaff.length} user{visibleStaff.length === 1 ? "" : "s"} shown</span><button type="button" onClick={() => setVisibleMembership(true)}>Select visible</button><button type="button" onClick={() => setVisibleMembership(false)}>Clear visible</button></div><div className="membership-list">{visibleStaff.length ? visibleStaff.map((person) => <label key={person.id}><input type="checkbox" checked={editing.memberIds?.includes(person.id) ?? false} onChange={() => toggleMember(editing, person.id)} /><span><strong>{person.name}</strong><small>{person.email} · {ROLE_LABELS[person.role] ?? person.role} · {person.authMethod ?? "PASSWORD"}</small></span></label>) : <div className="membership-empty">{assignedOnly ? "No assigned users match your search." : "No users match your search."}</div>}</div><button className="button primary" onClick={() => setEditing(undefined)}>Done</button></section></div>}

    {editingGroup && <div className="admin-modal-backdrop" onMouseDown={() => setEditingGroup(undefined)}><form className="admin-modal directory-form group-form" role="dialog" aria-modal="true" aria-label={`Edit ${editingGroup.name}`} onMouseDown={(event) => event.stopPropagation()} onSubmit={submitGroupEdit}><button type="button" className="modal-close" onClick={() => setEditingGroup(undefined)} aria-label="Close">×</button><h2>Edit MT group</h2><label>Group name<input aria-label="Edit group name" autoFocus required value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /></label><label>Site code<input aria-label="Edit group site" required value={editForm.site} onChange={(event) => setEditForm({ ...editForm, site: event.target.value })} /></label><label className="directory-check"><input type="checkbox" checked={editForm.canClose} onChange={(event) => setEditForm({ ...editForm, canClose: event.target.checked })} /> Can confirm closure</label><label className="directory-check"><input type="checkbox" checked={editForm.editable} onChange={(event) => setEditForm({ ...editForm, editable: event.target.checked })} /> Can edit permit information</label><div><button type="button" className="button ghost" onClick={() => setEditingGroup(undefined)}>Cancel</button><button className="button primary">Save changes</button></div></form></div>}

    {editingUser && <div className="admin-modal-backdrop" onMouseDown={() => setEditingUser(undefined)}><section className="admin-modal user-groups-modal" role="dialog" aria-modal="true" aria-labelledby="user-groups-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setEditingUser(undefined)} aria-label="Close">×</button><span className="modal-eyebrow">Edit MT group access</span><div className="user-groups-heading"><span className={`user-list-avatar ${userAvatarColorClass(editingUser.role)}`}>{userInitials(editingUser.name)}</span><div><h2 id="user-groups-title">{editingUser.name}</h2><p>{editingUser.email} · {ROLE_LABELS[editingUser.role] ?? editingUser.role}</p></div></div><p>Select every MT group this user should belong to. Changes take effect immediately.</p><div className="user-group-options">{groups.map((group) => { const checked = group.memberIds?.includes(editingUser.id) ?? false; return <label key={group.id}><input type="checkbox" checked={checked} onChange={(event) => setUserGroup(editingUser, group, event.target.checked)} /><span><strong>{group.name}</strong><small>{group.site} · {group.canClose ? "Can confirm closure" : "Cannot confirm closure"} · {group.editable ? "Can edit permits" : "Read-only permits"}</small></span><i>{checked ? "Assigned" : "Not assigned"}</i></label>; })}</div><div className="user-groups-footer"><span>{groupsForUser(editingUser).length} of {groups.length} groups assigned</span><button className="button primary" onClick={() => setEditingUser(undefined)}>Done</button></div></section></div>}
  </div>;
}
