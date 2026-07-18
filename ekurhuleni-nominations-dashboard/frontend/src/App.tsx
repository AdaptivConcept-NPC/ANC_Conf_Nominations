import { useEffect, useMemo, useState } from 'react'
import './App.css'
import ancLogo from './assets/African_National_Congress_logo.svg'
import { AdminCmsPortal } from './components/AdminCmsPortal'
import { WorkbookViews } from './components/WorkbookViews'
import { supabase } from './lib/supabaseClient'
import {
  fetchNominations,
  fetchWards,
  fetchZones,
  type NominationRecord,
  type WardOption,
  type ZoneOption,
} from './lib/dashboardData'
import type { Session, User } from '@supabase/supabase-js'

function getUserRole(user: User | null) {
  const rawRole = user?.app_metadata?.role ?? user?.user_metadata?.role
  return rawRole === 'admin' ? 'admin' : 'general'
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<'dashboard' | 'admin'>('dashboard')
  const [zones, setZones] = useState<ZoneOption[]>([])
  const [wards, setWards] = useState<WardOption[]>([])
  const [records, setRecords] = useState<NominationRecord[]>([])
  const [selectedZone, setSelectedZone] = useState('all')
  const [selectedWard, setSelectedWard] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const role = useMemo(() => getUserRole(session?.user ?? null), [session])
  const canAccessCms = role === 'admin'

  useEffect(() => {
    let isMounted = true

    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!isMounted) {
          return
        }
        if (sessionError) {
          setAuthError(sessionError.message)
        }
        setSession(data.session)
        setAuthLoading(false)
      })
      .catch((sessionError) => {
        if (!isMounted) {
          return
        }
        setAuthError(sessionError instanceof Error ? sessionError.message : 'Failed to load session.')
        setAuthLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setZones([])
      setWards([])
      setRecords([])
      setLoading(false)
      return
    }

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
  }, [session])

  useEffect(() => {
    if (!canAccessCms) {
      setActiveMode('dashboard')
    }
  }, [canAccessCms])

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

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError(null)

    try {
      if (authMode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: {
              role: 'general',
            },
          },
        })

        if (signUpError) {
          throw signUpError
        }

        setAuthError('Account created. Please confirm your email or sign in again if email verification is disabled.')
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        })

        if (signInError) {
          throw signInError
        }
      }
    } catch (loginError) {
      setAuthError(loginError instanceof Error ? loginError.message : 'Authentication failed.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setSelectedZone('all')
    setSelectedWard('all')
    setActiveMode('dashboard')
  }

  if (authLoading) {
    return (
      <main className="dashboard-root">
        <section className="panel auth-loading">
          <p>Checking session...</p>
        </section>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="dashboard-root auth-root">
        <section className="auth-shell">
          <div className="auth-hero panel">
            <div className="auth-banner-frame">
              <img src="/brand/ANC_Flag.jpg" className="auth-banner-image" alt="ANC flag and emblem banner" />
              <div className="auth-banner-mark">
                <img src={ancLogo} className="brand-mark" alt="ANC emblem" />
              </div>
            </div>
            <p className="eyebrow">ANC Ekurhuleni</p>
            <h1>NOM2026 PR and Councillor Nominations Dashboard</h1>
            <p className="hero-copy">Your vote, your voice, our shared future.</p>
            {/* <div className="auth-badges">
              <span>General users: dashboard only</span>
              <span>Admin users: dashboard + CMS</span>
              <span>Hosted on Supabase + Netlify</span>
            </div>
            <div className="auth-kpis">
              <article>
                <strong>Workbook</strong>
                <p>Analytics-first views with ANC styling.</p>
              </article>
              <article>
                <strong>Secure</strong>
                <p>Service-role writes stay server-side.</p>
              </article>
              <article>
                <strong>Role-aware</strong>
                <p>Admin access is hidden unless authorized.</p>
              </article>
            </div> */}
          </div>

          <form className="panel auth-card" onSubmit={handleAuthSubmit}>
            <div className="auth-card-head">
              <div>
                <h2>{authMode === 'login' ? 'Sign in' : 'Create account'}</h2>
                <p className="muted">Use your email and password. If you have a seeded bootstrap account, it will appear here once set.</p>
              </div>
              <button type="button" className="secondary-button auth-switch" onClick={() => setAuthMode((current) => (current === 'login' ? 'signup' : 'login'))}>
                {authMode === 'login' ? 'Need an account?' : 'Back to sign in'}
              </button>
            </div>
            <div className="auth-form-grid">
              <label>
                Email
                <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} autoComplete="email" placeholder="name@example.com" required />
              </label>
              <label>
                Password
                <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder="••••••••" required />
              </label>
            </div>
            {authError ? <p className="auth-message">{authError}</p> : null}
            <div className="action-row auth-actions">
              <button type="submit" disabled={authBusy}>{authBusy ? 'Please wait...' : authMode === 'login' ? 'Sign in' : 'Sign up'}</button>
            </div>
          </form>
        </section>
      </main>
    )
  }

  const modeSwitcher = (
    <nav className="mode-bar panel" aria-label="Application mode">
      <div>
        <p className="eyebrow">ANC Ekurhuleni</p>
        <h2>NOM2026 PR and Councillor Nominations Dashboard</h2>
        <p className="muted">Signed in as {session.user.email ?? 'unknown user'} · {role === 'admin' ? 'Admin access' : 'General access'}</p>
      </div>
      <div className="mode-toggle">
        <button type="button" className={activeMode === 'dashboard' ? 'sheet-tab active' : 'sheet-tab'} onClick={() => setActiveMode('dashboard')}>
          Dashboard
        </button>
        {canAccessCms ? (
          <button type="button" className={activeMode === 'admin' ? 'sheet-tab active' : 'sheet-tab'} onClick={() => setActiveMode('admin')}>
            Admin CMS
          </button>
        ) : null}
        <button type="button" className="sheet-tab" onClick={() => void handleSignOut()}>
          Sign out
        </button>
      </div>
    </nav>
  )

  const dashboardModeControls = (
    <div className="mode-toggle" aria-label="Application mode">
      <button type="button" className={activeMode === 'dashboard' ? 'sheet-tab active' : 'sheet-tab'} onClick={() => setActiveMode('dashboard')}>
        Dashboard
      </button>
      {canAccessCms ? (
        <button type="button" className={activeMode === 'admin' ? 'sheet-tab active' : 'sheet-tab'} onClick={() => setActiveMode('admin')}>
          Admin CMS
        </button>
      ) : null}
      <button type="button" className="sheet-tab" onClick={() => void handleSignOut()}>
        Sign out
      </button>
    </div>
  )

  if (activeMode === 'admin' && canAccessCms) {
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
      <header className="hero-banner">
        <div className="hero-banner-top">
          <div className="hero-brand">
            <div className="brand-mark-shell">
              <img src={ancLogo} className="brand-mark" alt="ANC emblem" />
            </div>
            <div>
              <p className="eyebrow">ANC Ekurhuleni</p>
              <h1>NOM2026 PR and Councillor Nominations</h1>
              <p className="muted">Overview candidate nominations by Ward.</p>
              <p className="muted hero-session-note">Signed in as {session.user.email ?? 'unknown user'} · {role === 'admin' ? 'Admin access' : 'General access'}</p>
            </div>
          </div>
          <div className="hero-actions">
            {dashboardModeControls}
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
