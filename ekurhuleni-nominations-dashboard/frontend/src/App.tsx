import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { Leaderboard } from './components/Leaderboard'
import { ZoneBreakdown } from './components/ZoneBreakdown'
import {
  aggregateByCandidate,
  aggregateByZone,
  fetchNominations,
  fetchWards,
  fetchZones,
  type NominationRecord,
  type WardOption,
  type ZoneOption,
} from './lib/dashboardData'

function App() {
  const [zones, setZones] = useState<ZoneOption[]>([])
  const [wards, setWards] = useState<WardOption[]>([])
  const [records, setRecords] = useState<NominationRecord[]>([])
  const [selectedZone, setSelectedZone] = useState('all')
  const [selectedWard, setSelectedWard] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true)
      setError(null)
      try {
        const [zoneData, wardData, nominationData] = await Promise.all([
          fetchZones(),
          fetchWards(),
          fetchNominations(),
        ])
        setZones(zoneData)
        setWards(wardData)
        setRecords(nominationData)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard data.')
      } finally {
        setLoading(false)
      }
    }

    void loadDashboard()
  }, [])

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const zoneMatch = selectedZone === 'all' || record.zoneName === selectedZone
      const wardMatch = selectedWard === 'all' || record.wardNumber === Number(selectedWard)
      return zoneMatch && wardMatch
    })
  }, [records, selectedZone, selectedWard])

  const leaderboardData = useMemo(() => aggregateByCandidate(filteredRecords), [filteredRecords])
  const zoneData = useMemo(() => aggregateByZone(filteredRecords), [filteredRecords])

  const stats = useMemo(() => {
    const totalVotes = filteredRecords.reduce((sum, record) => sum + record.voteCount, 0)
    const candidateCount = new Set(filteredRecords.map((record) => record.candidateName)).size
    const wardCount = new Set(filteredRecords.map((record) => record.wardNumber)).size
    return { totalVotes, candidateCount, wardCount }
  }, [filteredRecords])

  const visibleWards = useMemo(() => {
    if (selectedZone === 'all') {
      return wards
    }
    return wards.filter((ward) => ward.zoneName === selectedZone)
  }, [selectedZone, wards])

  function handleZoneChange(zone: string) {
    setSelectedZone(zone)
    setSelectedWard('all')
  }

  return (
    <main className="dashboard-root">
      <header className="hero-banner">
        <div>
          <p className="eyebrow">ANC Ekurhuleni</p>
          <h1>Nomination Analytics Dashboard</h1>
          <p className="muted">Read-only leadership overview driven by Supabase nomination data.</p>
        </div>
        <div className="filter-row">
          <label>
            Zone
            <select value={selectedZone} onChange={(event) => handleZoneChange(event.target.value)}>
              <option value="all">All zones</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.name}>
                  {zone.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ward
            <select value={selectedWard} onChange={(event) => setSelectedWard(event.target.value)}>
              <option value="all">All wards</option>
              {visibleWards.map((ward) => (
                <option key={ward.id} value={ward.wardNumber}>
                  Ward {ward.wardNumber}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {loading ? (
        <section className="panel">
          <p>Loading dashboard data...</p>
        </section>
      ) : error ? (
        <section className="panel error-panel">
          <h2>Data Load Error</h2>
          <p>{error}</p>
          <p className="muted">Confirm local Supabase is running and env variables are set in frontend.</p>
        </section>
      ) : (
        <>
          <section className="stats-grid">
            <article className="panel stat-card">
              <p className="stat-label">Total Votes</p>
              <p className="stat-value">{stats.totalVotes}</p>
            </article>
            <article className="panel stat-card">
              <p className="stat-label">Candidates</p>
              <p className="stat-value">{stats.candidateCount}</p>
            </article>
            <article className="panel stat-card">
              <p className="stat-label">Active Wards</p>
              <p className="stat-value">{stats.wardCount}</p>
            </article>
          </section>

          <section className="content-grid">
            <Leaderboard data={leaderboardData} />
            <ZoneBreakdown data={zoneData} />
          </section>
        </>
      )}

      <footer className="muted footer-note">
        Data source: Supabase nominations table seeded from ANC nomination workbook.
      </footer>
    </main>
  )
}

export default App
