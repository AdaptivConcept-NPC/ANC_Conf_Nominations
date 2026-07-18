import { supabase } from './supabaseClient'

type RawZone = {
  id: string
  name: string
  coordinator_name: string | null
  created_at?: string
  updated_at?: string
}

type RawWard = {
  id: string
  ward_number: number
  zone_id: string | null
  zones: Array<{ name: string }> | { name: string } | null
}

type RawCandidate = {
  id: string
  full_name: string
  is_active: boolean
}

type RawCandidateAlias = {
  id: string
  candidate_id: string
  alias_name: string
  source_note: string | null
  candidates: Array<{ full_name: string }> | { full_name: string } | null
}

type RawCandidateProfile = {
  id: string
  candidate_id: string
  display_name: string
  photo_url: string | null
  short_bio: string | null
  contact_phone: string | null
  contact_email: string | null
  zone_id: string | null
  ward_id: string | null
  status: 'draft' | 'active' | 'archived'
  notes: string | null
  candidates: Array<{ full_name: string }> | { full_name: string } | null
  zones: Array<{ name: string }> | { name: string } | null
  wards: Array<{ ward_number: number }> | { ward_number: number } | null
}

type RawBatch = {
  id: string
  source_filename: string
  source_checksum: string | null
  processed_at: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  error_summary: string | null
}

export type AdminZone = {
  id: string
  name: string
  coordinatorName: string | null
}

export type AdminWard = {
  id: string
  wardNumber: number
  zoneId: string | null
  zoneName: string | null
}

export type AdminCandidate = {
  id: string
  fullName: string
  isActive: boolean
}

export type AdminAlias = {
  id: string
  candidateId: string
  candidateName: string | null
  aliasName: string
  sourceNote: string | null
}

export type AdminProfile = {
  id: string
  candidateId: string
  candidateName: string | null
  displayName: string
  photoUrl: string | null
  shortBio: string | null
  contactPhone: string | null
  contactEmail: string | null
  zoneId: string | null
  zoneName: string | null
  wardId: string | null
  wardNumber: number | null
  status: 'draft' | 'active' | 'archived'
  notes: string | null
}

export type AdminBatch = {
  id: string
  sourceFilename: string
  sourceChecksum: string | null
  processedAt: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  errorSummary: string | null
}

export type AdminTransferReport = {
  zoneCount: number
  wardCount: number
  candidateCount: number
  aliasCount: number
  profileCount: number
  nominationCount: number
  latestBatch: AdminBatch | null
}

function firstOrNull<T>(value: T[] | T | null): T | null {
  if (!value) {
    return null
  }
  return Array.isArray(value) ? (value[0] ?? null) : value
}

async function countRows(table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true })
  if (error) {
    throw new Error(`Failed to count ${table}: ${error.message}`)
  }
  return count ?? 0
}

export async function fetchAdminTransferReport(): Promise<AdminTransferReport> {
  const [zoneCount, wardCount, candidateCount, aliasCount, profileCount, nominationCount, latestBatchResult] = await Promise.all([
    countRows('zones'),
    countRows('wards'),
    countRows('candidates'),
    countRows('candidate_aliases'),
    countRows('candidate_profiles'),
    countRows('nominations'),
    supabase
      .from('ingestion_batches')
      .select('id, source_filename, source_checksum, processed_at, status, error_summary')
      .order('processed_at', { ascending: false })
      .limit(1),
  ])

  if (latestBatchResult.error) {
    throw new Error(`Failed to load latest batch: ${latestBatchResult.error.message}`)
  }

  const latestBatch = firstOrNull(latestBatchResult.data as RawBatch[] | RawBatch | null)

  return {
    zoneCount,
    wardCount,
    candidateCount,
    aliasCount,
    profileCount,
    nominationCount,
    latestBatch: latestBatch
      ? {
          id: latestBatch.id,
          sourceFilename: latestBatch.source_filename,
          sourceChecksum: latestBatch.source_checksum,
          processedAt: latestBatch.processed_at,
          status: latestBatch.status,
          errorSummary: latestBatch.error_summary,
        }
      : null,
  }
}

