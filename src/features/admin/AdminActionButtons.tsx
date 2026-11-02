type AdminActionButtonsProps = {
  label?: string;
  onView?: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function ActionIcon({ name }: { name: "view" | "edit" | "delete" }) {
  if (name === "view") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.7" /></svg>;
  if (name === "edit") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5Z" /><path d="m13.8 6.7 3.5 3.5" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4.5 7h15M9 3.8h6l1 3.2H8l1-3.2ZM7 7l.8 13.2h8.4L17 7M10 10.5v6M14 10.5v6" /></svg>;
}

export default function AdminActionButtons({ label, onView, onEdit, onDelete }: AdminActionButtonsProps) {
  const actionLabel = (action: string) => label ? `${action} ${label}` : action;
  return <div className="admin-action-buttons">
    {onView && <button type="button" aria-label={actionLabel("View")} title={actionLabel("View")} onClick={onView}><ActionIcon name="view" /></button>}
    <button type="button" aria-label={actionLabel("Edit")} title={actionLabel("Edit")} onClick={onEdit}><ActionIcon name="edit" /></button>
    <button type="button" className="danger" aria-label={actionLabel("Delete")} title={actionLabel("Delete")} onClick={onDelete}><ActionIcon name="delete" /></button>
  </div>;
}
