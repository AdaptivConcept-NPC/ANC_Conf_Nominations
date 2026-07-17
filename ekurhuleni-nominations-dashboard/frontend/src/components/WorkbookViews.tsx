import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { NominationRecord, ZoneOption } from '../lib/dashboardData'

type WorkbookViewsProps = {
  records: NominationRecord[]
  zones: ZoneOption[]
}

type TabKey = 'BRANCH NOMINATIONS' | 'TOTAL IN ZONES' | 'VOTE DISTRIBUTION PER ZONE' | 'OVERAL SHARE' | 'PARETO GRAPH'

const TABS: TabKey[] = ['BRANCH NOMINATIONS', 'TOTAL IN ZONES', 'VOTE DISTRIBUTION PER ZONE', 'OVERAL SHARE', 'PARETO GRAPH']
const STACK_COLORS = ['#00a651', '#f7cd12', '#0c0f12', '#1f7d4b', '#d2ad10', '#3a3f46', '#0f8e4b', '#5d9f4f']

function formatBarLabel(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return ''
  }
  return `${numeric}`
}

function renderPiePercentLabel({
  cx,
  cy,
  midAngle,
  outerRadius,
  percent,
}: {
  cx?: number
  cy?: number
  midAngle?: number
  outerRadius?: number
  percent?: number
}) {
  if (
    cx === undefined ||
    cy === undefined ||
    midAngle === undefined ||
    outerRadius === undefined ||
    percent === undefined ||
    percent < 0.04
  ) {
    return null
  }

  const RADIAN = Math.PI / 180
  const radius = outerRadius + 18
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="#1f242c"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={12}
      fontWeight={700}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

function aggregateByCandidate(records: NominationRecord[]) {
  const totals = new Map<string, number>()
  for (const row of records) {
    totals.set(row.candidateName, (totals.get(row.candidateName) ?? 0) + row.voteCount)
  }
  return Array.from(totals.entries())
    .map(([candidate, votes]) => ({ candidate, votes }))
    .sort((a, b) => b.votes - a.votes)
}

function aggregateByRegion(records: NominationRecord[]) {
  const totals = new Map<string, number>()
  for (const row of records) {
    totals.set(row.zoneName, (totals.get(row.zoneName) ?? 0) + row.voteCount)
  }
  return Array.from(totals.entries())
    .map(([region, votes]) => ({ region, votes }))
    .sort((a, b) => b.votes - a.votes)
}

function aggregateByWardCandidate(records: NominationRecord[]) {
  const rows = new Map<number, Map<string, number>>()
  for (const row of records) {
    if (!rows.has(row.wardNumber)) {
      rows.set(row.wardNumber, new Map<string, number>())
    }
    const candidateMap = rows.get(row.wardNumber)
    if (candidateMap) {
      candidateMap.set(row.candidateName, (candidateMap.get(row.candidateName) ?? 0) + row.voteCount)
    }
  }
  return rows
}

function aggregateByCandidateStack(records: NominationRecord[], stackBy: 'region' | 'ward') {
  const grouped = new Map<string, Map<string, number>>()

  for (const row of records) {
    if (!grouped.has(row.candidateName)) {
      grouped.set(row.candidateName, new Map<string, number>())
    }
    const stackKey = stackBy === 'region' ? row.zoneName : `Ward ${row.wardNumber}`
    const bucket = grouped.get(row.candidateName)
    if (bucket) {
      bucket.set(stackKey, (bucket.get(stackKey) ?? 0) + row.voteCount)
    }
  }

  const stackItems = Array.from(
    new Set(
      records.map((row) => (stackBy === 'region' ? row.zoneName : `Ward ${row.wardNumber}`)),
    ),
  )

  const data = Array.from(grouped.entries())
    .map(([candidate, stackMap]) => {
      const result: Record<string, number | string> = { candidate }
      for (const item of stackItems) {
        result[item] = stackMap.get(item) ?? 0
      }
      result.totalVotes = Array.from(stackMap.values()).reduce((sum, value) => sum + value, 0)
      return result
    })
    .sort((a, b) => Number(b.totalVotes) - Number(a.totalVotes))

  return { data, stackItems }
}

function DistributionLegend({
  data,
  labelKey,
  showRanking = false,
}: {
  data: Array<{ label: string; value: number }>
  labelKey: string
  showRanking?: boolean
}) {
  const sortedData = [...data].sort((a, b) => b.value - a.value)
  const total = data.reduce((sum, row) => sum + row.value, 0)

  return (
    <ul className="pie-legend" aria-label={`${labelKey} distribution legend`}>
      {sortedData.map((entry, index) => {
        const pct = total > 0 ? (entry.value / total) * 100 : 0
        return (
          <li key={entry.label}>
            <span className="legend-swatch" style={{ backgroundColor: STACK_COLORS[index % STACK_COLORS.length] }} />
            <span className="legend-name">{showRanking ? `${index + 1}. ${entry.label}` : entry.label}</span>
            <span className="legend-value">{pct.toFixed(1)}% ({entry.value})</span>
          </li>
        )
      })}
    </ul>
  )
}

function BranchNomiView({ records }: { records: NominationRecord[] }) {
  const candidateTotals = useMemo(() => aggregateByCandidate(records), [records])
  const candidates = candidateTotals.map((row) => row.candidate)
  const wardCandidateMap = useMemo(() => aggregateByWardCandidate(records), [records])

  const matrixRows = useMemo(() => {
    return Array.from(wardCandidateMap.entries())
      .map(([ward, candidateMap]) => ({ ward, candidateMap }))
      .sort((a, b) => a.ward - b.ward)
  }, [wardCandidateMap])

  const wardStackData = useMemo(() => {
    return matrixRows.map(({ ward, candidateMap }) => {
      const row: Record<string, number | string> = { wardLabel: `Ward ${ward}` }
      for (const candidate of candidates) {
        row[candidate] = candidateMap.get(candidate) ?? 0
      }
      return row
    })
  }, [matrixRows, candidates])

  if (records.length === 0) {
    return <section className="panel"><p className="muted">No records available for BRANCH NOMINATIONS.</p></section>
  }

  return (
    <section className="sheet-grid single">
      <article className="panel">
        <h2>Branch Matrix (Votes by Ward and Candidate)</h2>
        <div className="matrix-wrap">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>Ward</th>
                {candidates.map((candidate) => (
                  <th key={candidate}>{candidate}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixRows.map(({ ward, candidateMap }) => (
                <tr key={ward}>
                  <td>Ward {ward}</td>
                  {candidates.map((candidate) => (
                    <td key={`${ward}-${candidate}`}>{candidateMap.get(candidate) ?? 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel">
        <h2>Candidate Mix by Ward (Stacked)</h2>
        <div className="chart-surface tall">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={wardStackData} layout="vertical" margin={{ top: 8, right: 18, bottom: 8, left: 10 }}>
              <XAxis type="number" />
              <YAxis dataKey="wardLabel" type="category" width={90} />
              <Tooltip />
              <Legend />
              {candidates.map((candidate, index) => (
                <Bar
                  key={candidate}
                  dataKey={candidate}
                  stackId="wardMix"
                  fill={STACK_COLORS[index % STACK_COLORS.length]}
                  radius={index === candidates.length - 1 ? [0, 6, 6, 0] : [0, 0, 0, 0]}
                >
                  <LabelList dataKey={candidate} position="insideRight" formatter={formatBarLabel} fill="#ffffff" fontSize={11} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  )
}

function TotalInZonesView({ records }: { records: NominationRecord[] }) {
  const [stackBy, setStackBy] = useState<'region' | 'ward'>('region')
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('vertical')

  const regionTotals = useMemo(() => aggregateByRegion(records), [records])
  const candidateTotals = useMemo(() => aggregateByCandidate(records), [records])
  const { data: stackData, stackItems } = useMemo(() => aggregateByCandidateStack(records, stackBy), [records, stackBy])

  if (records.length === 0) {
    return <section className="panel"><p className="muted">No records available for TOTAL IN ZONES.</p></section>
  }

  return (
    <section className="sheet-grid single">
      <div className="sheet-grid two-up">
        <article className="panel">
          <h2>Votes per Region</h2>
          <div className="chart-surface">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionTotals} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <XAxis dataKey="region" interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis />
                <Tooltip formatter={(value) => [`${value} votes`, 'Votes']} />
                <Bar dataKey="votes" fill="#00a651" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="votes" position="top" formatter={formatBarLabel} fill="#1f242c" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel">
          <h2>Votes per Candidate</h2>
          <div className="chart-surface">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={candidateTotals} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <XAxis type="number" />
                <YAxis dataKey="candidate" type="category" width={140} />
                <Tooltip formatter={(value) => [`${value} votes`, 'Votes']} />
                <Bar dataKey="votes" fill="#0c0f12" radius={[0, 6, 6, 0]}>
                  <LabelList dataKey="votes" position="right" formatter={formatBarLabel} fill="#1f242c" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <article className="panel">
        <div className="sheet-controls">
          <h2>All {stackBy === 'region' ? 'Regions' : 'Wards'} per Candidate (Stacked Votes)</h2>
          <div className="toggle-row">
            <label>
              Stack by
              <select value={stackBy} onChange={(event) => setStackBy(event.target.value as 'region' | 'ward')}>
                <option value="region">Region</option>
                <option value="ward">Ward</option>
              </select>
            </label>
            <label>
              Orientation
              <select
                value={orientation}
                onChange={(event) => setOrientation(event.target.value as 'horizontal' | 'vertical')}
              >
                <option value="vertical">Vertical (Candidate on X)</option>
                <option value="horizontal">Horizontal (Candidate on Y)</option>
              </select>
            </label>
          </div>
        </div>

        <div className="chart-surface wide">
          <ResponsiveContainer width="100%" height="100%">
            {orientation === 'vertical' ? (
              <BarChart data={stackData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <XAxis dataKey="candidate" interval={0} angle={-20} textAnchor="end" height={74} />
                <YAxis />
                <Tooltip formatter={(value) => [`${value} votes`, 'Votes']} />
                <Legend />
                {stackItems.map((item, index) => (
                  <Bar key={item} dataKey={item} stackId="candidateStack" fill={STACK_COLORS[index % STACK_COLORS.length]}>
                    <LabelList dataKey={item} position="insideTop" formatter={formatBarLabel} fill="#ffffff" fontSize={10} />
                  </Bar>
                ))}
              </BarChart>
            ) : (
              <BarChart data={stackData} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <XAxis type="number" />
                <YAxis dataKey="candidate" type="category" width={150} />
                <Tooltip formatter={(value) => [`${value} votes`, 'Votes']} />
                <Legend />
                {stackItems.map((item, index) => (
                  <Bar key={item} dataKey={item} stackId="candidateStack" fill={STACK_COLORS[index % STACK_COLORS.length]}>
                    <LabelList dataKey={item} position="insideRight" formatter={formatBarLabel} fill="#ffffff" fontSize={10} />
                  </Bar>
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  )
}

function PiePerZoneView({ records, zones }: { records: NominationRecord[]; zones: ZoneOption[] }) {
  const zoneNames = zones.map((zone) => zone.name)
  const [zoneIndex, setZoneIndex] = useState(0)

  const activeZone = zoneNames[zoneIndex] ?? zoneNames[0]

  const zoneRecords = useMemo(() => records.filter((record) => record.zoneName === activeZone), [records, activeZone])
  const candidateTotals = useMemo(() => aggregateByCandidate(zoneRecords), [zoneRecords])

  const pieData = candidateTotals.map((row) => ({ label: row.candidate, value: row.votes }))

  if (!activeZone) {
    return <section className="panel"><p className="muted">No regions available.</p></section>
  }

  return (
    <section className="sheet-grid two-up">
      <article className="panel">
        <div className="sheet-controls">
          <h2>Candidate Distribution in Zone: {activeZone}</h2>
          <div className="pager-row">
            <button type="button" onClick={() => setZoneIndex((i) => Math.max(0, i - 1))} disabled={zoneIndex === 0}>
              Prev
            </button>
            <span>{activeZone}</span>
            <button
              type="button"
              onClick={() => setZoneIndex((i) => Math.min(zoneNames.length - 1, i + 1))}
              disabled={zoneIndex >= zoneNames.length - 1}
            >
              Next
            </button>
          </div>
        </div>

        <div className="chart-surface">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="label"
                outerRadius={86}
                innerRadius={42}
                labelLine={false}
                label={renderPiePercentLabel}
              >
                {pieData.map((entry, index) => (
                  <Cell key={entry.label} fill={STACK_COLORS[index % STACK_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} votes`, 'Votes']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel">
        <h2>Candidate Leaderboard in Zone: ({activeZone})</h2>
        <DistributionLegend data={pieData} labelKey="candidate" showRanking />
      </article>
    </section>
  )
}

function OveralPieView({ records }: { records: NominationRecord[] }) {
  const candidateTotals = useMemo(() => aggregateByCandidate(records), [records])
  const pieData = candidateTotals.map((row) => ({ label: row.candidate, value: row.votes }))
  const totalVotes = pieData.reduce((sum, row) => sum + row.value, 0)
  const topCandidate = candidateTotals[0]

  return (
    <section className="sheet-grid two-up">
      <article className="panel">
        <h2>Overall Candidate Share</h2>
        <div className="chart-surface">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="label"
                outerRadius={96}
                innerRadius={44}
                labelLine={false}
                label={renderPiePercentLabel}
              >
                {pieData.map((entry, index) => (
                  <Cell key={entry.label} fill={STACK_COLORS[index % STACK_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} votes`, 'Votes']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel">
        <h2>Executive KPI</h2>
        <div className="kpi-grid">
          <div>
            <p>Total Votes</p>
            <strong>{totalVotes}</strong>
          </div>
          <div>
            <p>Total Candidates</p>
            <strong>{candidateTotals.length}</strong>
          </div>
          <div>
            <p>Top Candidate</p>
            <strong>{topCandidate?.candidate ?? '-'}</strong>
          </div>
          <div>
            <p>Top Candidate Share</p>
            <strong>{topCandidate ? ((topCandidate.votes / totalVotes) * 100).toFixed(1) : '0.0'}%</strong>
          </div>
        </div>
        <hr />
        <DistributionLegend data={pieData} labelKey="candidate" />
      </article>
    </section>
  )
}

function OveralGraphView({ records }: { records: NominationRecord[] }) {
  const candidateTotals = useMemo(() => aggregateByCandidate(records), [records])

  const paretoData = useMemo(() => {
    const total = candidateTotals.reduce((sum, row) => sum + row.votes, 0)
    let running = 0
    return candidateTotals.map((row) => {
      running += row.votes
      return {
        candidate: row.candidate,
        votes: row.votes,
        cumulativeSharePct: total > 0 ? (running / total) * 100 : 0,
      }
    })
  }, [candidateTotals])

  const topFiveVotes = candidateTotals.slice(0, 5).reduce((sum, row) => sum + row.votes, 0)
  const totalVotes = candidateTotals.reduce((sum, row) => sum + row.votes, 0)
  const othersVotes = totalVotes - topFiveVotes

  return (
    <section className="sheet-grid single">
      <article className="panel">
        <h2>Overall Votes and Concentration (Pareto)</h2>
        <div className="chart-surface wide">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={paretoData} margin={{ top: 8, right: 30, bottom: 8, left: 24 }}>
              <XAxis dataKey="candidate" interval={0} angle={-18} textAnchor="end" height={74} />
              <YAxis
                yAxisId="votes"
                label={{ value: 'Votes', angle: -90, position: 'insideLeft', offset: 2, fill: '#1f242c' }}
              />
              <YAxis
                yAxisId="pct"
                orientation="right"
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
                label={{
                  value: 'Cumulative Share (%)',
                  angle: 90,
                  position: 'right',
                  dx: 12,
                  textAnchor: 'middle',
                  fill: '#1f242c',
                }}
              />
              <Tooltip />
              <Legend />
              <Bar yAxisId="votes" dataKey="votes" name="Votes" fill="#00a651" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="votes" position="top" formatter={formatBarLabel} fill="#1f242c" fontSize={11} />
              </Bar>
              <Line yAxisId="pct" dataKey="cumulativeSharePct" name="Cumulative Share %" stroke="#0c0f12" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel">
        <h2>Top-5 Concentration</h2>
        <div className="kpi-grid">
          <div>
            <p>Top 5 Votes</p>
            <strong>{topFiveVotes}</strong>
          </div>
          <div>
            <p>Top 5 Share</p>
            <strong>{totalVotes > 0 ? ((topFiveVotes / totalVotes) * 100).toFixed(1) : '0.0'}%</strong>
          </div>
          <div>
            <p>Others Votes</p>
            <strong>{othersVotes}</strong>
          </div>
          <div>
            <p>Others Share</p>
            <strong>{totalVotes > 0 ? ((othersVotes / totalVotes) * 100).toFixed(1) : '0.0'}%</strong>
          </div>
        </div>
      </article>
    </section>
  )
}

export function WorkbookViews({ records, zones }: WorkbookViewsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('TOTAL IN ZONES')

  return (
    <section>
      <nav className="sheet-tabs" aria-label="Workbook pages">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={tab === activeTab ? 'sheet-tab active' : 'sheet-tab'}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === 'BRANCH NOMINATIONS' && <BranchNomiView records={records} />}
      {activeTab === 'TOTAL IN ZONES' && <TotalInZonesView records={records} />}
      {activeTab === 'VOTE DISTRIBUTION PER ZONE' && <PiePerZoneView records={records} zones={zones} />}
      {activeTab === 'OVERAL SHARE' && <OveralPieView records={records} />}
      {activeTab === 'PARETO GRAPH' && <OveralGraphView records={records} />}
    </section>
  )
}
