import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ROLE_LABELS, SITES, USER_ACCOUNT_GROUPS, USERS } from "../../domain/constants";
import { micronCompanyName, readCompanies } from "../admin/CompanyListPage";
import { announcementDescriptionHtml, readLoginAnnouncement } from "../../domain/announcementStore";
import type { Role, User } from "../../domain/types";

type AuthProps = { user: User | null; onDemoLogin: (user: User) => void; onRegister: (user: User) => void };
const MICRON_SSO_URL = import.meta.env.VITE_MICRON_SSO_URL || "https://login.microsoftonline.com/";
const USER_DIRECTORY_KEY = "eptw-user-directory:v1";

function savePendingUser(user: User) {
  let directory: Array<{ id: string; name: string; email: string; company: string; sites: string[]; host: string; role: string; groups: string[]; status: "Active" | "Pending" | "Inactive"; lastLoginAt?: string }> = [];
  try { directory = JSON.parse(localStorage.getItem(USER_DIRECTORY_KEY) ?? "[]") as typeof directory; } catch { directory = []; }
  const micronStaff = user.role === "MICRON_STAFF";
  const record = { id: user.id, name: user.name, email: user.email, company: user.company ?? (micronStaff ? micronCompanyName() : "Not assigned"), sites: user.sites?.length ? user.sites : [...SITES], host: "Not assigned", role: ROLE_LABELS[user.role], groups: user.group ? [user.group] : [], status: micronStaff ? "Active" as const : "Pending" as const, lastLoginAt: micronStaff ? new Date().toISOString() : undefined };
  localStorage.setItem(USER_DIRECTORY_KEY, JSON.stringify([...directory.filter((item) => item.id !== user.id && item.email.toLowerCase() !== user.email.toLowerCase()), record]));
}

function BrandPanel() {
  return <aside className="auth-brand"><div className="auth-logo"><img src="/Micron-logo.svg" alt="Micron" /><small>ePTW</small></div><div><p>Electronic Permit to Work</p><h1>Safer work starts with the right access.</h1><span>Apply, review, and manage permits across Micron sites.</span></div></aside>;
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="auth-page"><BrandPanel /><section className="auth-main">{children}</section></main>;
}

export function LoginPage({ user, onDemoLogin }: Pick<AuthProps, "user" | "onDemoLogin">) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [demoId, setDemoId] = useState(USERS[0].id);
  const [error, setError] = useState("");
  const announcement = readLoginAnnouncement();
  const acknowledgementKey = announcement ? `eptw-login-announcement-ack:${announcement.updatedAt}` : "";
  const [announcementOpen, setAnnouncementOpen] = useState(() => Boolean(announcement && sessionStorage.getItem(acknowledgementKey) !== "yes"));
  const [acknowledged, setAcknowledged] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;
  const login = (event: FormEvent) => {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    const existing = USERS.find((item) => item.email.toLowerCase() === normalized);
    if (!existing) { setError("Email or password is incorrect."); return; }
    onDemoLogin(existing);
    navigate("/dashboard");
  };
  return <AuthLayout><div className="auth-card login-card"><span className="auth-eyebrow">Welcome to ePTW</span><h2>Sign in to your account</h2><p>Enter your account details or choose another access method.</p><form onSubmit={login} className="auth-form login-credentials"><label>Email<input aria-label="Email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="name@example.com" required /></label><label>Password<input aria-label="Password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="Enter your password" required /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="button primary auth-submit" type="submit">Login</button></form><details className="demo-login"><summary>Use Demo Account <span>(temporarily)</span></summary><label>Demo identity<select aria-label="Demo identity" value={demoId} onChange={(event) => setDemoId(event.target.value)}>{USER_ACCOUNT_GROUPS.map((group) => <optgroup key={group.label} label={group.label}>{USERS.filter((item) => group.roles.includes(item.role)).map((item) => <option key={item.id} value={item.id}>{item.name} · {ROLE_LABELS[item.role]}</option>)}</optgroup>)}</select></label><button type="button" className="button ghost auth-submit" onClick={() => { onDemoLogin(USERS.find((item) => item.id === demoId)!); navigate("/dashboard"); }}>Sign in as demo user</button></details><div className="auth-divider login-divider" aria-hidden="true" /><a className="button ghost auth-submit login-secondary" href={MICRON_SSO_URL}>Login with Micron SSO</a><div className="auth-choice">or</div><Link className="button ghost auth-submit login-secondary" to="/register/contractor">Self Registration</Link></div>{announcement && announcementOpen && <div className="login-announcement-backdrop"><section className="login-announcement-modal" role="dialog" aria-modal="true" aria-labelledby="login-announcement-title"><span className="auth-eyebrow">System announcement</span><h2 id="login-announcement-title">{announcement.title}</h2><div className="announcement-rich-text" dangerouslySetInnerHTML={{ __html: announcementDescriptionHtml(announcement.description) }} /><label className="login-announcement-check"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /> <span>I have read and acknowledge this announcement</span></label><button className="button primary" type="button" disabled={!acknowledged} onClick={() => { sessionStorage.setItem(acknowledgementKey, "yes"); setAnnouncementOpen(false); }}>Continue to login</button></section></div>}</AuthLayout>;
}

function SitePicker({ sites, setSites }: { sites: string[]; setSites: (sites: string[]) => void }) {
  const toggle = (site: string) => setSites(sites.includes(site) ? sites.filter((item) => item !== site) : [...sites, site]);
  return <fieldset className="site-picker"><legend>Site access</legend><p>All sites are selected by default.</p><div>{SITES.map((site) => <label key={site}><input type="checkbox" checked={sites.includes(site)} onChange={() => toggle(site)} />{site}</label>)}</div></fieldset>;
}

