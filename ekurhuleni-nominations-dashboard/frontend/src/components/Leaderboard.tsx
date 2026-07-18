import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type LeaderboardRow = {
  name: string
  totalVotes: number
}

type LeaderboardProps = {
  data: LeaderboardRow[]
}

const EXCEL_COLORS = [
  '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47',
  '#264478', '#9E480E', '#636363', '#997300', '#255E91', '#43682B'
]

const piePalette = [
  ...EXCEL_COLORS,
  ...Array.from({ length: 50 }, () => {
    const h = Math.floor(Math.random() * 360)
    const s = Math.floor(Math.random() * 30) + 60
    const l = Math.floor(Math.random() * 30) + 40
    return `hsl(${h}, ${s}%, ${l}%)`
  })
]

export function Leaderboard({ data }: LeaderboardProps) {
  const totalVotes = data.reduce((sum, row) => sum + row.totalVotes, 0)

  const pieData = data.map((row) => ({
    ...row,
    percentage: totalVotes > 0 ? (row.totalVotes / totalVotes) * 100 : 0,
  }))

  function renderPieLabel({
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
    const radius = outerRadius + 22
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

  return (
    <div className="panel chart-panel">
      <h2>Candidate Leaderboard</h2>
      {data.length === 0 ? (
        <p className="muted">No votes in the selected filters.</p>
      ) : (
        <div className="chart-stack">
          <div className="pie-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="totalVotes"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={86}
                  innerRadius={38}
                  paddingAngle={2}
                  labelLine={false}
                  label={renderPieLabel}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={piePalette[index % piePalette.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} votes`, 'Total']} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="pie-legend" aria-label="Candidate vote distribution legend">
            {pieData.map((entry, index) => (
              <li key={entry.name}>
                <span
                  className="legend-swatch"
                  style={{ backgroundColor: piePalette[index % piePalette.length] }}
                  aria-hidden="true"
                />
                <span className="legend-name">{entry.name}</span>
                <span className="legend-value">{entry.percentage.toFixed(1)}%</span>
              </li>
            ))}
          </ul>

          <div className="bar-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                <XAxis type="number" tick={{ fill: '#323943' }} axisLine={{ stroke: '#15191f' }} />
                <YAxis dataKey="name" type="category" width={160} tick={{ fill: '#1f242c' }} />
                <Tooltip formatter={(value) => [`${value} votes`, 'Total']} />
                <Bar dataKey="totalVotes" fill="#00a651" radius={[0, 6, 6, 0]}>
                  <LabelList dataKey="totalVotes" position="right" fill="#1f242c" fontSize={12} fontWeight={700} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
