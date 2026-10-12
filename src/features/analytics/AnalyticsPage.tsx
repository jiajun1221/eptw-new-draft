import { useMemo, useState, type ReactNode } from "react";

type StatusDatum = { label: string; value: number; color: string };
type BreakdownRow = { label: string; general: number; tool: number; child: number };

const statuses: StatusDatum[] = [
  { label: "Pending PM approval", value: 18, color: "#f59e0b" }, { label: "Pending individual", value: 12, color: "#f97316" },
  { label: "Pending MT Group", value: 9, color: "#8b5cf6" }, { label: "Approved", value: 34, color: "#10b981" },
  { label: "Pending closure", value: 7, color: "#0ea5e9" }, { label: "Cancelled", value: 4, color: "#94a3b8" },
  { label: "Completed", value: 28, color: "#2563eb" }, { label: "Rejected", value: 6, color: "#dc2626" },
];
const childTypes = [["B1", "Hot Work", 18], ["B2", "Confined Space", 7], ["B3", "Lifting", 12], ["B4", "Work at Height", 15], ["B5", "LSS Impairment", 8], ["B6", "Live Electrical", 10], ["B7", "SIPP", 6], ["B8", "Dirty Work", 9]] as const;
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const generalMonthly = [18, 23, 20, 29, 26, 35, 31, 38, 34, 42, 39, 46];
const toolMonthly = [9, 12, 11, 15, 18, 17, 21, 20, 24, 26, 23, 29];
const approvedMonthlyRows = months.map((month, index) => {
  const general = [8, 11, 9, 14, 12, 16, 15, 18, 16, 20, 18, 21][index];
  const tool = [3, 4, 4, 5, 4, 6, 5, 7, 6, 7, 7, 8][index];
  const child = [4, 6, 5, 9, 8, 9, 9, 11, 11, 12, 12, 14][index];
  return { month, general, tool, child, total: general + tool + child };
});
const approvedMonthly = approvedMonthlyRows.map((row) => row.total);
const initiativeSites = ["F10A1", "F10A2", "F10N", "F10NX", "F10W", "F10X"];
const initiativePermits = [38, 24, 31, 17, 22, 14];
const contractorRows: BreakdownRow[] = [{ label: "Acme Engineering", general: 24, tool: 11, child: 19 }, { label: "Vendor Services", general: 18, tool: 9, child: 14 }, { label: "Northstar Engineering", general: 13, tool: 7, child: 10 }, { label: "Prime M&E", general: 9, tool: 5, child: 8 }];
const disciplineRows: BreakdownRow[] = [{ label: "Facilities", general: 31, tool: 16, child: 28 }, { label: "AMHS", general: 22, tool: 12, child: 14 }, { label: "IT", general: 11, tool: 4, child: 9 }];
const levelRows: BreakdownRow[] = [{ label: "Basement", general: 14, tool: 5, child: 12 }, { label: "Level 1", general: 21, tool: 12, child: 18 }, { label: "Level 2", general: 18, tool: 10, child: 15 }, { label: "Roof", general: 11, tool: 5, child: 6 }];

function Filters({ year = false, status = false, child = false }: { year?: boolean; status?: boolean; child?: boolean }) {
  return <div className="analytics-filters">{year ? <select aria-label="Analytics year" defaultValue="2026"><option>2026</option><option>2025</option></select> : <><input aria-label="Analytics start date" type="date" defaultValue="2026-09-01"/><input aria-label="Analytics end date" type="date" defaultValue="2026-09-30"/></>}{child && <select aria-label="Child permit type" defaultValue="ALL"><option value="ALL">All child permit types</option>{childTypes.map(([code, name]) => <option key={code}>{code} · {name}</option>)}</select>}<select aria-label="Analytics site" defaultValue="ALL"><option value="ALL">All sites</option><option>F10A1</option><option>F10A2</option><option>F10N</option></select>{status && <select aria-label="Analytics permit status" defaultValue="ALL"><option value="ALL">All permit statuses</option>{statuses.map((item) => <option key={item.label}>{item.label}</option>)}</select>}<button type="button" className="button primary small">Apply filters</button></div>;
}
function Bars({ labels, values, color = "#2f6ddd" }: { labels: string[]; values: number[]; color?: string }) {
  const max = Math.max(...values, 1); return <div className="bar-chart" role="img" aria-label="Permit count bar chart">{values.map((value, index) => <div className="bar-item" key={`${labels[index]}-${index}`}><span>{value}</span><div style={{ height: `${Math.max(value / max * 100, 3)}%`, background: color }}/><small>{labels[index]}</small></div>)}</div>;
}
function Lines({ first, second }: { first: number[]; second?: number[] }) {
  const max = Math.max(...first, ...(second ?? []), 1); const points = (values: number[]) => values.map((value, index) => `${8 + index * 84 / 11},${92 - value / max * 78}`).join(" ");
  return <div className="line-chart" role="img" aria-label="Monthly permit trend"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="8" y1="92" x2="98" y2="92"/><polyline className="line-general" points={points(first)}/>{second && <polyline className="line-tool" points={points(second)}/>}</svg><div>{months.map((month) => <span key={month}>{month}</span>)}</div></div>;
}
function BreakdownTable({ rows }: { rows: BreakdownRow[] }) { return <div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th>Category</th><th>General</th><th>Tool install</th><th>Child permit</th><th>Total</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label}><td><strong>{row.label}</strong></td><td>{row.general}</td><td>{row.tool}</td><td>{row.child}</td><td><b>{row.general + row.tool + row.child}</b></td></tr>)}</tbody></table></div>; }
function MonthlyApprovedTable() {
  const totals = approvedMonthlyRows.reduce((sum, row) => ({
    general: sum.general + row.general,
    tool: sum.tool + row.tool,
    child: sum.child + row.child,
    total: sum.total + row.total,
  }), { general: 0, tool: 0, child: 0, total: 0 });

  return <div className="analytics-table-wrap monthly-approved-table-wrap"><table className="analytics-table monthly-approved-table"><thead><tr><th>Month</th><th>General</th><th>Tool install</th><th>Child permit</th><th>Grand total</th></tr></thead><tbody>{approvedMonthlyRows.map((row) => <tr key={row.month}><td><strong>{row.month}</strong></td><td>{row.general}</td><td>{row.tool}</td><td>{row.child}</td><td><b>{row.total}</b></td></tr>)}</tbody><tfoot><tr><th>Grand total</th><td>{totals.general}</td><td>{totals.tool}</td><td>{totals.child}</td><td><b>{totals.total}</b></td></tr></tfoot></table></div>;
}
function ReportCard({ number, title, text, children, wide = false }: { number: number; title: string; text: string; children: ReactNode; wide?: boolean }) { return <section className={`card analytics-report ${wide ? "wide" : ""}`}><header><span>{String(number).padStart(2, "0")}</span><div><h2>{title}</h2><p>{text}</p></div></header>{children}</section>; }

