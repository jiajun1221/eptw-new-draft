import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ROLE_LABELS, SITES, USERS } from "./constants";
import { readCompanies } from "./CompanyListPage";
import type { Role, User } from "./types";

type AuthProps = { user: User | null; onDemoLogin: (user: User) => void; onRegister: (user: User) => void };

function BrandPanel() {
  return <aside className="auth-brand"><div className="auth-logo"><span>micron</span><sup>®</sup><small>ePTW</small></div><div><p>Electronic Permit to Work</p><h1>Safer work starts with the right access.</h1><span>Apply, review, and manage permits across Micron sites.</span></div></aside>;
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="auth-page"><BrandPanel /><section className="auth-main">{children}</section></main>;
}

export function LoginPage({ user, onDemoLogin }: Pick<AuthProps, "user" | "onDemoLogin">) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [demoId, setDemoId] = useState(USERS[0].id);
  const [error, setError] = useState("");
  if (user) return <Navigate to="/dashboard" replace />;
  const sso = (event: FormEvent) => {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized.endsWith("@micron.com")) { setError("Enter your Micron email address to continue with SSO."); return; }
    const existing = USERS.find((item) => item.email.toLowerCase() === normalized && item.role === "MICRON_STAFF");
    if (existing) { onDemoLogin(existing); navigate("/dashboard"); return; }
    navigate(`/register/micron?email=${encodeURIComponent(normalized)}`);
  };
  return <AuthLayout><div className="auth-card login-card"><span className="auth-eyebrow">Welcome to ePTW</span><h2>Sign in to your account</h2><p>Micron team members can continue using their corporate identity.</p><form onSubmit={sso} className="auth-form"><label>Micron email address<input aria-label="Micron email address" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="name@micron.com" required /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="button primary auth-submit" type="submit">Continue with Micron SSO</button></form><div className="auth-divider"><span>or</span></div><Link className="button ghost auth-submit" to="/register/contractor">Self-registration</Link><p className="auth-hint">For contractor project managers and permit requestors.</p><details className="demo-login"><summary>Use a demo account</summary><label>Demo identity<select aria-label="Demo identity" value={demoId} onChange={(event) => setDemoId(event.target.value)}>{USERS.map((item) => <option key={item.id} value={item.id}>{item.name} · {ROLE_LABELS[item.role]}</option>)}</select></label><button className="button ghost auth-submit" onClick={() => { onDemoLogin(USERS.find((item) => item.id === demoId)!); navigate("/dashboard"); }}>Sign in as demo user</button></details></div></AuthLayout>;
}

function SitePicker({ sites, setSites }: { sites: string[]; setSites: (sites: string[]) => void }) {
  const toggle = (site: string) => setSites(sites.includes(site) ? sites.filter((item) => item !== site) : [...sites, site]);
  return <fieldset className="site-picker"><legend>Site access</legend><p>All sites are selected by default.</p><div>{SITES.map((site) => <label key={site}><input type="checkbox" checked={sites.includes(site)} onChange={() => toggle(site)} />{site}</label>)}</div></fieldset>;
}