export async function fetchAdminZones(): Promise<AdminZone[]> {
  const { data, error } = await supabase
    .from('zones')
    .select('id, name, coordinator_name')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to load zones: ${error.message}`)
  }

  return (data as RawZone[]).map((row) => ({
    id: row.id,
    name: row.name,
    coordinatorName: row.coordinator_name,
  }))
}

export async function fetchAdminWards(): Promise<AdminWard[]> {
  const { data, error } = await supabase
    .from('wards')
    .select('id, ward_number, zone_id, zones(name)')
    .order('ward_number', { ascending: true })

  if (error) {
    throw new Error(`Failed to load wards: ${error.message}`)
  }

  return (data as RawWard[]).map((row) => ({
    id: row.id,
    wardNumber: row.ward_number,
    zoneId: row.zone_id,
    zoneName: firstOrNull(row.zones)?.name ?? null,
  }))
}

export async function fetchAdminCandidates(): Promise<AdminCandidate[]> {
  const { data, error } = await supabase
    .from('candidates')
    .select('id, full_name, is_active')
    .order('full_name', { ascending: true })

  if (error) {
    throw new Error(`Failed to load candidates: ${error.message}`)
  }

  return (data as RawCandidate[]).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    isActive: row.is_active,
  }))
}

export async function fetchAdminAliases(): Promise<AdminAlias[]> {
  const { data, error } = await supabase
    .from('candidate_aliases')
    .select('id, candidate_id, alias_name, source_note, candidates(full_name)')
    .order('alias_name', { ascending: true })

  if (error) {
    throw new Error(`Failed to load aliases: ${error.message}`)
  }

  return (data as RawCandidateAlias[]).map((row) => ({
    id: row.id,
    candidateId: row.candidate_id,
    candidateName: firstOrNull(row.candidates)?.full_name ?? null,
    aliasName: row.alias_name,
    sourceNote: row.source_note,
  }))
}

export async function fetchAdminProfiles(): Promise<AdminProfile[]> {
  const { data, error } = await supabase
    .from('candidate_profiles')
    .select('id, candidate_id, display_name, photo_url, short_bio, contact_phone, contact_email, zone_id, ward_id, status, notes, candidates(full_name), zones(name), wards(ward_number)')
    .order('display_name', { ascending: true })

  if (error) {
    throw new Error(`Failed to load candidate profiles: ${error.message}`)
  }

  return (data as RawCandidateProfile[]).map((row) => ({
    id: row.id,
    candidateId: row.candidate_id,
    candidateName: firstOrNull(row.candidates)?.full_name ?? null,
    displayName: row.display_name,
    photoUrl: row.photo_url,
    shortBio: row.short_bio,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    zoneId: row.zone_id,
    zoneName: firstOrNull(row.zones)?.name ?? null,
    wardId: row.ward_id,
    wardNumber: firstOrNull(row.wards)?.ward_number ?? null,
    status: row.status,
    notes: row.notes,
  }))
}

export type AdminPayload =
  | { resource: 'zone'; id?: string; name: string; coordinatorName?: string | null }
  | { resource: 'ward'; id?: string; wardNumber: number; zoneId?: string | null }
  | { resource: 'candidate'; id?: string; fullName: string; isActive: boolean }
  | { resource: 'alias'; id?: string; candidateId: string; aliasName: string; sourceNote?: string | null }
  | {
      resource: 'profile'
      id?: string
      candidateId: string
      displayName: string
      photoUrl?: string | null
      shortBio?: string | null
      contactPhone?: string | null
      contactEmail?: string | null
      zoneId?: string | null
      wardId?: string | null
      status: 'draft' | 'active' | 'archived'
      notes?: string | null
    }

export async function saveAdminRecord(payload: AdminPayload) {
  const response = await fetch('/.netlify/functions/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Failed to save admin record.')
  }

  return response.json() as Promise<{ ok: boolean }>
}