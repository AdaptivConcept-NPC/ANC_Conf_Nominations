type ZoneBreakdownRow = {
  zone: string
  totalVotes: number
}

type ZoneBreakdownProps = {
  data: ZoneBreakdownRow[]
}

export function ZoneBreakdown({ data }: ZoneBreakdownProps) {
  return (
    <div className="panel">
      <h2>Zone Breakdown</h2>
      {data.length === 0 ? (
        <p className="muted">No votes in the selected filters.</p>
      ) : (
        <table className="zone-table">
          <thead>
            <tr>
              <th>Zone</th>
              <th>Votes</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.zone}>
                <td>{row.zone}</td>
                <td>{row.totalVotes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