export default function AnalyticsPage() {
  const [breakdown, setBreakdown] = useState("Contractor"); const [expanded, setExpanded] = useState<string[]>(["General Permit"]);
  const rows = useMemo(() => breakdown === "Discipline" ? disciplineRows : breakdown === "Level" ? levelRows : breakdown === "Child Permit" ? childTypes.slice(0, 4).map(([code, name, count]) => ({ label: `${code} · ${name}`, general: count, tool: Math.round(count * .45), child: Math.round(count * .8) })) : contractorRows, [breakdown]);
  const toggle = (name: string) => setExpanded((items) => items.includes(name) ? items.filter((item) => item !== name) : [...items, name]);
  return <div className="page analytics-page"><header className="page-header"><div><span className="eyebrow">Operational intelligence</span><h1>Analytics</h1><p>Permit trends, approval status, and controlled-work activity across sites.</p></div><button className="button ghost">⇩ Export report</button></header>
    <div className="analytics-grid">
      <ReportCard number={1} title="Monthly approved permit count" text="Approved permit output by month across all permit categories." wide><Filters/><div className="monthly-approved-layout"><MonthlyApprovedTable/><div className="monthly-approved-chart"><h3>No. of E-Permit</h3><Bars labels={months} values={approvedMonthly} color="#2f6ddd"/></div></div></ReportCard>
      <ReportCard number={2} title="Child permits by date range" text="Volume by child permit category and selected period."><Filters child/><div className="child-chart-layout"><ol>{childTypes.map(([code, name, count]) => <li key={code}><b>{code}</b><span>{name}</span><strong>{count}</strong></li>)}</ol><Bars labels={childTypes.map(([code]) => code)} values={childTypes.map(([, , value]) => value)} color="#7c3aed"/></div></ReportCard>
      <ReportCard number={3} title="General vs tool install permits" text="Monthly comparison of the two parent permit streams."><Filters year/><div className="chart-key"><span><i className="general"/>General permit</span><span><i className="tool"/>Tool install permit</span></div><Lines first={generalMonthly} second={toolMonthly}/></ReportCard>
      <ReportCard number={4} title="Permit count by date range and site" text="Explore permit volume by operational dimension." wide><div className="analytics-tabs" role="tablist">{["Contractor", "Discipline", "Level", "Child Permit"].map((tab) => <button role="tab" aria-selected={breakdown === tab} onClick={() => setBreakdown(tab)} key={tab}>By {tab}</button>)}</div><Filters status/><BreakdownTable rows={rows}/></ReportCard>
      <ReportCard number={5} title="General and tool install count by child permit" text="Inspect linked child-control demand by parent permit type."><Filters/><div className="analytics-accordion-actions"><button onClick={() => setExpanded(["General Permit", "Tool Install Permit"])}>Expand all</button><button onClick={() => setExpanded([])}>Collapse all</button></div>{["General Permit", "Tool Install Permit"].map((name, parentIndex) => <div className="analytics-accordion" key={name}><button aria-expanded={expanded.includes(name)} onClick={() => toggle(name)}><span>{expanded.includes(name) ? "−" : "+"}</span><strong>{name}</strong><b>{parentIndex ? 41 : 67}</b></button>{expanded.includes(name) && <div>{childTypes.slice(parentIndex * 2, parentIndex * 2 + 5).map(([code, label, count]) => <p key={code}><span>{code} · {label}</span><i><b style={{ width: `${count / 18 * 100}%` }}/></i><strong>{count}</strong></p>)}</div>}</div>)}</ReportCard>
      <ReportCard number={7} title="ePTW initiatives and carbon savings" text="Estimate paper avoided through electronic permit adoption."><Filters year/><div className="initiative-layout"><div><div className="chart-key initiative-key"><span><i className="general"/>Estimated paper avoided (kg)</span></div><Bars labels={initiativeSites} values={initiativePermits.map((value) => Number((value * .4).toFixed(1)))} color="#26955b"/></div><aside className="initiative-impact"><div className="initiative-tree" aria-hidden="true">🌳</div><span>Paperless permit impact</span><strong>{initiativePermits.reduce((sum, value) => sum + value, 0)} permits</strong><b>{(initiativePermits.reduce((sum, value) => sum + value, 0) * .4).toFixed(1)} kg</b><small>estimated paper avoided</small><p><strong>1 permit</strong> = 400 g paper equivalent</p></aside></div></ReportCard>
    </div></div>;
}
