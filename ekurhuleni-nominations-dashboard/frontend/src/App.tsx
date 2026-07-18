import { useEffect, useMemo, useState } from 'react'
import './App.css'
import ancLogo from './assets/African_National_Congress_logo.svg'
import { AdminCmsPortal } from './components/AdminCmsPortal'
import { WorkbookViews } from './components/WorkbookViews'
import {
  fetchNominations,
  fetchWards,
  fetchZones,
  type NominationRecord,
  type WardOption,
  type ZoneOption,
} from './lib/dashboardData'

function App() {
  const [activeMode, setActiveMode] = useState<'dashboard' | 'admin'>('dashboard')
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

  const modeSwitcher = (
    <nav className="mode-bar panel" aria-label="Application mode">
      <div>
        <p className="eyebrow">ANC Ekurhuleni</p>
        <h2>Election Nomination Management</h2>
        <p className="muted">Switch between live analytics and the admin CMS portal.</p>
      </div>
      <div className="mode-toggle">
        <button type="button" className={activeMode === 'dashboard' ? 'sheet-tab active' : 'sheet-tab'} onClick={() => setActiveMode('dashboard')}>
          Dashboard
        </button>
        <button type="button" className={activeMode === 'admin' ? 'sheet-tab active' : 'sheet-tab'} onClick={() => setActiveMode('admin')}>
          Admin CMS
        </button>
      </div>
    </nav>
  )

  if (activeMode === 'admin') {
    return (
      <main className="dashboard-root">
        {modeSwitcher}
        <AdminCmsPortal />
        <footer className="muted footer-note" role="contentinfo">
          <p>Copyright © African National Congress 2026. All rights reserved.</p>
        </footer>
      </main>
    )
  }

  return (
    <main className="dashboard-root">
      {modeSwitcher}
      <header className="hero-banner">
        <div className="hero-brand">
          <div className="brand-mark-shell">
            <img src={ancLogo} className="brand-mark" alt="ANC emblem" />
          </div>
          <div>
          <p className="eyebrow">ANC Ekurhuleni</p>
          <h1>NOM2026 PR and Councillor Nominations</h1>
          <p className="muted">Overview candidate nominations by Ward.</p>
          </div>
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

          <WorkbookViews records={filteredRecords} zones={zones} />
        </>
      )}

      <footer className="muted footer-note" role="contentinfo">
        <p>Copyright © African National Congress 2026. All rights reserved.</p>
      </footer>
    </main>
  )
}

export default App
