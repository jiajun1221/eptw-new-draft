import { useMemo, useState, type ReactNode } from "react";

type DateBasis = "submission" | "approval";
type PermitCounts = { general: number; tool: number; child: number };
type BreakdownRow = PermitCounts & { label: string };

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const permitTypes = ["General", "Tool install", "Child permit"];
const approvedMonthly = [15, 21, 18, 28, 24, 31, 29, 36, 33, 39, 37, 43];
const contractorRows: BreakdownRow[] = [
  { label: "Acme Engineering", general: 24, tool: 11, child: 19 },
  { label: "Vendor Services", general: 18, tool: 9, child: 14 },
  { label: "Northstar Engineering", general: 13, tool: 7, child: 10 },
  { label: "Prime M&E", general: 9, tool: 5, child: 8 },
];
const disciplineRows: BreakdownRow[] = [
  { label: "Facilities", general: 31, tool: 16, child: 28 },
  { label: "AMHS", general: 22, tool: 12, child: 14 },
  { label: "IT", general: 11, tool: 4, child: 9 },
];
const levelRows: BreakdownRow[] = [
  { label: "Basement", general: 14, tool: 5, child: 12 },
  { label: "Level 1", general: 21, tool: 12, child: 18 },
  { label: "Level 2", general: 18, tool: 10, child: 15 },
  { label: "Roof", general: 11, tool: 5, child: 6 },
];
const statusRows = [
  { label: "Draft", values: [5, 3, 9] },
  { label: "Pending approval", values: [18, 9, 12] },
  { label: "Approved", values: [34, 16, 28] },
  { label: "Active", values: [11, 7, 10] },
  { label: "Closed", values: [28, 13, 21] },
  { label: "Rejected / cancelled", values: [6, 2, 4] },
];
const initiativeSites = ["F10A1", "F10A2", "F10N", "F10NX", "F10W", "F10X"];
const initiativeCounts = initiativeSites.map((site, siteIndex) => ({
  site,
  months: months.map((_, monthIndex) => 3 + ((siteIndex * 5 + monthIndex * 3) % 12)),
}));

function DateRangeFilters({ basis, selectable = false, onBasisChange }: { basis: DateBasis; selectable?: boolean; onBasisChange?: (basis: DateBasis) => void }) {
  return <div className="analytics-filters">
    {selectable ? <label className="analytics-filter-field"><span>Date used</span><select aria-label="Date used" value={basis} onChange={(event) => onBasisChange?.(event.target.value as DateBasis)}><option value="submission">Submission date</option><option value="approval">Approval date</option></select></label> : <div className="analytics-date-basis"><span>Date used</span><strong>{basis === "approval" ? "Approval date" : "Submission date"}</strong></div>}
    <label className="analytics-filter-field"><span>From</span><input aria-label="Analytics start date" type="date" defaultValue="2026-01-01" /></label>
    <label className="analytics-filter-field"><span>To</span><input aria-label="Analytics end date" type="date" defaultValue="2026-12-31" /></label>
    <label className="analytics-filter-field"><span>Site</span><select aria-label="Analytics site" defaultValue="ALL"><option value="ALL">All sites</option>{initiativeSites.map((site) => <option key={site}>{site}</option>)}</select></label>
    <button type="button" className="button primary small">Apply filters</button>
  </div>;
}

function YearFilters() {
  return <div className="analytics-filters">
    <div className="analytics-date-basis"><span>Date used</span><strong>Permit start date</strong></div>
    <label className="analytics-filter-field"><span>Year</span><select aria-label="Analytics year" defaultValue="2026"><option>2026</option><option>2025</option></select></label>
    <label className="analytics-filter-field"><span>Site</span><select aria-label="Analytics site" defaultValue="ALL"><option value="ALL">All sites</option>{initiativeSites.map((site) => <option key={site}>{site}</option>)}</select></label>
    <button type="button" className="button primary small">Apply filters</button>
  </div>;
}

function Bars({ labels, values, color = "#2f6ddd", ariaLabel }: { labels: string[]; values: number[]; color?: string; ariaLabel: string }) {
  const max = Math.max(...values, 1);
  return <div className="bar-chart" role="img" aria-label={ariaLabel}>{values.map((value, index) => <div className="bar-item" key={`${labels[index]}-${index}`}><span>{value}</span><div style={{ height: `${Math.max(value / max * 100, 3)}%`, background: color }} /><small>{labels[index]}</small></div>)}</div>;
}

function BreakdownTable({ dimension, rows }: { dimension: string; rows: BreakdownRow[] }) {
  return <div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th>{dimension}</th><th>General</th><th>Tool install</th><th>Child permit</th><th>Total</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label}><td><strong>{row.label}</strong></td><td>{row.general}</td><td>{row.tool}</td><td>{row.child}</td><td><b>{row.general + row.tool + row.child}</b></td></tr>)}</tbody></table></div>;
}

