import { useMemo, useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { Printer, Layers, Share2, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react'
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

type TabKey = 'BRANCH NOMINATIONS' | 'TOTAL IN ZONES' | 'VOTE DISTRIBUTION PER ZONE' | 'OVERALL SHARE' | 'PARETO GRAPH'

const TABS: TabKey[] = ['BRANCH NOMINATIONS', 'TOTAL IN ZONES', 'VOTE DISTRIBUTION PER ZONE', 'OVERALL SHARE', 'PARETO GRAPH']
const EXCEL_COLORS = [
  '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47',
  '#264478', '#9E480E', '#636363', '#997300', '#255E91', '#43682B'
]

const STACK_COLORS = [
  ...EXCEL_COLORS,
  ...Array.from({ length: 50 }, () => {
    const h = Math.floor(Math.random() * 360)
    const s = Math.floor(Math.random() * 30) + 60
    const l = Math.floor(Math.random() * 30) + 40
    return `hsl(${h}, ${s}%, ${l}%)`
  })
]

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

function renderPieNamePercentLabel({
  cx,
  cy,
  midAngle,
  outerRadius,
  percent,
  name,
}: {
  cx?: number
  cy?: number
  midAngle?: number
  outerRadius?: number
  percent?: number
  name?: string
}) {
  if (
    cx === undefined ||
    cy === undefined ||
    midAngle === undefined ||
    outerRadius === undefined ||
    percent === undefined ||
    percent < 0.05
  ) {
    return null
  }

  const RADIAN = Math.PI / 180
  const radius = outerRadius + 20
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <g>
      <text
        x={x}
        y={y - 6}
        fill="#1f242c"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={11}
        fontWeight={700}
      >
        {name}
      </text>
      <text
        x={x}
        y={y + 8}
        fill="#1f242c"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={10}
        fontWeight={600}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    </g>
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

function aggregateByZone(records: NominationRecord[]) {
  const totals = new Map<string, number>()
  for (const row of records) {
    totals.set(row.zoneName, (totals.get(row.zoneName) ?? 0) + row.voteCount)
  }
  return Array.from(totals.entries())
    .map(([zone, votes]) => ({ zone, votes }))
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

function aggregateByCandidateStack(records: NominationRecord[], stackBy: 'zone' | 'ward') {
  const grouped = new Map<string, Map<string, number>>()

  for (const row of records) {
    if (!grouped.has(row.candidateName)) {
      grouped.set(row.candidateName, new Map<string, number>())
    }
    const stackKey = stackBy === 'zone' ? row.zoneName : `Ward ${row.wardNumber}`
    const bucket = grouped.get(row.candidateName)
    if (bucket) {
      bucket.set(stackKey, (bucket.get(stackKey) ?? 0) + row.voteCount)
    }
  }

  const stackItems = Array.from(
    new Set(
      records.map((row) => (stackBy === 'zone' ? row.zoneName : `Ward ${row.wardNumber}`)),
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

  if (showRanking) {
    const COLUMN_SIZE = 6
    const leaderboardColumns: Array<Array<{ label: string; value: number }>> = []
    for (let index = 0; index < sortedData.length; index += COLUMN_SIZE) {
      leaderboardColumns.push(sortedData.slice(index, index + COLUMN_SIZE))
    }

    const scaleStep = Math.max(0, sortedData.length - 10)
    const dynamicFontRem = Math.max(0.72, 0.96 - scaleStep * 0.015)
    const leaderboardStyle = { '--leaderboard-font-size': `${dynamicFontRem}rem` } as CSSProperties

    return (
      <div className="leaderboard-columns" style={leaderboardStyle} aria-label={`${labelKey} ranked leaderboard`}>
        {leaderboardColumns.map((column, columnIndex) => (
          <ol key={`col-${columnIndex}`} className="leaderboard-column" start={columnIndex * COLUMN_SIZE + 1}>
            {column.map((entry, rowIndex) => {
              const globalRank = columnIndex * COLUMN_SIZE + rowIndex + 1
              const pct = total > 0 ? (entry.value / total) * 100 : 0
              return (
                <li key={entry.label}>
                  <span className="leaderboard-rank">{globalRank}.</span>
                  <span
                    className="legend-swatch"
                    style={{ backgroundColor: STACK_COLORS[(globalRank - 1) % STACK_COLORS.length] }}
                    aria-hidden="true"
                  />
                  <span className="leaderboard-name">{entry.label}</span>
                  <span className="leaderboard-value">{pct.toFixed(1)}% ({entry.value})</span>
                </li>
              )
            })}
          </ol>
        ))}
      </div>
    )
  }

  return (
    <ul className="pie-legend" aria-label={`${labelKey} distribution legend`}>
      {sortedData.map((entry, index) => {
        const pct = total > 0 ? (entry.value / total) * 100 : 0
        return (
          <li key={entry.label}>
            <span className="legend-swatch" style={{ backgroundColor: STACK_COLORS[index % STACK_COLORS.length] }} />
            <span className="legend-name">{entry.label}</span>
            <span className="legend-value">{pct.toFixed(1)}% ({entry.value})</span>
          </li>
        )
      })}
    </ul>
  )
}

function BranchNomiView({ records }: { records: NominationRecord[] }) {
  const [matrixDirection, setMatrixDirection] = useState<'ward-rows' | 'candidate-rows'>('ward-rows')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
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

  const candidateStackData = useMemo(() => {
    return candidates.map((candidate) => {
      const row: Record<string, number | string> = { candidateLabel: candidate }
      for (const { ward, candidateMap } of matrixRows) {
        row[`Ward ${ward}`] = candidateMap.get(candidate) ?? 0
      }
      return row
    })
  }, [matrixRows, candidates])

  const [chartDirection, setChartDirection] = useState<'ward-y' | 'candidate-y'>('ward-y')

  // Helper function for conditional cell formatting (binary votes)
  const getCellStyle = (value: number): CSSProperties => {
    if (value > 1) {
      // Red pastel for values > 1
      return { backgroundColor: '#FFB3B3', fontWeight: 600 }
    }
    if (value > 0) {
      // Pastel green for values > 0 and <= 1
      return { backgroundColor: '#B3E5B3', fontWeight: 600 }
    }
    // No formatting for 0
    return {}
  }

  // Heat-map color function for totals (light→medium→dark blue gradient with solid fills)
  const getHeatmapColor = (value: number, maxValue: number): CSSProperties => {
    if (value === 0) return { backgroundColor: '#fff' }
    
    const ratio = maxValue > 0 ? value / maxValue : 0
    let backgroundColor: string
    
    if (ratio < 0.33) {
      // Light blue range (0-33%) - solid
      const intensity = ratio / 0.33
      const lightness = Math.round(230 - intensity * 20)
      backgroundColor = `rgb(${lightness}, ${lightness + 10}, 255)`
    } else if (ratio < 0.67) {
      // Medium blue range (33-67%) - solid
      const intensity = (ratio - 0.33) / 0.34
      const shade = Math.round(180 - intensity * 50)
      backgroundColor = `rgb(${shade}, ${shade + 40}, 255)`
    } else {
      // Dark blue range (67-100%) - solid
      const intensity = (ratio - 0.67) / 0.33
      const shade = Math.round(120 - intensity * 60)
      backgroundColor = `rgb(${shade}, ${shade + 60}, 255)`
    }
    
    return { backgroundColor, fontWeight: 600, color: ratio > 0.65 ? '#fff' : '#000' }
  }

  // Calculate totals for each column and row
  const totalsRow = useMemo(() => {
    const totals = new Map<string, number>()
    if (matrixDirection === 'ward-rows') {
      // Ward-rows: sum each candidate across all wards
      for (const candidate of candidates) {
        let sum = 0
        for (const { candidateMap } of matrixRows) {
          sum += candidateMap.get(candidate) ?? 0
        }
        totals.set(candidate, sum)
      }
    } else {
      // Candidate-rows: sum each ward across all candidates
      for (const { ward, candidateMap } of matrixRows) {
        let sum = 0
        for (const candidate of candidates) {
          sum += candidateMap.get(candidate) ?? 0
        }
        totals.set(`Ward ${ward}`, sum)
      }
    }
    return totals
  }, [matrixDirection, matrixRows, candidates])

  // Calculate row totals for each row
  const rowTotals = useMemo(() => {
    const totals = new Map<string, number>()
    if (matrixDirection === 'ward-rows') {
      for (const { ward, candidateMap } of matrixRows) {
        let sum = 0
        for (const candidate of candidates) {
          sum += candidateMap.get(candidate) ?? 0
        }
        totals.set(`Ward ${ward}`, sum)
      }
    } else {
      for (const candidate of candidates) {
        let sum = 0
        for (const { candidateMap } of matrixRows) {
          sum += candidateMap.get(candidate) ?? 0
        }
        totals.set(candidate, sum)
      }
    }
    return totals
  }, [matrixDirection, matrixRows, candidates])

  // Get max values for heat-map scaling
  const maxColumnTotal = useMemo(
    () => Math.max(...Array.from(totalsRow.values())),
    [totalsRow]
  )
  const maxRowTotal = useMemo(
    () => Math.max(...Array.from(rowTotals.values())),
    [rowTotals]
  )

  // Sorted matrix rows with safe column sorting
  const sortedMatrixRows = useMemo(() => {
    let sorted = [...matrixRows]
    if (sortBy && sortBy !== 'label') {
      sorted.sort((a, b) => {
        let aVal: number, bVal: number
        if (sortBy === 'row-total') {
          const labelA = matrixDirection === 'ward-rows' ? `Ward ${a.ward}` : a.ward.toString()
          const labelB = matrixDirection === 'ward-rows' ? `Ward ${b.ward}` : b.ward.toString()
          aVal = rowTotals.get(labelA) ?? 0
          bVal = rowTotals.get(labelB) ?? 0
        } else {
          aVal = a.candidateMap.get(sortBy) ?? 0
          bVal = b.candidateMap.get(sortBy) ?? 0
        }
        return sortDir === 'desc' ? bVal - aVal : aVal - bVal
      })
    }
    return sorted
  }, [matrixRows, sortBy, sortDir, matrixDirection, rowTotals])

  // Sorted candidates with safe column sorting
  const sortedCandidates = useMemo(() => {
    let sorted = [...candidates]
    if (sortBy && sortBy !== 'label' && matrixDirection === 'candidate-rows') {
      sorted.sort((candidate) => {
        if (sortBy === 'row-total') {
          return sortDir === 'desc'
            ? (rowTotals.get(candidate) ?? 0)
            : -(rowTotals.get(candidate) ?? 0)
        }
        return 0
      })
    } else if (sortBy && sortBy !== 'label' && sortBy !== 'row-total' && matrixDirection === 'candidate-rows') {
      const wardNum = parseInt(sortBy.replace('Ward ', ''), 10)
      sorted.sort((a, b) => {
        const aVal = wardCandidateMap.get(wardNum)?.get(a) ?? 0
        const bVal = wardCandidateMap.get(wardNum)?.get(b) ?? 0
        return sortDir === 'desc' ? bVal - aVal : aVal - bVal
      })
    }
    return sorted
  }, [candidates, sortBy, sortDir, matrixDirection, rowTotals, wardCandidateMap])

  // Handler for sort button clicks
  const handleSort = (columnName: string) => {
    if (sortBy === columnName) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(columnName)
      setSortDir('desc')
    }
  }

  // Render sort indicator
  const SortIndicator = ({ column }: { column: string }) => {
    if (sortBy !== column) {
      return <ChevronsUpDown size={14} style={{ opacity: 0.3, marginLeft: '4px' }} />
    }
    return sortDir === 'desc' ? (
      <ArrowDown size={14} style={{ marginLeft: '4px' }} />
    ) : (
      <ArrowUp size={14} style={{ marginLeft: '4px' }} />
    )
  }

  // Sticky header and totals row styles
  const stickyHeaderStyle: CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    backgroundColor: '#fff',
    borderBottom: '2px solid #ddd',
  }

  const totalsRowStyle: CSSProperties = {
    backgroundColor: '#f5f5f5',
    fontWeight: 700,
    borderTop: '2px solid #ddd',
    borderBottom: '2px solid #ddd',
    textAlign: 'center',
  }

  const stickyFirstColStyle: CSSProperties = {
    position: 'sticky',
    left: 0,
    zIndex: 9,
    backgroundColor: '#fff',
  }

  const totalsColStyle: CSSProperties = {
    position: 'sticky',
    left: 80,
    zIndex: 9,
    backgroundColor: '#fff',
  }

  if (records.length === 0) {
    return <section className="panel"><p className="muted">No records available for BRANCH NOMINATIONS.</p></section>
  }

  return (
    <section className="sheet-grid single">
      <article className="panel" style={{ maxWidth: '100%', overflow: 'hidden' }}>
        <div className="sheet-controls">
          <h2>Branch Matrix (Votes by Ward and Candidate)</h2>
          <div className="toggle-row">
            <label>
              Matrix Layout
              <select
                value={matrixDirection}
                onChange={(event) => setMatrixDirection(event.target.value as 'ward-rows' | 'candidate-rows')}
              >
                <option value="ward-rows">Rows: Wards, Columns: Candidates</option>
                <option value="candidate-rows">Rows: Candidates, Columns: Wards</option>
              </select>
            </label>
          </div>
        </div>
        <div className="matrix-wrap" style={{ overflowX: 'auto', maxWidth: '100%' }}>
          <table className="matrix-table" style={{ minWidth: 'max-content' }}>
            <thead style={stickyHeaderStyle}>
              {matrixDirection === 'ward-rows' ? (
                <tr>
                  <th style={stickyFirstColStyle}>Ward</th>
                  <th style={{ ...totalsColStyle, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => handleSort('row-total')}>
                    Totals <SortIndicator column="row-total" />
                  </th>
                  {candidates.map((candidate) => (
                    <th key={candidate} onClick={() => handleSort(candidate)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      {candidate} <SortIndicator column={candidate} />
                    </th>
                  ))}
                </tr>
              ) : (
                <tr>
                  <th style={stickyFirstColStyle}>Candidate</th>
                  <th style={{ ...totalsColStyle, userSelect: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('row-total')}>
                    Totals <SortIndicator column="row-total" />
                  </th>
                  {sortedMatrixRows.map(({ ward }) => (
                    <th key={ward} onClick={() => handleSort(`Ward ${ward}`)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      Ward {ward} <SortIndicator column={`Ward ${ward}`} />
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {/* Totals row with heat-map */}
              <tr style={totalsRowStyle}>
                <td style={stickyFirstColStyle}>TOTALS</td>
                <td style={{ ...totalsColStyle, ...getHeatmapColor(Array.from(totalsRow.values()).reduce((a, b) => a + b, 0), maxColumnTotal * candidates.length) }}>
                  {Array.from(totalsRow.values()).reduce((a, b) => a + b, 0)}
                </td>
                {matrixDirection === 'ward-rows'
                  ? candidates.map((candidate) => {
                      const colTotal = totalsRow.get(candidate) ?? 0
                      return (
                        <td key={`total-${candidate}`} style={getHeatmapColor(colTotal, maxColumnTotal)}>
                          {colTotal}
                        </td>
                      )
                    })
                  : sortedMatrixRows.map(({ ward }) => {
                      const colTotal = totalsRow.get(`Ward ${ward}`) ?? 0
                      return (
                        <td key={`total-ward-${ward}`} style={getHeatmapColor(colTotal, maxColumnTotal)}>
                          {colTotal}
                        </td>
                      )
                    })}
              </tr>

              {/* Data rows */}
              {matrixDirection === 'ward-rows' ? (
                sortedMatrixRows.map(({ ward, candidateMap }) => {
                  const rowTotal = rowTotals.get(`Ward ${ward}`) ?? 0
                  return (
                    <tr key={ward}>
                      <td style={stickyFirstColStyle}>Ward {ward}</td>
                      <td style={{ ...totalsColStyle, ...getHeatmapColor(rowTotal, maxRowTotal) }}>
                        {rowTotal}
                      </td>
                      {candidates.map((candidate) => {
                        const value = candidateMap.get(candidate) ?? 0
                        return (
                          <td key={`${ward}-${candidate}`} style={getCellStyle(value)}>
                            {value}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              ) : (
                sortedCandidates.map((candidate) => {
                  const rowTotal = rowTotals.get(candidate) ?? 0
                  return (
                    <tr key={candidate}>
                      <td style={stickyFirstColStyle}>{candidate}</td>
                      <td style={{ ...totalsColStyle, ...getHeatmapColor(rowTotal, maxRowTotal) }}>
                        {rowTotal}
                      </td>
                      {sortedMatrixRows.map(({ ward, candidateMap }) => {
                        const value = candidateMap.get(candidate) ?? 0
                        return (
                          <td key={`${ward}-${candidate}`} style={getCellStyle(value)}>
                            {value}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel" style={{ maxWidth: '100%', overflow: 'hidden' }}>
        <div className="sheet-controls">
          <h2>Candidate Mix by Ward (Stacked)</h2>
          <div className="toggle-row">
            <label>
              Matrix Layout
              <select
                value={chartDirection}
                onChange={(event) => setChartDirection(event.target.value as 'ward-y' | 'candidate-y')}
              >
                <option value="ward-y">Y-Axis: Wards, Stack: Candidates</option>
                <option value="candidate-y">Y-Axis: Candidates, Stack: Wards</option>
              </select>
            </label>
          </div>
        </div>
        <div className="chart-surface tall" style={{ height: Math.max(400, (chartDirection === 'ward-y' ? wardStackData.length : candidateStackData.length) * 36) }}>
          <ResponsiveContainer width="100%" height="100%">
            {chartDirection === 'ward-y' ? (
              <BarChart data={wardStackData} layout="vertical" margin={{ top: 8, right: 30, bottom: 20, left: 20 }}>
                <XAxis type="number" tickMargin={10} />
                <YAxis dataKey="wardLabel" type="category" width={100} tickMargin={10} />
                <Tooltip />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                {candidates.map((candidate, index) => (
                  <Bar
                    key={candidate}
                    dataKey={candidate}
                    stackId="mix"
                    fill={STACK_COLORS[index % STACK_COLORS.length]}
                    radius={index === candidates.length - 1 ? [0, 6, 6, 0] : [0, 0, 0, 0]}
                  >
                    <LabelList dataKey={candidate} position="insideRight" formatter={formatBarLabel} fill="#ffffff" fontSize={11} />
                  </Bar>
                ))}
              </BarChart>
            ) : (
              <BarChart data={candidateStackData} layout="vertical" margin={{ top: 8, right: 30, bottom: 20, left: 20 }}>
                <XAxis type="number" tickMargin={10} />
                <YAxis dataKey="candidateLabel" type="category" width={180} tickMargin={10} />
                <Tooltip />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                {matrixRows.map(({ ward }, index) => (
                  <Bar
                    key={ward}
                    dataKey={`Ward ${ward}`}
                    stackId="mix"
                    fill={STACK_COLORS[index % STACK_COLORS.length]}
                    radius={index === matrixRows.length - 1 ? [0, 6, 6, 0] : [0, 0, 0, 0]}
                  >
                    <LabelList dataKey={`Ward ${ward}`} position="insideRight" formatter={formatBarLabel} fill="#ffffff" fontSize={11} />
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

function TotalInZonesView({ records }: { records: NominationRecord[] }) {
  const [stackBy, setStackBy] = useState<'zone' | 'ward'>('zone')
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal')

  const zoneTotals = useMemo(() => aggregateByZone(records), [records])
  const candidateTotals = useMemo(() => aggregateByCandidate(records), [records])
  const { data: stackData, stackItems } = useMemo(() => aggregateByCandidateStack(records, stackBy), [records, stackBy])

  if (records.length === 0) {
    return <section className="panel"><p className="muted">No records available for TOTAL IN ZONES.</p></section>
  }

  return (
    <section className="sheet-grid single">
      <div className="sheet-grid two-up">
        {/* votes per zone */}
        <article className="panel" style={{ maxWidth: '100%', overflow: 'hidden' }}>
          <h2>Votes per Zone</h2>
          <div className="chart-surface" style={{ height: Math.max(400, zoneTotals.length * 32) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneTotals} layout="vertical" margin={{ top: 8, right: 30, bottom: 20, left: 20 }}>
                <XAxis type="number" tickMargin={10} />
                <YAxis dataKey="zone" type="category" width={180} tickMargin={10} />
                <Tooltip formatter={(value) => [`${value} votes`, 'Votes']} />
                <Bar dataKey="votes" fill="#00a651" radius={[0, 6, 6, 0]}>
                  <LabelList dataKey="votes" position="right" formatter={formatBarLabel} fill="#1f242c" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-surface" style={{ height: 350, marginTop: '24px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={zoneTotals}
                  dataKey="votes"
                  nameKey="zone"
                  outerRadius={110}
                  innerRadius={50}
                  labelLine={false}
                  label={renderPiePercentLabel}
                >
                  {zoneTotals.map((entry, index) => (
                    <Cell key={entry.zone} fill={STACK_COLORS[index % STACK_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} votes`, 'Votes']} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* votes per candidate */}
        <article className="panel" style={{ maxWidth: '100%', overflow: 'hidden' }}>
          <h2>Votes per Candidate</h2>
          <div className="chart-surface" style={{ height: Math.max(400, candidateTotals.length * 32) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={candidateTotals} layout="vertical" margin={{ top: 8, right: 30, bottom: 20, left: 20 }}>
                <XAxis type="number" tickMargin={10} />
                <YAxis dataKey="candidate" type="category" width={180} tickMargin={10} />
                <Tooltip formatter={(value) => [`${value} votes`, 'Votes']} />
                <Bar dataKey="votes" fill="#0c0f12" radius={[0, 6, 6, 0]}>
                  <LabelList dataKey="votes" position="right" formatter={formatBarLabel} fill="#1f242c" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <article className="panel" style={{ maxWidth: '100%', overflow: 'hidden' }}>
        <div className="sheet-controls">
          <h2>All {stackBy === 'zone' ? 'Zones' : 'Wards'} per Candidate (Stacked Votes)</h2>
          <div className="toggle-row">
            <label>
              Stack by
              <select value={stackBy} onChange={(event) => setStackBy(event.target.value as 'zone' | 'ward')}>
                <option value="zone">Zone</option>
                <option value="ward">Ward</option>
              </select>
            </label>
            <label>
              Orientation
              <select
                value={orientation}
                onChange={(event) => setOrientation(event.target.value as 'horizontal' | 'vertical')}
              >
                <option value="horizontal">Horizontal Bars (Candidate on Y)</option>
                <option value="vertical">Vertical Bars (Candidate on X)</option>
              </select>
            </label>
          </div>
        </div>

        <div className="chart-surface wide" style={orientation === 'horizontal' ? { height: Math.max(500, stackData.length * 36) } : undefined}>
          <ResponsiveContainer width="100%" height="100%">
            {orientation === 'vertical' ? (
              <BarChart data={stackData} margin={{ top: 8, right: 16, bottom: 20, left: 16 }}>
                <XAxis dataKey="candidate" interval={0} angle={-45} textAnchor="end" height={120} tickMargin={10} />
                <YAxis tickMargin={10} />
                <Tooltip formatter={(value) => [`${value} votes`, 'Votes']} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                {stackItems.map((item, index) => (
                  <Bar key={item} dataKey={item} stackId="candidateStack" fill={STACK_COLORS[index % STACK_COLORS.length]}>
                    <LabelList dataKey={item} position="insideTop" formatter={formatBarLabel} fill="#ffffff" fontSize={10} />
                  </Bar>
                ))}
              </BarChart>
            ) : (
              <BarChart data={stackData} layout="vertical" margin={{ top: 8, right: 30, bottom: 20, left: 20 }}>
                <XAxis type="number" tickMargin={10} />
                <YAxis dataKey="candidate" type="category" width={180} tickMargin={10} />
                <Tooltip formatter={(value) => [`${value} votes`, 'Votes']} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
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
    return <section className="panel"><p className="muted">No zones available.</p></section>
  }

  return (
    <section className="sheet-grid two-up">
      <article className="panel" style={{ maxWidth: '100%', overflow: 'hidden' }}>
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
        <div className="top-candidates-container">
          <DistributionLegend data={pieData} labelKey="candidate" showRanking />
        </div>
      </article>
    </section>
  )
}

function OveralPieView({ records }: { records: NominationRecord[] }) {
  const candidateTotals = useMemo(() => aggregateByCandidate(records), [records])
  const pieData = candidateTotals.map((row) => ({ label: row.candidate, value: row.votes }))
  const totalVotes = pieData.reduce((sum, row) => sum + row.value, 0)
  
  // Get top 6 candidates with zone and ward info
  const top6CandidatesWithLocation = useMemo(() => {
    return candidateTotals.slice(0, 6).map((candidate) => {
      // Find first record for this candidate to get zone and ward
      const candidateRecord = records.find((r) => r.candidateName === candidate.candidate)
      return {
        ...candidate,
        zone: candidateRecord?.zoneName ?? 'N/A',
        ward: candidateRecord?.wardNumber ?? 'N/A',
      }
    })
  }, [candidateTotals, records])

  return (
    <section className="sheet-grid two-up">
      <article className="panel" style={{ maxWidth: '100%', overflow: 'hidden' }}>
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
                label={renderPieNamePercentLabel}
              >
                {pieData.map((entry, index) => (
                  <Cell key={entry.label} fill={STACK_COLORS[index % STACK_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} votes`, 'Votes']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Top 6 Candidates Grid */}
        <div className="top-candidates-container">
          <h3 style={{ margin: '16px 0 12px 0', fontSize: '1rem', fontWeight: 600 }}>Top 6 Candidates</h3>
          <ol className="top-candidates-list">
            {top6CandidatesWithLocation.map((candidate, idx) => {
              const pct = totalVotes > 0 ? (candidate.votes / totalVotes) * 100 : 0
              return (
                <li key={candidate.candidate} className="top-candidate-item">
                  <div className="candidate-card" data-rank={idx + 1}>
                    <div className="candidate-rank-badge">{idx + 1}</div>
                    <div className="candidate-main">
                      <span className="candidate-name">{candidate.candidate}</span>
                      <span className="candidate-votes">{candidate.votes} votes ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="candidate-meta">
                      <span className="zone-ward-label">Zone {candidate.zone} • Ward {candidate.ward}</span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
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
        </div>
        <hr />
        <DistributionLegend data={pieData} labelKey="candidate" showRanking />
      </article>
    </section>
  )
}

function ParetoChartCard({
  title,
  data,
}: {
  title: string
  data: Array<{ label: string; votes: number; cumulativeSharePct: number }>
}) {
  return (
    <div className="pareto-card">
      <h2>{title}</h2>
      <div className="chart-surface wide">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 30, bottom: 20, left: 24 }}>
            <XAxis dataKey="label" interval={0} angle={-45} textAnchor="end" height={120} tickMargin={10} />
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
    </div>
  )
}

function ParetoIndicatorsCard({
  title,
  leadingVotes,
  leadingCount,
  totalVotes,
}: {
  title: string
  leadingVotes: number
  leadingCount: number
  totalVotes: number
}) {
  const othersVotes = totalVotes - leadingVotes
  const topLabel = `Top ${leadingCount}`

  return (
    <article className="panel">
      <h2>{title}</h2>
      <div className="kpi-grid">
        <div>
          <p>{topLabel} Votes</p>
          <strong>{leadingVotes}</strong>
        </div>
        <div>
          <p>{topLabel} Share</p>
          <strong>{totalVotes > 0 ? ((leadingVotes / totalVotes) * 100).toFixed(1) : '0.0'}%</strong>
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
  )
}

function OveralGraphView({ records }: { records: NominationRecord[] }) {
  const candidateTotals = useMemo(() => aggregateByCandidate(records), [records])
  const zoneTotals = useMemo(() => aggregateByZone(records), [records])

  const paretoDataZone = useMemo(() => {
    const total = zoneTotals.reduce((sum, row) => sum + row.votes, 0)
    let running = 0
    return zoneTotals.map((row) => {
      running += row.votes
      return {
        label: row.zone,
        votes: row.votes,
        cumulativeSharePct: total > 0 ? (running / total) * 100 : 0,
      }
    })
  }, [zoneTotals])

  const paretoDataCandidate = useMemo(() => {
    const total = candidateTotals.reduce((sum, row) => sum + row.votes, 0)
    let running = 0
    return candidateTotals.map((row) => {
      running += row.votes
      return {
        label: row.candidate,
        votes: row.votes,
        cumulativeSharePct: total > 0 ? (running / total) * 100 : 0,
      }
    })
  }, [candidateTotals])

  const totalVotes = candidateTotals.reduce((sum, row) => sum + row.votes, 0)
  const paretoCutoffPct = 80

  const leadingIndexZone = paretoDataZone.findIndex((row) => row.cumulativeSharePct >= paretoCutoffPct)
  const leadingCountZone = leadingIndexZone >= 0 ? leadingIndexZone + 1 : zoneTotals.length
  const leadingVotesZone = zoneTotals.slice(0, leadingCountZone).reduce((sum, row) => sum + row.votes, 0)

  const leadingIndexCandidate = paretoDataCandidate.findIndex((row) => row.cumulativeSharePct >= paretoCutoffPct)
  const leadingCountCandidate = leadingIndexCandidate >= 0 ? leadingIndexCandidate + 1 : candidateTotals.length
  const leadingVotesCandidate = candidateTotals.slice(0, leadingCountCandidate).reduce((sum, row) => sum + row.votes, 0)

  return (
    <section className="sheet-grid single">
      <article className="panel" style={{ maxWidth: '100%', overflow: 'hidden' }}>
        <ParetoChartCard title="Zone Pareto (X-Axis: Zones)" data={paretoDataZone} />
      </article>
      <ParetoIndicatorsCard
        title={`Zone Indicators (Top ${leadingCountZone} reaches ${paretoCutoffPct}%)`}
        leadingVotes={leadingVotesZone}
        leadingCount={leadingCountZone}
        totalVotes={totalVotes}
      />

      <article className="panel" style={{ maxWidth: '100%', overflow: 'hidden' }}>
        <ParetoChartCard title="Candidate Pareto (X-Axis: Candidates)" data={paretoDataCandidate} />
      </article>
      <ParetoIndicatorsCard
        title={`Candidate Indicators (Top ${leadingCountCandidate} reaches ${paretoCutoffPct}%)`}
        leadingVotes={leadingVotesCandidate}
        leadingCount={leadingCountCandidate}
        totalVotes={totalVotes}
      />
    </section>
  )
}

export function WorkbookViews({ records, zones }: WorkbookViewsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    try {
      const saved = localStorage.getItem('dashboardActiveTab')
      if (saved && TABS.includes(saved as TabKey)) {
        return saved as TabKey
      }
    } catch (e) {
      // ignore localStorage errors (e.g., in private browsing)
    }
    return 'BRANCH NOMINATIONS'
  })
  
  const [isPrintingAll, setIsPrintingAll] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem('dashboardActiveTab', activeTab)
    } catch (e) {
      // ignore
    }
  }, [activeTab])

  const handlePrintAll = () => {
    setIsPrintingAll(true)
    setTimeout(() => {
      window.print()
      // Optional: automatically revert after printing.
      // Usually it's better to rely on onafterprint, but setTimeout is a fallback.
    }, 500)
  }

  useEffect(() => {
    const handleAfterPrint = () => {
      setIsPrintingAll(false)
    }
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [])

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Ekurhuleni Nominations Dashboard',
          url: window.location.href,
        })
      } else {
        await navigator.clipboard.writeText(window.location.href)
        alert('Link copied to clipboard!')
      }
    } catch (err) {
      console.error('Error sharing:', err)
    }
  }

  return (
    <section>
      <nav 
        className="sheet-tabs" 
        aria-label="Workbook pages" 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', margin: '24px 0', paddingRight: '8px' }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
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
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            type="button" 
            className="sheet-tab" 
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => window.print()} 
            title="Print Current Tab"
          >
            <Printer size={16} /> Print
          </button>
          <button 
            type="button" 
            className="sheet-tab" 
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={handlePrintAll} 
            title="Print All Tabs"
          >
            <Layers size={16} /> Print All
          </button>
          <button 
            type="button" 
            className="sheet-tab" 
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={handleShare} 
            title="Share Dashboard"
          >
            <Share2 size={16} /> Share
          </button>
        </div>
      </nav>

      {(isPrintingAll || activeTab === 'BRANCH NOMINATIONS') && <BranchNomiView records={records} />}
      {(isPrintingAll || activeTab === 'TOTAL IN ZONES') && <TotalInZonesView records={records} />}
      {(isPrintingAll || activeTab === 'VOTE DISTRIBUTION PER ZONE') && <PiePerZoneView records={records} zones={zones} />}
      {(isPrintingAll || activeTab === 'OVERALL SHARE') && <OveralPieView records={records} />}
      {(isPrintingAll || activeTab === 'PARETO GRAPH') && <OveralGraphView records={records} />}
    </section>
  )
}
