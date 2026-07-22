import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchAdminAliases,
  fetchAdminCandidates,
  fetchAdminProfiles,
  fetchAdminTransferReport,
  fetchAdminWards,
  fetchAdminZones,
  fetchAdminAppUsers,
  saveAdminRecord,
  type AdminPayload,
  type AdminAlias,
  type AdminCandidate,
  type AdminProfile,
  type AdminTransferReport,
  type AdminWard,
  type AdminZone,
  type AdminAppUser,
} from '../lib/adminData'
import {
  downloadVotingTemplate,
  fetchActiveCandidatesForVoting,
  parseVotingWorkbook,
  submitBulkVotingUpload,
  submitWardBallot,
  type BulkUploadResult,
  type ParsedVoteRow,
  type VotingTemplateCandidate,
} from '../lib/votingData'

type ZoneFormState = {
  id: string
  name: string
  coordinatorName: string
}

type WardFormState = {
  id: string
  wardNumber: string
  zoneId: string
}

type CandidateFormState = {
  id: string
  fullName: string
  isActive: boolean
}

type AliasFormState = {
  id: string
  candidateId: string
  aliasName: string
  sourceNote: string
}

type ProfileFormState = {
  id: string
  candidateId: string
  displayName: string
  photoUrl: string
  shortBio: string
  contactPhone: string
  contactEmail: string
  zoneId: string
  wardId: string
  status: 'draft' | 'active' | 'archived'
  notes: string
}

const emptyZoneForm: ZoneFormState = { id: '', name: '', coordinatorName: '' }
const emptyWardForm: WardFormState = { id: '', wardNumber: '', zoneId: '' }
const emptyCandidateForm: CandidateFormState = { id: '', fullName: '', isActive: true }
const emptyAliasForm: AliasFormState = { id: '', candidateId: '', aliasName: '', sourceNote: '' }
const emptyProfileForm: ProfileFormState = {
  id: '',
  candidateId: '',
  displayName: '',
  photoUrl: '',
  shortBio: '',
  contactPhone: '',
  contactEmail: '',
  zoneId: '',
  wardId: '',
  status: 'draft',
  notes: '',
}

type AppUserFormState = {
  id: string
  email: string
  fullName: string
  contactNumber: string
  role: 'SuperAdmin' | 'Admin' | 'Viewer'
  isActive: boolean
}
const emptyAppUserForm: AppUserFormState = {
  id: '',
  email: '',
  fullName: '',
  contactNumber: '',
  role: 'Viewer',
  isActive: true,
}

function readMessage(value: unknown) {
  return value instanceof Error ? value.message : 'Failed to save record.'
}

