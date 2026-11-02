import { useMemo, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import type { User } from "../../domain/types";
import AdminActionButtons from "./AdminActionButtons";

export type Company = {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  createdAt: string;
};

export const COMPANY_STORAGE_KEY = "eptw-companies:v1";
export const companySeeds: Company[] = [
  { id: "company-acme", name: "Acme Engineering", status: "Active", createdAt: "2026-09-08T08:00:00.000Z" },
  { id: "company-micron", name: "Micron Semiconductor Asia Pte Ltd", status: "Active", createdAt: "2026-09-08T08:00:00.000Z" },
  { id: "company-vendor", name: "Vendor Services", status: "Active", createdAt: "2026-09-08T08:00:00.000Z" },
];

export function readCompanies(): Company[] {
  try {
    const saved = localStorage.getItem(COMPANY_STORAGE_KEY);
    return saved ? JSON.parse(saved) as Company[] : companySeeds;
  } catch {
    return companySeeds;
  }
}

export function micronCompanyName(companies = readCompanies()): string {
  return companies.find((company) => company.name.toLowerCase().startsWith("micron"))?.name ?? "Not assigned";
}

const emptyForm = { name: "", status: "Active" as Company["status"] };

export default function CompanyListPage({ user }: { user: User }) {
  const [companies, setCompanies] = useState<Company[]>(readCompanies);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return companies
      .filter((company) => !search || company.name.toLowerCase().includes(search))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [companies, query]);

  if (!["SUPER_ADMIN", "USER_ADMIN"].includes(user.role)) return <Navigate to="/dashboard" replace />;

  const closeForm = () => {
    setAdding(false);
    setEditingId(undefined);
    setForm(emptyForm);
    setError("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    if (companies.some((company) => company.id !== editingId && company.name.toLowerCase() === name.toLowerCase())) {
      setError("A company with this name already exists.");
      return;
    }
    const next = editingId ? companies.map((company) => company.id === editingId ? { ...company, name, status: form.status } : company) : [...companies, {
      id: crypto.randomUUID(),
      name,
      status: "Active" as const,
      createdAt: new Date().toISOString(),
    }];
    setCompanies(next);
    localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(next));
    closeForm();
  };

  const editCompany = (company: Company) => {
    setEditingId(company.id);
    setForm({ name: company.name, status: company.status });
    setError("");
    setAdding(true);
  };

  const deleteCompany = (company: Company) => {
    if (!window.confirm(`Delete ${company.name}?`)) return;
    const next = companies.filter((item) => item.id !== company.id);
    setCompanies(next);
    localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(next));
    if (editingId === company.id) closeForm();
  };

  return <div className="page company-page">
    <header className="page-header">
      <div><span className="eyebrow">System management</span><h1>Company List</h1><p>Manage contractor companies that can be assigned to ePTW users and permits.</p></div>
      <button className="button primary" onClick={() => { setEditingId(undefined); setForm(emptyForm); setAdding(true); setError(""); }}>＋ Add company</button>
    </header>
    <section className="card company-workspace">
      <div className="company-toolbar">
        <label className="search"><span>⌕</span><input aria-label="Search companies" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company name" /></label>
        <span className="result-count">{visible.length} compan{visible.length === 1 ? "y" : "ies"}</span>
      </div>
      {adding && <form className="company-form" onSubmit={submit}>
        <div className="company-form-head"><div><h2>{editingId ? "Edit" : "Add"} company</h2><p>{editingId ? "Update the company name and status used across ePTW." : "Create a contractor company for use across ePTW."}</p></div><button type="button" aria-label="Close form" onClick={closeForm}>×</button></div>
        <div className={`company-form-grid ${editingId ? "editing" : ""}`}>
          <label>Company name<input required value={form.name} onChange={(event) => { setForm({ ...form, name: event.target.value }); setError(""); }} placeholder="e.g. Example Engineering Pte Ltd" /></label>
          {editingId && <label>Company status<select aria-label="Company status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Company["status"] })}><option>Active</option><option>Inactive</option></select></label>}
        </div>
        {error && <p className="company-form-error" role="alert">{error}</p>}
        <div className="company-form-actions"><button type="button" className="button ghost" onClick={closeForm}>Cancel</button><button className="button primary" type="submit">{editingId ? "Save changes" : "Save company"}</button></div>
      </form>}
      <div className="company-table-wrap"><table className="company-table"><thead><tr><th>Company name</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.map((company) => <tr key={company.id}><td><strong>{company.name}</strong></td><td><span className={`company-status ${company.status.toLowerCase()}`}>{company.status}</span></td><td><AdminActionButtons label={company.name} onEdit={() => editCompany(company)} onDelete={() => deleteCompany(company)} /></td></tr>)}</tbody></table>
        {!visible.length && <div className="company-empty"><strong>No companies found</strong><span>Try changing your search or add a company.</span></div>}
      </div>
    </section>
  </div>;
}
