import { useEffect, useMemo, useState } from 'react'
import {
  fetchAdminAliases,
  fetchAdminCandidates,
  fetchAdminProfiles,
  fetchAdminTransferReport,
  fetchAdminWards,
  fetchAdminZones,
  saveAdminRecord,
  type AdminPayload,
  type AdminAlias,
  type AdminCandidate,
  type AdminProfile,
  type AdminTransferReport,
  type AdminWard,
  type AdminZone,
} from '../lib/adminData'

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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [zoneForm, setZoneForm] = useState<ZoneFormState>(emptyZoneForm)
  const [wardForm, setWardForm] = useState<WardFormState>(emptyWardForm)
  const [candidateForm, setCandidateForm] = useState<CandidateFormState>(emptyCandidateForm)
  const [aliasForm, setAliasForm] = useState<AliasFormState>(emptyAliasForm)
  const [profileForm, setProfileForm] = useState<ProfileFormState>(emptyProfileForm)

  const wardOptions = useMemo(() => wards, [wards])
  const candidateOptions = useMemo(() => candidates, [candidates])

  async function loadAdminData() {
    setLoading(true)
    setError(null)
    try {
      const [zoneData, wardData, candidateData, aliasData, profileData, reportData] = await Promise.all([
        fetchAdminZones(),
        fetchAdminWards(),
        fetchAdminCandidates(),
        fetchAdminAliases(),
        fetchAdminProfiles(),
        fetchAdminTransferReport(),
      ])

      setZones(zoneData)
      setWards(wardData)
      setCandidates(candidateData)
      setAliases(aliasData)
      setProfiles(profileData)
      setReport(reportData)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load admin CMS data.')
    } finally {
      setLoading(false)
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

  return (
    <section className="admin-shell">
      <section className="admin-hero panel">
        <div>
          <p className="eyebrow">Internal CMS</p>
          <h2>Admin Portal</h2>
          <p className="muted">Manage candidate profiles, canonical records, and reference tables for dropdowns.</p>
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

      <section className="admin-grid">
        <article className="panel admin-card">
          <div className="sheet-controls">
            <h2>Candidate Profile Capture</h2>
          </div>
          <form
            className="form-grid"
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
              Status
              <select value={profileForm.status} onChange={(event) => setProfileForm((current) => ({ ...current, status: event.target.value as ProfileFormState['status'] }))}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>
              Phone
              <input value={profileForm.contactPhone} onChange={(event) => setProfileForm((current) => ({ ...current, contactPhone: event.target.value }))} />
            </label>
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
            <div className="action-row full-span">
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
                    <td>{profile.status}</td>
                    <td>{profile.zoneName ?? '-'} / {profile.wardNumber ? `Ward ${profile.wardNumber}` : '-'}</td>
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

        <article className="panel admin-card">
          <h2>Reference Data</h2>
          <div className="admin-subgrid">
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
                  <button type="submit" disabled={saving === 'zone'}>{saving === 'zone' ? 'Saving...' : 'Save zone'}</button>
                  <button type="button" className="secondary-button" onClick={() => setZoneForm(emptyZoneForm)}>Reset</button>
                </div>
              </form>
              <div className="cms-list-wrap">
                <table className="zone-table">
                  <thead><tr><th>Zone</th><th>Coordinator</th><th /></tr></thead>
                  <tbody>
                    {zones.map((zone) => (
                      <tr key={zone.id}>
                        <td>{zone.name}</td>
                        <td>{zone.coordinatorName ?? '-'}</td>
                        <td><button type="button" className="link-button" onClick={() => setZoneForm({ id: zone.id, name: zone.name, coordinatorName: zone.coordinatorName ?? '' })}>Edit</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

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
                      <option key={zone.id} value={zone.id}>{zone.name}</option>
                    ))}
                  </select>
                </label>
                <div className="action-row">
                  <button type="submit" disabled={saving === 'ward'}>{saving === 'ward' ? 'Saving...' : 'Save ward'}</button>
                  <button type="button" className="secondary-button" onClick={() => setWardForm(emptyWardForm)}>Reset</button>
                </div>
              </form>
              <div className="cms-list-wrap">
                <table className="zone-table">
                  <thead><tr><th>Ward</th><th>Zone</th><th /></tr></thead>
                  <tbody>
                    {wards.map((ward) => (
                      <tr key={ward.id}>
                        <td>Ward {ward.wardNumber}</td>
                        <td>{ward.zoneName ?? '-'}</td>
                        <td><button type="button" className="link-button" onClick={() => setWardForm({ id: ward.id, wardNumber: String(ward.wardNumber), zoneId: ward.zoneId ?? '' })}>Edit</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

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
                  <button type="submit" disabled={saving === 'candidate'}>{saving === 'candidate' ? 'Saving...' : 'Save candidate'}</button>
                  <button type="button" className="secondary-button" onClick={() => setCandidateForm(emptyCandidateForm)}>Reset</button>
                </div>
              </form>
              <div className="cms-list-wrap">
                <table className="zone-table">
                  <thead><tr><th>Name</th><th>Active</th><th /></tr></thead>
                  <tbody>
                    {candidates.map((candidate) => (
                      <tr key={candidate.id}>
                        <td>{candidate.fullName}</td>
                        <td>{candidate.isActive ? 'Yes' : 'No'}</td>
                        <td><button type="button" className="link-button" onClick={() => setCandidateForm({ id: candidate.id, fullName: candidate.fullName, isActive: candidate.isActive })}>Edit</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

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
                      <option key={candidate.id} value={candidate.id}>{candidate.fullName}</option>
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
                  <button type="submit" disabled={saving === 'alias'}>{saving === 'alias' ? 'Saving...' : 'Save alias'}</button>
                  <button type="button" className="secondary-button" onClick={() => setAliasForm(emptyAliasForm)}>Reset</button>
                </div>
              </form>
              <div className="cms-list-wrap">
                <table className="zone-table">
                  <thead><tr><th>Alias</th><th>Candidate</th><th /></tr></thead>
                  <tbody>
                    {aliases.map((alias) => (
                      <tr key={alias.id}>
                        <td>{alias.aliasName}</td>
                        <td>{alias.candidateName ?? '-'}</td>
                        <td><button type="button" className="link-button" onClick={() => setAliasForm({ id: alias.id, candidateId: alias.candidateId, aliasName: alias.aliasName, sourceNote: alias.sourceNote ?? '' })}>Edit</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </article>

        <article className="panel admin-card">
          <h2>Transfer Report</h2>
          <div className="kpi-grid report-grid">
            <div><p>Zones</p><strong>{report?.zoneCount ?? 0}</strong></div>
            <div><p>Wards</p><strong>{report?.wardCount ?? 0}</strong></div>
            <div><p>Candidates</p><strong>{report?.candidateCount ?? 0}</strong></div>
            <div><p>Aliases</p><strong>{report?.aliasCount ?? 0}</strong></div>
            <div><p>Profiles</p><strong>{report?.profileCount ?? 0}</strong></div>
            <div><p>Nominations</p><strong>{report?.nominationCount ?? 0}</strong></div>
          </div>
          <div className="mini-panel">
            <h3>Latest batch</h3>
            {report?.latestBatch ? (
              <dl className="batch-details">
                <div><dt>File</dt><dd>{report.latestBatch.sourceFilename}</dd></div>
                <div><dt>Status</dt><dd>{report.latestBatch.status}</dd></div>
                <div><dt>Processed</dt><dd>{new Date(report.latestBatch.processedAt).toLocaleString()}</dd></div>
                <div><dt>Checksum</dt><dd>{report.latestBatch.sourceChecksum ?? '-'}</dd></div>
                <div className="full-span"><dt>Error</dt><dd>{report.latestBatch.errorSummary ?? 'No errors recorded.'}</dd></div>
              </dl>
            ) : (
              <p className="muted">No batch metadata yet.</p>
            )}
          </div>
        </article>
      </section>
    </section>
  )
}