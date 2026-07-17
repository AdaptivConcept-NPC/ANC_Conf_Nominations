import { supabase } from './supabaseClient'

export type ZoneOption = {
  id: string
  name: string
}

export type WardOption = {
  id: string
  wardNumber: number
  zoneName: string | null
}

export type NominationRecord = {
  candidateName: string
  zoneName: string
  wardNumber: number
  voteCount: number
}

type RawZone = {
  id: string
  name: string
}

type RawWard = {
  id: string
  ward_number: number
  zones: Array<{ name: string }> | { name: string } | null
}

type RawNomination = {
  vote_count: number
  candidates: Array<{ full_name: string }> | { full_name: string } | null
  wards: {
    ward_number: number
    zones: Array<{ name: string }> | { name: string } | null
  }[] | {
    ward_number: number
    zones: Array<{ name: string }> | { name: string } | null
  } | null
}

function firstOrNull<T>(value: T[] | T | null): T | null {
  if (!value) {
    return null
  }
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function fetchZones(): Promise<ZoneOption[]> {
  const { data, error } = await supabase
    .from('zones')
    .select('id, name')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to load zones: ${error.message}`)
  }

  return (data as RawZone[]).map((row) => ({
    id: row.id,
    name: row.name,
  }))
}

export async function fetchWards(): Promise<WardOption[]> {
  const { data, error } = await supabase
    .from('wards')
    .select('id, ward_number, zones(name)')
    .order('ward_number', { ascending: true })

  if (error) {
    throw new Error(`Failed to load wards: ${error.message}`)
  }

  return (data as RawWard[]).map((row) => ({
    id: row.id,
    wardNumber: row.ward_number,
    zoneName: firstOrNull(row.zones)?.name ?? null,
  }))
}

export async function fetchNominations(): Promise<NominationRecord[]> {
  const { data, error } = await supabase
    .from('nominations')
    .select('vote_count, candidates(full_name), wards(ward_number, zones(name))')

  if (error) {
    throw new Error(`Failed to load nominations: ${error.message}`)
  }

  return (data as RawNomination[])
    .map((row) => {
      const candidate = firstOrNull(row.candidates)
      const ward = firstOrNull(row.wards)
      const zone = ward ? firstOrNull(ward.zones) : null

      return {
        vote_count: row.vote_count,
        candidate,
        ward,
        zone,
      }
    })
    .filter((row) => row.candidate && row.ward && row.zone)
    .map((row) => ({
      candidateName: row.candidate?.full_name ?? 'Unknown Candidate',
      zoneName: row.zone?.name ?? 'Unknown Zone',
      wardNumber: row.ward?.ward_number ?? -1,
      voteCount: row.vote_count,
    }))
}

export function aggregateByCandidate(records: NominationRecord[]): Array<{ name: string; totalVotes: number }> {
  const totals = new Map<string, number>()

  for (const record of records) {
    totals.set(record.candidateName, (totals.get(record.candidateName) ?? 0) + record.voteCount)
  }

  return Array.from(totals.entries())
    .map(([name, totalVotes]) => ({ name, totalVotes }))
    .sort((a, b) => b.totalVotes - a.totalVotes)
}

export function aggregateByZone(records: NominationRecord[]): Array<{ zone: string; totalVotes: number }> {
  const totals = new Map<string, number>()

  for (const record of records) {
    totals.set(record.zoneName, (totals.get(record.zoneName) ?? 0) + record.voteCount)
  }

  return Array.from(totals.entries())
    .map(([zone, totalVotes]) => ({ zone, totalVotes }))
    .sort((a, b) => b.totalVotes - a.totalVotes)
}