export function AdminCmsPortal() {
  const [zones, setZones] = useState<AdminZone[]>([])
  const [wards, setWards] = useState<AdminWard[]>([])
  const [candidates, setCandidates] = useState<AdminCandidate[]>([])
  const [aliases, setAliases] = useState<AdminAlias[]>([])
  const [profiles, setProfiles] = useState<AdminProfile[]>([])
  const [report, setReport] = useState<AdminTransferReport | null>(null)
  const [appUsers, setAppUsers] = useState<AdminAppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'profiles' | 'references' | 'report' | 'users'>('profiles')
  const [activeReferenceView, setActiveReferenceView] = useState<'zones' | 'wards' | 'candidates' | 'aliases'>('zones')
  const [activeReportView, setActiveReportView] = useState<'bulk-upload' | 'manual-ballot'>('bulk-upload')

  // Voting / Report tab state
  const [activeCandidates, setActiveCandidates] = useState<VotingTemplateCandidate[]>([])
  const [templateDownloading, setTemplateDownloading] = useState(false)
  // Bulk upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedVoteRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null)
  const [uploading, setUploading] = useState(false)
  // Manual ballot capture
  const [ballotWardId, setBallotWardId] = useState('')
  const [ballotCandidateIds, setBallotCandidateIds] = useState<Set<string>>(new Set())
  const [ballotSubmitting, setBallotSubmitting] = useState(false)
  const [ballotResult, setBallotResult] = useState<{ ok: boolean; message: string } | null>(null)

  const [zoneForm, setZoneForm] = useState<ZoneFormState>(emptyZoneForm)
  const [wardForm, setWardForm] = useState<WardFormState>(emptyWardForm)
  const [candidateForm, setCandidateForm] = useState<CandidateFormState>(emptyCandidateForm)
  const [aliasForm, setAliasForm] = useState<AliasFormState>(emptyAliasForm)
  const [profileForm, setProfileForm] = useState<ProfileFormState>(emptyProfileForm)
  const [appUserForm, setAppUserForm] = useState<AppUserFormState>(emptyAppUserForm)

  const wardOptions = useMemo(() => wards, [wards])
  const candidateOptions = useMemo(() => candidates, [candidates])

  async function loadAdminData() {
    setLoading(true)
    setError(null)
    try {
      const [zoneData, wardData, candidateData, aliasData, profileData, reportData, appUserData, activeCandidateData] = await Promise.all([
        fetchAdminZones(),
        fetchAdminWards(),
        fetchAdminCandidates(),
        fetchAdminAliases(),
        fetchAdminProfiles(),
        fetchAdminTransferReport(),
        fetchAdminAppUsers(),
        fetchActiveCandidatesForVoting(),
      ])

      setZones(zoneData)
      setWards(wardData)
      setCandidates(candidateData)
      setAliases(aliasData)
      setProfiles(profileData)
      setReport(reportData)
      setAppUsers(appUserData)
      setActiveCandidates(activeCandidateData)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load admin CMS data.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDownloadTemplate() {
    setTemplateDownloading(true)
    setError(null)
    try {
      await downloadVotingTemplate(
        wards.map((w) => ({ wardNumber: w.wardNumber })),
        activeCandidates,
      )
      alert('✓ Template downloaded successfully. Please fill in the voting data and upload it back.')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate template.'
      setError(errorMsg)
      alert(`❌ Download Error:\n\n${errorMsg}`)
    } finally {
      setTemplateDownloading(false)
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setUploadFile(file)
    setUploadResult(null)
    setParsedRows([])
    setParseErrors([])
    if (!file) return
    const { rows, parseErrors: errors } = await parseVotingWorkbook(file)
    setParsedRows(rows)
    setParseErrors(errors)
  }

  async function handleBulkUpload() {
    if (!uploadFile || parsedRows.length === 0) return
    setUploading(true)
    setUploadResult(null)
    try {
      const result = await submitBulkVotingUpload(parsedRows, uploadFile.name)
      setUploadResult(result)
      if (result.ok) {
        await loadAdminData()
        setUploadFile(null)
        setParsedRows([])
        setParseErrors([])
        if (fileInputRef.current) fileInputRef.current.value = ''
        alert(`✓ Upload successful!\n\n${result.wardsProcessed} ward(s) processed\n${result.votesInserted} vote(s) inserted`)
      } else {
        const errorMsg = result.error ?? 'Upload failed.'
        setUploadResult(result)
        alert(`❌ Upload Error:\n\n${errorMsg}`)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed.'
      setUploadResult({ ok: false, error: errorMsg })
      alert(`❌ Upload Error:\n\n${errorMsg}`)
    } finally {
      setUploading(false)
    }
  }

  function toggleBallotCandidate(candidateId: string) {
    setBallotCandidateIds((prev) => {
      const next = new Set(prev)
      if (next.has(candidateId)) {
        next.delete(candidateId)
      } else if (next.size < 6) {
        next.add(candidateId)
      }
      return next
    })
  }

  async function handleBallotSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!ballotWardId) return
    setBallotSubmitting(true)
    setBallotResult(null)
    try {
      const result = await submitWardBallot(ballotWardId, Array.from(ballotCandidateIds))
      if (result.ok) {
        setBallotResult({ ok: true, message: `Ward ballot submitted. ${result.votesInserted ?? 0} vote(s) recorded.` })
        setBallotWardId('')
        setBallotCandidateIds(new Set())
        await loadAdminData()
        alert(`✓ Ballot submitted successfully!\n\n${result.votesInserted ?? 0} vote(s) recorded for this ward.`)
      } else {
        const errorMsg = result.error ?? 'Ballot submission failed.'
        setBallotResult({ ok: false, message: errorMsg })
        alert(`❌ Ballot Error:\n\n${errorMsg}`)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Ballot submission failed.'
      setBallotResult({ ok: false, message: errorMsg })
      alert(`❌ Ballot Error:\n\n${errorMsg}`)
    } finally {
      setBallotSubmitting(false)
    }
  }

  useEffect(() => {
    void loadAdminData()
  }, [])

  async function handleSave(payload: AdminPayload) {
    setSaving(payload.resource)
    setStatusMessage(null)
    try {
      await saveAdminRecord(payload)
      setStatusMessage(`Saved ${payload.resource} successfully.`)
      setZoneForm(emptyZoneForm)
      setWardForm(emptyWardForm)
      setCandidateForm(emptyCandidateForm)
      setAliasForm(emptyAliasForm)
      setProfileForm(emptyProfileForm)
      setAppUserForm(emptyAppUserForm)
      await loadAdminData()
    } catch (saveError) {
      setError(readMessage(saveError))
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <section className="panel">
        <h2>Admin CMS Portal</h2>
        <p>Loading admin data...</p>
      </section>
    )
  }

  const navigationItems = [
    { id: 'profiles', label: 'Profiles', description: 'Candidate profiles and capture form', icon: 'P' },
    { id: 'references', label: 'References', description: 'Zones, wards, candidates, aliases', icon: 'R' },
    { id: 'report', label: 'Report', description: 'Transfer summary and batch details', icon: 'T' },
    { id: 'users', label: 'App Users', description: 'Manage application user access', icon: 'U' },
  ] as const

  return (
    <section className="admin-shell">
      <section className="admin-hero panel">
        <div>
          <p className="eyebrow">Internal CMS</p>
          <h2>Admin Portal</h2>
          <p className="muted">Manage candidate profiles, canonical records, and reference tables.</p>
        </div>
        <div className="admin-hero-stats">
          <div>
            <span>Profiles</span>
            <strong>{report?.profileCount ?? profiles.length}</strong>
          </div>
          <div>
            <span>Aliases</span>
            <strong>{report?.aliasCount ?? aliases.length}</strong>
          </div>
          <div>
            <span>Latest Batch</span>
            <strong>{report?.latestBatch?.status ?? 'N/A'}</strong>
          </div>
        </div>
      </section>

      {error ? (
        <section className="panel error-panel">
          <h2>CMS Error</h2>
          <p>{error}</p>
        </section>
      ) : null}

      {statusMessage ? (
        <section className="panel success-panel">
          <p>{statusMessage}</p>
        </section>
      ) : null}

      <section className="admin-layout">
        <aside className="admin-sidebar panel">
          <div className="admin-sidebar-brand">
            <p className="eyebrow">CMS Sections</p>
            <h3>Navigation</h3>
            <p className="muted">Switch between the profile editor, reference data, and import report.</p>
          </div>

          <nav className="admin-nav" aria-label="Admin CMS tabs">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={activeView === item.id ? 'admin-nav-button active' : 'admin-nav-button'}
                onClick={() => setActiveView(item.id)}
              >
                <span className="admin-nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="admin-nav-copy">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            ))}
          </nav>

          {/* <div className="admin-hero-stats admin-sidebar-stats">
            <div>
              <span>Profiles</span>
              <strong>{report?.profileCount ?? profiles.length}</strong>
            </div>
            <div>
              <span>Aliases</span>
              <strong>{report?.aliasCount ?? aliases.length}</strong>
            </div>
            <div>
              <span>Latest Batch</span>
              <strong>{report?.latestBatch?.status ?? 'N/A'}</strong>
            </div>
          </div> */}
        </aside>

        <section className="admin-content">
          {activeView === 'profiles' ? (
            <article className="panel admin-card">
              <div className="sheet-controls">
                <h2>Candidate Profile Capture</h2>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleSave({
                    resource: 'profile',
                    ...profileForm,
                    id: profileForm.id || undefined,
                    photoUrl: profileForm.photoUrl || null,
                    shortBio: profileForm.shortBio || null,
                    contactPhone: profileForm.contactPhone || null,
                    contactEmail: profileForm.contactEmail || null,
                    zoneId: profileForm.zoneId || null,
                    wardId: profileForm.wardId || null,
                    notes: profileForm.notes || null,
                  })
                }}
              >
                <div className="form-section">
                  <h4>Primary Details</h4>
                  <div className="form-grid">
                    <label>
                      Candidate
                      <select value={profileForm.candidateId} onChange={(event) => setProfileForm((current) => ({ ...current, candidateId: event.target.value }))} required>
                        <option value="">Select candidate</option>
                        {candidateOptions.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.fullName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Display name
                      <input value={profileForm.displayName} onChange={(event) => setProfileForm((current) => ({ ...current, displayName: event.target.value }))} required />
                    </label>
                    <label>
                      Status
                      <select value={profileForm.status} onChange={(event) => setProfileForm((current) => ({ ...current, status: event.target.value as ProfileFormState['status'] }))}>
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="form-section">
                  <h4>Location & Contact</h4>
                  <div className="form-grid">
                    <label>
                      Zone
                      <select value={profileForm.zoneId} onChange={(event) => setProfileForm((current) => ({ ...current, zoneId: event.target.value }))}>
                        <option value="">No zone</option>
                        {zones.map((zone) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Ward
                      <select value={profileForm.wardId} onChange={(event) => setProfileForm((current) => ({ ...current, wardId: event.target.value }))}>
                        <option value="">No ward</option>
                        {wardOptions.map((ward) => (
                          <option key={ward.id} value={ward.id}>
                            Ward {ward.wardNumber}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Phone
                      <input value={profileForm.contactPhone} onChange={(event) => setProfileForm((current) => ({ ...current, contactPhone: event.target.value }))} />
                    </label>
                  </div>
                </div>

                <div className="form-section">
                  <h4>Media & Bio</h4>
                  <div className="form-grid">
                    <label className="full-span">
                      Photo URL
                      <input value={profileForm.photoUrl} onChange={(event) => setProfileForm((current) => ({ ...current, photoUrl: event.target.value }))} />
                    </label>
                    <label className="full-span">
                      Short bio
                      <textarea rows={3} value={profileForm.shortBio} onChange={(event) => setProfileForm((current) => ({ ...current, shortBio: event.target.value }))} />
                    </label>
                    <label className="full-span">
                      Notes
                      <textarea rows={3} value={profileForm.notes} onChange={(event) => setProfileForm((current) => ({ ...current, notes: event.target.value }))} />
                    </label>
                  </div>
                </div>

                <div className="action-row">
                  <button type="submit" disabled={saving === 'profile'}>
                    {saving === 'profile' ? 'Saving...' : 'Save profile'}
                  </button>
                  <button type="button" className="secondary-button" onClick={() => setProfileForm(emptyProfileForm)}>
                    Reset
                  </button>
                </div>
              </form>
              <div className="cms-list-wrap">
                <table className="zone-table">
                  <thead>
                    <tr>
                      <th>Profile</th>
                      <th>Status</th>
                      <th>Zone / Ward</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((profile) => (
                      <tr key={profile.id}>
                        <td>{profile.displayName}</td>
                        <td><span className={`status-pill ${profile.status}`}>{profile.status}</span></td>
                        <td>
                          {profile.zoneName ?? '-'} / {profile.wardNumber ? `Ward ${profile.wardNumber}` : '-'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() =>
                              setProfileForm({
                                id: profile.id,
                                candidateId: profile.candidateId,
                                displayName: profile.displayName,
                                photoUrl: profile.photoUrl ?? '',
                                shortBio: profile.shortBio ?? '',
                                contactPhone: profile.contactPhone ?? '',
                                contactEmail: profile.contactEmail ?? '',
                                zoneId: profile.zoneId ?? '',
                                wardId: profile.wardId ?? '',
                                status: profile.status,
                                notes: profile.notes ?? '',
                              })
                            }
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ) : null}

          {activeView === 'references' ? (
            <article className="panel admin-card">
              <h2>Reference Data</h2>
              <div className="nested-tabs">
                <button type="button" className={activeReferenceView === 'zones' ? 'nested-tab-btn active' : 'nested-tab-btn'} onClick={() => setActiveReferenceView('zones')}>Zones</button>
                <button type="button" className={activeReferenceView === 'wards' ? 'nested-tab-btn active' : 'nested-tab-btn'} onClick={() => setActiveReferenceView('wards')}>Wards</button>
                <button type="button" className={activeReferenceView === 'candidates' ? 'nested-tab-btn active' : 'nested-tab-btn'} onClick={() => setActiveReferenceView('candidates')}>Candidates</button>
                <button type="button" className={activeReferenceView === 'aliases' ? 'nested-tab-btn active' : 'nested-tab-btn'} onClick={() => setActiveReferenceView('aliases')}>Aliases</button>
              </div>
              <div className="admin-subgrid">
                {activeReferenceView === 'zones' && (
                <section className="mini-panel">
                  <h3>Zone</h3>
                  <form
                    className="form-grid compact"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void handleSave({
                        resource: 'zone',
                        ...zoneForm,
                        id: zoneForm.id || undefined,
                        coordinatorName: zoneForm.coordinatorName || null,
                      })
                    }}
                  >
                    <label>
                      Name
                      <input value={zoneForm.name} onChange={(event) => setZoneForm((current) => ({ ...current, name: event.target.value }))} required />
                    </label>
                    <label>
                      Coordinator
                      <input value={zoneForm.coordinatorName} onChange={(event) => setZoneForm((current) => ({ ...current, coordinatorName: event.target.value }))} />
                    </label>
                    <div className="action-row">
                      <button type="submit" disabled={saving === 'zone'}>
                        {saving === 'zone' ? 'Saving...' : 'Save zone'}
                      </button>
                      <button type="button" className="secondary-button" onClick={() => setZoneForm(emptyZoneForm)}>
                        Reset
                      </button>
                    </div>
                  </form>
                  <div className="cms-list-wrap">
                    <table className="zone-table">
                      <thead>
                        <tr>
                          <th>Zone</th>
                          <th>Coordinator</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {zones.map((zone) => (
                          <tr key={zone.id}>
                            <td>{zone.name}</td>
                            <td>{zone.coordinatorName ?? '-'}</td>
                            <td>
                              <button type="button" className="link-button" onClick={() => setZoneForm({ id: zone.id, name: zone.name, coordinatorName: zone.coordinatorName ?? '' })}>
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                )}

                {activeReferenceView === 'wards' && (
                <section className="mini-panel">
                  <h3>Ward</h3>
                  <form
                    className="form-grid compact"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void handleSave({
                        resource: 'ward',
                        ...wardForm,
                        id: wardForm.id || undefined,
                        wardNumber: Number(wardForm.wardNumber),
                        zoneId: wardForm.zoneId || null,
                      })
                    }}
                  >
                    <label>
                      Ward number
                      <input type="number" min="1" value={wardForm.wardNumber} onChange={(event) => setWardForm((current) => ({ ...current, wardNumber: event.target.value }))} required />
                    </label>
                    <label>
                      Zone
                      <select value={wardForm.zoneId} onChange={(event) => setWardForm((current) => ({ ...current, zoneId: event.target.value }))}>
                        <option value="">No zone</option>
                        {zones.map((zone) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="action-row">
                      <button type="submit" disabled={saving === 'ward'}>
                        {saving === 'ward' ? 'Saving...' : 'Save ward'}
                      </button>
                      <button type="button" className="secondary-button" onClick={() => setWardForm(emptyWardForm)}>
                        Reset
                      </button>
                    </div>
                  </form>
                  <div className="cms-list-wrap">
                    <table className="zone-table">
                      <thead>
                        <tr>
                          <th>Ward</th>
                          <th>Zone</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {wards.map((ward) => (
                          <tr key={ward.id}>
                            <td>Ward {ward.wardNumber}</td>
                            <td>{ward.zoneName ?? '-'}</td>
                            <td>
                              <button type="button" className="link-button" onClick={() => setWardForm({ id: ward.id, wardNumber: String(ward.wardNumber), zoneId: ward.zoneId ?? '' })}>
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                )}

                {activeReferenceView === 'candidates' && (
                <section className="mini-panel">
                  <h3>Candidate</h3>
                  <form
                    className="form-grid compact"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void handleSave({
                        resource: 'candidate',
                        ...candidateForm,
                        id: candidateForm.id || undefined,
                      })
                    }}
                  >
                    <label>
                      Full name
                      <input value={candidateForm.fullName} onChange={(event) => setCandidateForm((current) => ({ ...current, fullName: event.target.value }))} required />
                    </label>
                    <label className="checkbox-row">
                      <input type="checkbox" checked={candidateForm.isActive} onChange={(event) => setCandidateForm((current) => ({ ...current, isActive: event.target.checked }))} />
                      Active
                    </label>
                    <div className="action-row">
                      <button type="submit" disabled={saving === 'candidate'}>
                        {saving === 'candidate' ? 'Saving...' : 'Save candidate'}
                      </button>
                      <button type="button" className="secondary-button" onClick={() => setCandidateForm(emptyCandidateForm)}>
                        Reset
                      </button>
                    </div>
                  </form>
                  <div className="cms-list-wrap">
                    <table className="zone-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Active</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((candidate) => (
                          <tr key={candidate.id}>
                            <td>{candidate.fullName}</td>
                            <td><span className={`status-pill ${candidate.isActive ? 'active' : 'archived'}`}>{candidate.isActive ? 'Active' : 'Inactive'}</span></td>
                            <td>
                              <button type="button" className="link-button" onClick={() => setCandidateForm({ id: candidate.id, fullName: candidate.fullName, isActive: candidate.isActive })}>
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                )}

                {activeReferenceView === 'aliases' && (
                <section className="mini-panel">
                  <h3>Alias</h3>
                  <form
                    className="form-grid compact"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void handleSave({
                        resource: 'alias',
                        ...aliasForm,
                        id: aliasForm.id || undefined,
                        sourceNote: aliasForm.sourceNote || null,
                      })
                    }}
                  >
                    <label>
                      Candidate
                      <select value={aliasForm.candidateId} onChange={(event) => setAliasForm((current) => ({ ...current, candidateId: event.target.value }))} required>
                        <option value="">Select candidate</option>
                        {candidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.fullName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Alias
                      <input value={aliasForm.aliasName} onChange={(event) => setAliasForm((current) => ({ ...current, aliasName: event.target.value }))} required />
                    </label>
                    <label>
                      Source note
                      <input value={aliasForm.sourceNote} onChange={(event) => setAliasForm((current) => ({ ...current, sourceNote: event.target.value }))} />
                    </label>
                    <div className="action-row">
                      <button type="submit" disabled={saving === 'alias'}>
                        {saving === 'alias' ? 'Saving...' : 'Save alias'}
                      </button>
                      <button type="button" className="secondary-button" onClick={() => setAliasForm(emptyAliasForm)}>
                        Reset
                      </button>
                    </div>
                  </form>
                  <div className="cms-list-wrap">
                    <table className="zone-table">
                      <thead>
                        <tr>
                          <th>Alias</th>
                          <th>Candidate</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {aliases.map((alias) => (
                          <tr key={alias.id}>
                            <td>{alias.aliasName}</td>
                            <td>{alias.candidateName ?? '-'}</td>
                            <td>
                              <button type="button" className="link-button" onClick={() => setAliasForm({ id: alias.id, candidateId: alias.candidateId, aliasName: alias.aliasName, sourceNote: alias.sourceNote ?? '' })}>
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                )}
              </div>
            </article>
          ) : null}

          {activeView === 'report' ? (
            <article className="panel admin-card">
              <div className="sheet-controls">
                <h2>Transfer Report &amp; Data Capture</h2>
              </div>

              {/* KPI summary */}
              <div className="kpi-grid report-grid">
                <div><p>Zones</p><strong>{report?.zoneCount ?? 0}</strong></div>
                <div><p>Wards</p><strong>{report?.wardCount ?? 0}</strong></div>
                <div><p>Candidates</p><strong>{report?.candidateCount ?? 0}</strong></div>
                <div><p>Aliases</p><strong>{report?.aliasCount ?? 0}</strong></div>
                <div><p>Profiles</p><strong>{report?.profileCount ?? 0}</strong></div>
                <div><p>Nominations</p><strong>{report?.nominationCount ?? 0}</strong></div>
              </div>

              {/* Sub-tabs for Report sections */}
              <div className="admin-subtabs">
                <button
                  className={activeReportView === 'bulk-upload' ? 'subtab-button active' : 'subtab-button'}
                  onClick={() => setActiveReportView('bulk-upload')}
                >
                  Bulk Upload
                </button>
                <button
                  className={activeReportView === 'manual-ballot' ? 'subtab-button active' : 'subtab-button'}
                  onClick={() => setActiveReportView('manual-ballot')}
                >
                  Manual Ballot
                </button>
              </div>

              {/* Latest batch info */}
              <div className="mini-panel status-green">
                <h3>Latest Batch Status</h3>
                {report?.latestBatch ? (
                  <dl className="batch-details">
                    <div><dt>File</dt><dd>{report.latestBatch.sourceFilename}</dd></div>
                    <div><dt>Status</dt><dd><strong>{report.latestBatch.status}</strong></dd></div>
                    <div><dt>Processed</dt><dd>{new Date(report.latestBatch.processedAt).toLocaleString()}</dd></div>
                    <div><dt>Checksum</dt><dd>{report.latestBatch.sourceChecksum ?? '-'}</dd></div>
                    <div className="full-span"><dt>Error</dt><dd>{report.latestBatch.errorSummary ?? 'No errors recorded.'}</dd></div>
                  </dl>
                ) : (
                  <p className="muted">No batch metadata yet.</p>
                )}
              </div>

              {/* ---------------------------------------------------------- */}
              {/* Bulk Excel Upload Section                                   */}
              {/* ---------------------------------------------------------- */}
              {activeReportView === 'bulk-upload' && (
              <div className="mini-panel status-yellow">
                <h3>📊 Bulk Upload — Excel Template</h3>
                <p className="muted" style={{ marginBottom: '0.75rem' }}>
                  Download the pre-filled Excel template, capture voting results, then upload the completed file.
                  Each ward's results replace all previously recorded votes for that ward.
                </p>
                <div className="action-row" style={{ marginBottom: '1rem' }}>
                  <button
                    type="button"
                    disabled={templateDownloading || wards.length === 0}
                    onClick={() => { void handleDownloadTemplate() }}
                  >
                    {templateDownloading ? 'Generating…' : 'Download Excel Template'}
                  </button>
                  {wards.length === 0 && (
                    <span className="muted" style={{ marginLeft: '0.5rem' }}>No wards registered yet.</span>
                  )}
                </div>

                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                  <strong>Upload completed template (.xlsx)</strong>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    style={{ display: 'block', marginTop: '0.25rem' }}
                    onChange={(e) => { void handleFileChange(e) }}
                  />
                </label>

                {parseErrors.length > 0 && (
                  <div className="error-panel" style={{ padding: '0.75rem', borderRadius: '6px', marginBottom: '0.75rem' }}>
                    <strong>Parse errors</strong>
                    <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
                      {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}

                {parsedRows.length > 0 && parseErrors.length === 0 && (
                  <>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>{parsedRows.length} row(s) parsed.</strong>
                      {parsedRows.some((r) => r.parseError) && (
                        <span className="muted" style={{ marginLeft: '0.5rem' }}>
                          {parsedRows.filter((r) => r.parseError).length} row(s) have validation issues (shown below).
                        </span>
                      )}
                    </div>
                    <div className="cms-list-wrap" style={{ maxHeight: '260px', overflowY: 'auto', marginBottom: '0.75rem' }}>
                      <table className="zone-table">
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Ward</th>
                            <th>Candidate</th>
                            <th>Vote</th>
                            <th>Issue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedRows.map((row) => (
                            <tr key={row.rowIndex} style={row.parseError ? { color: 'var(--color-error, #c00)' } : undefined}>
                              <td>{row.rowIndex}</td>
                              <td>{row.wardNumber ?? '—'}</td>
                              <td>{row.candidateFullName || '—'}</td>
                              <td>{row.vote ?? '—'}</td>
                              <td>{row.parseError ?? <span className="muted">OK</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="action-row">
                      <button
                        type="button"
                        disabled={uploading || parsedRows.every((r) => r.parseError !== null)}
                        onClick={() => { void handleBulkUpload() }}
                      >
                        {uploading ? 'Uploading…' : 'Confirm & Upload'}
                      </button>
                    </div>
                  </>
                )}

                {uploadResult && (
                  <div
                    className={uploadResult.ok ? 'success-panel' : 'error-panel'}
                    style={{ padding: '0.75rem', borderRadius: '6px', marginTop: '0.75rem' }}
                  >
                    {uploadResult.ok ? (
                      <>
                        <strong>Upload successful.</strong> {uploadResult.wardsProcessed} ward(s) processed, {uploadResult.votesInserted} vote(s) inserted.
                        {(uploadResult.warnings ?? []).length > 0 && (
                          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
                            {uploadResult.warnings!.map((w, i) => <li key={i}>{w}</li>)}
                          </ul>
                        )}
                        {(uploadResult.rejectedRows ?? []).length > 0 && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <strong>{uploadResult.rejectedRows!.length} row(s) rejected:</strong>
                            <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
                              {uploadResult.rejectedRows!.map((r, i) => (
                                <li key={i}>Row {r.rowIndex}, Ward {String(r.wardNumber)}, {String(r.candidate)}: {r.reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      <><strong>Upload failed.</strong> {uploadResult.error}</>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* ---------------------------------------------------------- */}
              {/* Manual Ward Ballot Capture Section                          */}
              {/* ---------------------------------------------------------- */}
              {activeReportView === 'manual-ballot' && (
              <div className="mini-panel" style={{ backgroundColor: '#f5f5fa', borderLeft: '4px solid #6200ea' }}>
                <h3>✓ Manual Ward Ballot Capture</h3>
                <p className="muted" style={{ marginBottom: '0.75rem' }}>
                  Select a ward and tick the candidates who received a vote (max 6). Submitting fully replaces the ward's existing results.
                </p>

                {ballotResult && (
                  <div
                    className={ballotResult.ok ? 'success-panel' : 'error-panel'}
                    style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '0.75rem' }}
                  >
                    {ballotResult.message}
                  </div>
                )}

                <form onSubmit={(e) => { void handleBallotSubmit(e) }}>
                  <div className="form-grid" style={{ marginBottom: '0.75rem' }}>
                    <label>
                      Ward / Branch
                      <select
                        value={ballotWardId}
                        onChange={(e) => {
                          setBallotWardId(e.target.value)
                          setBallotCandidateIds(new Set())
                          setBallotResult(null)
                        }}
                        required
                      >
                        <option value="">Select ward</option>
                        {wards.map((w) => (
                          <option key={w.id} value={w.id}>Ward {w.wardNumber}{w.zoneName ? ` — ${w.zoneName}` : ''}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {ballotWardId && (
                    <>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong>Select candidates</strong>
                        <span className="muted" style={{ marginLeft: '0.5rem' }}>{ballotCandidateIds.size} / 6 selected</span>
                      </div>
                      <div className="cms-list-wrap" style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '0.75rem' }}>
                        <table className="zone-table">
                          <thead>
                            <tr><th>Vote</th><th>Candidate</th></tr>
                          </thead>
                          <tbody>
                            {activeCandidates.map((c) => {
                              const checked = ballotCandidateIds.has(c.id)
                              const disabled = !checked && ballotCandidateIds.size >= 6
                              return (
                                <tr key={c.id} style={disabled ? { opacity: 0.45 } : undefined}>
                                  <td>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={disabled}
                                      onChange={() => toggleBallotCandidate(c.id)}
                                    />
                                  </td>
                                  <td>{c.fullName}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  <div className="action-row">
                    <button type="submit" disabled={!ballotWardId || ballotSubmitting}>
                      {ballotSubmitting ? 'Submitting…' : 'Submit Ward Ballot'}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setBallotWardId('')
                        setBallotCandidateIds(new Set())
                        setBallotResult(null)
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </form>
              </div>
              )}
            </article>
          ) : null}

          {activeView === 'users' ? (
            <article className="panel admin-card">
              <div className="sheet-controls">
                <h3>Manage App Users</h3>
              </div>
              <div className="reference-split">
                <section className="form-section">
                  <h4>{appUserForm.id ? 'Edit User' : 'Add App User'}</h4>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      void handleSave({
                        resource: 'app_user',
                        id: appUserForm.id || undefined,
                        email: appUserForm.email,
                        fullName: appUserForm.fullName,
                        contactNumber: appUserForm.contactNumber,
                        role: appUserForm.role,
                        isActive: appUserForm.isActive,
                      })
                    }}
                    className="vertical-form app-user-form"
                  >
                    <div className="form-grid app-user-grid">
                      <label>
                        Email *
                        <input
                          type="email"
                          value={appUserForm.email}
                          onChange={(event) => setAppUserForm((current) => ({ ...current, email: event.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        Full Name *
                        <input
                          value={appUserForm.fullName}
                          onChange={(event) => setAppUserForm((current) => ({ ...current, fullName: event.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        Contact Number
                        <input
                          value={appUserForm.contactNumber}
                          onChange={(event) => setAppUserForm((current) => ({ ...current, contactNumber: event.target.value }))}
                        />
                      </label>
                      <label>
                        Role *
                        <select
                          value={appUserForm.role}
                          onChange={(event) =>
                            setAppUserForm((current) => ({
                              ...current,
                              role: event.target.value as AppUserFormState['role'],
                            }))
                          }
                          required
                        >
                          <option value="Viewer">Viewer</option>
                          <option value="Admin">Admin</option>
                          <option value="SuperAdmin">SuperAdmin</option>
                        </select>
                      </label>
                      <label className="checkbox-label full-span">
                        <input
                          type="checkbox"
                          checked={appUserForm.isActive}
                          onChange={(event) => setAppUserForm((current) => ({ ...current, isActive: event.target.checked }))}
                        />
                        Active Account
                      </label>
                    </div>
                    <div className="action-row">
                      <button type="submit" disabled={saving === 'app_user'}>
                        {saving === 'app_user' ? 'Saving...' : 'Save User'}
                      </button>
                      <button type="button" className="secondary-button" onClick={() => setAppUserForm(emptyAppUserForm)}>
                        Reset
                      </button>
                    </div>
                  </form>
                </section>
                <section className="list-section">
                  <h4>Directory ({appUsers.length})</h4>
                  <div className="cms-list-wrap">
                    <table className="zone-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {appUsers.map((user) => (
                          <tr key={user.id}>
                            <td>
                              <div>{user.fullName}</div>
                              <div className="muted">{user.email}</div>
                            </td>
                            <td>{user.role}</td>
                            <td>
                              <span className={`status-pill ${user.isActive ? 'active' : 'archived'}`}>
                                {user.isActive ? 'Active' : 'Disabled'}
                              </span>
                            </td>
                            <td>
                              <button type="button" className="link-button" onClick={() => setAppUserForm({ id: user.id, email: user.email, fullName: user.fullName, contactNumber: user.contactNumber ?? '', role: user.role, isActive: user.isActive })}>
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </article>
          ) : null}
        </section>
      </section>
    </section>
  )
}