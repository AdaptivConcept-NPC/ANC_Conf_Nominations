import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type LeaderboardRow = {
  name: string
  totalVotes: number
}

type LeaderboardProps = {
  data: LeaderboardRow[]
}

export function Leaderboard({ data }: LeaderboardProps) {
  return (
    <div className="panel chart-panel">
      <h2>Candidate Leaderboard</h2>
      {data.length === 0 ? (
        <p className="muted">No votes in the selected filters.</p>
      ) : (
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={160} />
            <Tooltip />
            <Bar dataKey="totalVotes" fill="#b81e22" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