export function MicronRegistrationPage({ user, onRegister }: Pick<AuthProps, "user" | "onRegister">) {
  const navigate = useNavigate(); const [params] = useSearchParams();
  const [name, setName] = useState(""); const [email, setEmail] = useState(params.get("email") ?? "");
  const [sites, setSites] = useState<string[]>([...SITES]); const [attachment, setAttachment] = useState<File | null>(null); const [error, setError] = useState("");
  if (user) return <Navigate to="/registration-submitted" replace />;
  const micronCompany = micronCompanyName();
  const submit = (event: FormEvent) => { event.preventDefault(); const normalized = email.trim().toLowerCase(); if (!normalized.endsWith("@micron.com")) return setError("A valid @micron.com email address is required."); if (!sites.length) return setError("Select at least one site."); if (!attachment) return setError("Attach your learning course completion evidence."); if (!['application/pdf', 'image/png', 'image/jpeg'].includes(attachment.type)) return setError("Upload a PDF, PNG, or JPG file."); const next = { id: `temp-${crypto.randomUUID()}`, name: name.trim(), email: normalized, role: "MICRON_STAFF" as const, authMethod: "SSO" as const, company: micronCompany, sites }; savePendingUser(next); onRegister(next); navigate("/registration-submitted"); };
  return <AuthLayout><div className="auth-card register-card"><Link className="back-link" to="/login">← Back to login</Link><span className="auth-eyebrow">Micron team member</span><h2>Register your ePTW account</h2><p>Complete your profile and provide evidence of the required learning course.</p><form className="auth-form registration-grid" onSubmit={submit}><label>Full name<input aria-label="Full name" required value={name} onChange={(e) => setName(e.target.value)} /></label><label>Email address<input aria-label="Email address" required type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} /></label><label>Role<input aria-label="Role" value="Micron Staff" readOnly /></label><label>Company<input aria-label="Company" value={micronCompany} readOnly /></label><SitePicker sites={sites} setSites={setSites} /><label className="file-field">Learning course completion<input aria-label="Learning course completion" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => { setAttachment(e.target.files?.[0] ?? null); setError(""); }} /><small>{attachment ? attachment.name : "Required · PDF, PNG, or JPG"}</small></label>{error && <p className="auth-error form-wide" role="alert">{error}</p>}<button className="button primary auth-submit form-wide" type="submit">Register account</button></form></div></AuthLayout>;
}

export function ContractorRegistrationPage({ user, onRegister }: Pick<AuthProps, "user" | "onRegister">) {
  const navigate = useNavigate(); const companies = readCompanies().filter((company) => company.status === "Active");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [role, setRole] = useState<Role>("CONTRACTOR_REQUESTOR"); const [company, setCompany] = useState(companies[0]?.name ?? ""); const [sites, setSites] = useState<string[]>([...SITES]); const [error, setError] = useState("");
  if (user) return <Navigate to="/registration-submitted" replace />;
  const submit = (event: FormEvent) => { event.preventDefault(); if (!sites.length) return setError("Select at least one site."); const next = { id: `temp-${crypto.randomUUID()}`, name: name.trim(), email: email.trim().toLowerCase(), role, authMethod: "PASSWORD" as const, company, sites }; savePendingUser(next); onRegister(next); navigate("/registration-submitted"); };
  return <AuthLayout><div className="auth-card register-card"><Link className="back-link" to="/login">← Back to login</Link><span className="auth-eyebrow">Contractor access</span><h2>Self-registration</h2><p>Create a temporary contractor profile for this ePTW session.</p><form className="auth-form registration-grid" onSubmit={submit}><label>Full name<input aria-label="Full name" required value={name} onChange={(e) => setName(e.target.value)} /></label><label>Email address<input aria-label="Email address" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Role<select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}><option value="CONTRACTOR_REQUESTOR">Contractor Requestor</option><option value="CONTRACTOR_PM">Contractor PM</option></select></label><label>Company<select aria-label="Company" required value={company} onChange={(e) => setCompany(e.target.value)}>{companies.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label><SitePicker sites={sites} setSites={setSites} />{error && <p className="auth-error form-wide" role="alert">{error}</p>}<button className="button primary auth-submit form-wide" type="submit">Register account</button></form></div></AuthLayout>;
}

export function RegistrationSubmittedPage({ user }: { user: User | null }) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "MICRON_STAFF") return <AuthLayout><div className="auth-card registration-submitted-card"><span className="registration-active-icon">✓</span><span className="auth-eyebrow">Registration complete</span><h2>Your account has been created</h2><span className="pending-account-badge approved">Account status: Active</span><p>Your Micron staff account was approved automatically and is ready to use.</p><Link className="button primary auth-submit" to="/dashboard">Continue to dashboard</Link></div></AuthLayout>;
  return <AuthLayout><div className="auth-card registration-submitted-card"><span className="registration-pending-icon">!</span><span className="auth-eyebrow">Registration submitted</span><h2>Your account has been created</h2><span className="pending-account-badge">Account status: Pending</span><p>Your contractor account remains pending until you watch the required tutorials and pass the Q&amp;A quiz.</p><div className="activation-requirements"><div><b>1</b><span><strong>Watch the tutorials</strong><small>Review the required ePTW training videos.</small></span></div><div><b>2</b><span><strong>Pass the Q&amp;A quiz</strong><small>Meet the configured pass mark to activate your account.</small></span></div></div><Link className="button primary auth-submit" to="/tutorial">Continue to Tutorial &amp; Quiz Page</Link></div></AuthLayout>;
}