function DateBreakdown({ dimension, rows }: { dimension: string; rows: BreakdownRow[] }) {
  const [basis, setBasis] = useState<DateBasis>("submission");
  const displayedRows = basis === "submission" ? rows : rows.map((row) => ({ ...row, general: Math.round(row.general * .72), tool: Math.round(row.tool * .72), child: Math.round(row.child * .72) }));
  const totals = displayedRows.map((row) => row.general + row.tool + row.child);
  return <><DateRangeFilters basis={basis} selectable onBasisChange={setBasis} /><div className="analytics-context" aria-live="polite">Showing permits by <strong>{dimension.toLowerCase()}</strong>, split by permit type, using <strong>{basis} date</strong>.</div><div className="analytics-table-chart"><BreakdownTable dimension={dimension} rows={displayedRows} /><div className="analytics-chart-panel"><h3>Total permits by {dimension.toLowerCase()}</h3><Bars labels={displayedRows.map((row) => row.label)} values={totals} color="#7c3aed" ariaLabel={`Permit count by ${dimension.toLowerCase()}`} /></div></div></>;
}

function ReportCard({ number, title, text, children, wide = false }: { number: number; title: string; text: string; children: ReactNode; wide?: boolean }) {
  return <section className={`card analytics-report ${wide ? "wide" : ""}`}><header><span>D{number}</span><div><h2>{title}</h2><p>{text}</p></div></header>{children}</section>;
}

export default function AnalyticsPage() {
  const initiativeTotal = useMemo(() => initiativeCounts.reduce((total, row) => total + row.months.reduce((sum, count) => sum + count, 0), 0), []);
  const statusTypeTotals = permitTypes.map((_, typeIndex) => statusRows.reduce((total, row) => total + row.values[typeIndex], 0));
  const initiativeSiteTotals = initiativeCounts.map((row) => Number((row.months.reduce((sum, count) => sum + count, 0) * .4).toFixed(1)));
  return <div className="page analytics-page">
    <header className="page-header"><div><span className="eyebrow">Operational intelligence</span><h1>Analytics</h1><p>Permit volumes and paper savings, with the reporting date clearly defined for every dashboard.</p></div><button className="button ghost">⇩ Export report</button></header>
    <div className="analytics-grid">
      <ReportCard number={1} title="Monthly Approved Permit Count" text="Number of permits approved within each month." wide>
        <DateRangeFilters basis="approval" />
        <div className="analytics-chart-panel"><h3>Approved permits by month</h3><Bars labels={months} values={approvedMonthly} ariaLabel="Approved permit count by month" /></div>
      </ReportCard>

      <ReportCard number={2} title="Permit Submission Count by Type and Status" text="For each permit type, the number of permits in each status." wide>
        <DateRangeFilters basis="submission" />
        <div className="analytics-table-chart"><div className="analytics-table-wrap"><table className="analytics-table status-matrix"><thead><tr><th>Status</th>{permitTypes.map((type) => <th key={type}>{type}</th>)}<th>Total</th></tr></thead><tbody>{statusRows.map((row) => <tr key={row.label}><td><strong>{row.label}</strong></td>{row.values.map((value, index) => <td key={permitTypes[index]}>{value}</td>)}<td><b>{row.values.reduce((sum, value) => sum + value, 0)}</b></td></tr>)}</tbody></table></div><div className="analytics-chart-panel"><h3>Submissions by permit type</h3><Bars labels={permitTypes} values={statusTypeTotals} color="#0f9f8f" ariaLabel="Permit submissions by type" /></div></div>
      </ReportCard>

      <ReportCard number={3} title="Permit Count by Contractor" text="Permits submitted by each contractor — or permits approved, when approval date is selected."><DateBreakdown dimension="Contractor" rows={contractorRows} /></ReportCard>
      <ReportCard number={4} title="Permit Count by Discipline" text="Permits submitted under each discipline — or permits approved, when approval date is selected."><DateBreakdown dimension="Discipline" rows={disciplineRows} /></ReportCard>
      <ReportCard number={5} title="Permit Count by Level" text="Permits submitted for each level — or permits approved, when approval date is selected." wide><DateBreakdown dimension="Level" rows={levelRows} /></ReportCard>

      <ReportCard number={6} title="ePTW Initiatives" text="Paper saved in kg (1 permit = 400 g), by site and month for the selected year." wide>
        <YearFilters />
        <div className="initiative-layout"><div><div className="analytics-table-wrap"><table className="analytics-table initiative-table"><thead><tr><th>Site</th>{months.map((month) => <th key={month}>{month}</th>)}<th>Total kg</th></tr></thead><tbody>{initiativeCounts.map((row) => <tr key={row.site}><td><strong>{row.site}</strong></td>{row.months.map((count, index) => <td key={months[index]}>{(count * .4).toFixed(1)}</td>)}<td><b>{(row.months.reduce((sum, count) => sum + count, 0) * .4).toFixed(1)}</b></td></tr>)}</tbody></table></div><div className="analytics-chart-panel initiative-chart"><h3>Paper saved by site (kg)</h3><Bars labels={initiativeSites} values={initiativeSiteTotals} color="#26955b" ariaLabel="Paper saved in kilograms by site" /></div></div><aside className="initiative-impact"><div className="initiative-tree" aria-hidden="true">🌳</div><span>Paperless permit impact</span><strong>{initiativeTotal} permits</strong><b>{(initiativeTotal * .4).toFixed(1)} kg</b><small>estimated paper saved</small><p><strong>1 permit</strong> = 400 g paper</p></aside></div>
      </ReportCard>
    </div>
  </div>;
}