export function MicronRegistrationPage({ user, onRegister }: Pick<AuthProps, "user" | "onRegister">) {
  const navigate = useNavigate(); const [params] = useSearchParams();
  const [name, setName] = useState(""); const [email, setEmail] = useState(params.get("email") ?? "");
  const [sites, setSites] = useState<string[]>([...SITES]); const [attachment, setAttachment] = useState<File | null>(null); const [error, setError] = useState("");
  if (user) return <Navigate to="/tutorial" replace />;
  const submit = (event: FormEvent) => { event.preventDefault(); const normalized = email.trim().toLowerCase(); if (!normalized.endsWith("@micron.com")) return setError("A valid @micron.com email address is required."); if (!sites.length) return setError("Select at least one site."); if (!attachment) return setError("Attach your learning course completion evidence."); if (!['application/pdf', 'image/png', 'image/jpeg'].includes(attachment.type)) return setError("Upload a PDF, PNG, or JPG file."); onRegister({ id: `temp-${crypto.randomUUID()}`, name: name.trim(), email: normalized, role: "MICRON_STAFF", authMethod: "SSO", company: "Micron", sites }); navigate("/tutorial"); };
  return <AuthLayout><div className="auth-card register-card"><Link className="back-link" to="/login">← Back to login</Link><span className="auth-eyebrow">Micron team member</span><h2>Register your ePTW account</h2><p>Complete your profile and provide evidence of the required learning course.</p><form className="auth-form registration-grid" onSubmit={submit}><label>Full name<input aria-label="Full name" required value={name} onChange={(e) => setName(e.target.value)} /></label><label>Email address<input aria-label="Email address" required type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} /></label><label>Role<input aria-label="Role" value="Micron Staff" readOnly /></label><label>Company<input aria-label="Company" value="Micron" readOnly /></label><SitePicker sites={sites} setSites={setSites} /><label className="file-field">Learning course completion<input aria-label="Learning course completion" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => { setAttachment(e.target.files?.[0] ?? null); setError(""); }} /><small>{attachment ? attachment.name : "Required · PDF, PNG, or JPG"}</small></label>{error && <p className="auth-error form-wide" role="alert">{error}</p>}<button className="button primary auth-submit form-wide" type="submit">Register and view tutorial</button></form></div></AuthLayout>;
}

export function ContractorRegistrationPage({ user, onRegister }: Pick<AuthProps, "user" | "onRegister">) {
  const navigate = useNavigate(); const companies = readCompanies().filter((company) => company.status === "Active");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [role, setRole] = useState<Role>("CONTRACTOR_REQUESTOR"); const [company, setCompany] = useState(companies[0]?.name ?? ""); const [sites, setSites] = useState<string[]>([...SITES]); const [error, setError] = useState("");
  if (user) return <Navigate to="/tutorial" replace />;
  const submit = (event: FormEvent) => { event.preventDefault(); if (!sites.length) return setError("Select at least one site."); onRegister({ id: `temp-${crypto.randomUUID()}`, name: name.trim(), email: email.trim().toLowerCase(), role, authMethod: "PASSWORD", company, sites }); navigate("/tutorial"); };
  return <AuthLayout><div className="auth-card register-card"><Link className="back-link" to="/login">← Back to login</Link><span className="auth-eyebrow">Contractor access</span><h2>Self-registration</h2><p>Create a temporary contractor profile for this ePTW session.</p><form className="auth-form registration-grid" onSubmit={submit}><label>Full name<input aria-label="Full name" required value={name} onChange={(e) => setName(e.target.value)} /></label><label>Email address<input aria-label="Email address" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Role<select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}><option value="CONTRACTOR_REQUESTOR">Contractor Requestor</option><option value="CONTRACTOR_PM">Contractor PM</option></select></label><label>Company<select aria-label="Company" required value={company} onChange={(e) => setCompany(e.target.value)}>{companies.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label><SitePicker sites={sites} setSites={setSites} />{error && <p className="auth-error form-wide" role="alert">{error}</p>}<button className="button primary auth-submit form-wide" type="submit">Register and view tutorial</button></form></div></AuthLayout>;
}

export function TutorialPage({ user }: { user: User | null }) {
  if (!user) return <Navigate to="/login" replace />;
  const contractor = user.role === "CONTRACTOR_REQUESTOR" || user.role === "CONTRACTOR_PM";
  const steps = contractor ? ["Confirm your company and site access", "Create or review the permit work scope", "Follow each approval and closure stage"] : ["Review your assigned site access", "Check permits awaiting your action", "Record decisions and supporting evidence"];
  return <AuthLayout><div className="auth-card tutorial-card"><span className="success-mark">✓</span><span className="auth-eyebrow">Registration complete</span><h2>Welcome, {user.name.split(" ")[0]}</h2><p>Your {ROLE_LABELS[user.role]} profile is ready for this session. Here is how to get started.</p><ol>{steps.map((step, index) => <li key={step}><b>{index + 1}</b><span>{step}</span></li>)}</ol><Link className="button primary auth-submit" to="/dashboard">Continue to dashboard</Link></div></AuthLayout>;
}
