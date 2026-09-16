import { useMemo, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import type { User } from "./types";

export type Company = {
  id: string;
  name: string;
  registrationNumber: string;
  contactName: string;
  contactEmail: string;
  status: "Active" | "Inactive";
  createdAt: string;
};

export const COMPANY_STORAGE_KEY = "eptw-companies:v1";
export const companySeeds: Company[] = [
  { id: "company-acme", name: "Acme Engineering", registrationNumber: "201912345N", contactName: "Priya Menon", contactEmail: "priya@contractor.example", status: "Active", createdAt: "2026-09-08T08:00:00.000Z" },
  { id: "company-vendor", name: "Vendor Services", registrationNumber: "202023456K", contactName: "Daniel Tan", contactEmail: "daniel@vendor.example", status: "Active", createdAt: "2026-09-08T08:00:00.000Z" },
];

export function readCompanies(): Company[] {
  try {
    const saved = localStorage.getItem(COMPANY_STORAGE_KEY);
    return saved ? JSON.parse(saved) as Company[] : companySeeds;
  } catch {
    return companySeeds;
  }
}

const emptyForm = { name: "", registrationNumber: "", contactName: "", contactEmail: "" };

export default function CompanyListPage({ user }: { user: User }) {
  const [companies, setCompanies] = useState<Company[]>(readCompanies);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return companies
      .filter((company) => !search || `${company.name} ${company.registrationNumber} ${company.contactName} ${company.contactEmail}`.toLowerCase().includes(search))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [companies, query]);

  if (user.role !== "SUPER_ADMIN") return <Navigate to="/dashboard" replace />;

  const closeForm = () => {
    setAdding(false);
    setForm(emptyForm);
    setError("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const registrationNumber = form.registrationNumber.trim().toUpperCase();
    if (companies.some((company) => company.registrationNumber.toUpperCase() === registrationNumber)) {
      setError("A company with this registration number already exists.");
      return;
    }
    const next = [...companies, {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      registrationNumber,
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim().toLowerCase(),
      status: "Active" as const,
      createdAt: new Date().toISOString(),
    }];
    setCompanies(next);
    localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(next));
    closeForm();
  };

  return <div className="page company-page">
    <header className="page-header">
      <div><span className="eyebrow">System management</span><h1>Company List</h1><p>Manage contractor companies that can be assigned to ePTW users and permits.</p></div>
      <button className="button primary" onClick={() => { setAdding(true); setError(""); }}>＋ Add company</button>
    </header>
    <section className="card company-workspace">
      <div className="company-toolbar">
        <label className="search"><span>⌕</span><input aria-label="Search companies" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company, registration number or contact" /></label>
        <span className="result-count">{visible.length} compan{visible.length === 1 ? "y" : "ies"}</span>
      </div>
      {adding && <form className="company-form" onSubmit={submit}>
        <div className="company-form-head"><div><h2>Add company</h2><p>Create a contractor company for use across ePTW.</p></div><button type="button" aria-label="Close form" onClick={closeForm}>×</button></div>
        <div className="company-form-grid">
          <label>Company name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Example Engineering Pte Ltd" /></label>
          <label>Registration number<input required value={form.registrationNumber} onChange={(event) => { setForm({ ...form, registrationNumber: event.target.value }); setError(""); }} placeholder="e.g. 202612345A" /></label>
          <label>Primary contact<input required value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} placeholder="Contact person's name" /></label>
          <label>Contact email<input required type="email" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} placeholder="contact@example.com" /></label>
        </div>
        {error && <p className="company-form-error" role="alert">{error}</p>}
        <div className="company-form-actions"><button type="button" className="button ghost" onClick={closeForm}>Cancel</button><button className="button primary" type="submit">Save company</button></div>
      </form>}
      <div className="company-table-wrap"><table className="company-table"><thead><tr><th>#</th><th>Company name</th><th>Registration no.</th><th>Primary contact</th><th>Email address</th><th>Status</th></tr></thead><tbody>{visible.map((company, index) => <tr key={company.id}><td>{index + 1}</td><td><strong>{company.name}</strong></td><td><b className="company-registration">{company.registrationNumber}</b></td><td>{company.contactName}</td><td><a href={`mailto:${company.contactEmail}`}>{company.contactEmail}</a></td><td><span className={`company-status ${company.status.toLowerCase()}`}>{company.status}</span></td></tr>)}</tbody></table>
        {!visible.length && <div className="company-empty"><strong>No companies found</strong><span>Try changing your search or add a company.</span></div>}
      </div>
    </section>
  </div>;
}
