import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
}

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required field: ${field}`)
  }
  return value.trim()
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const parts = (['message', 'hint', 'details'] as const)
      .map((k) => (k in error ? (error as Record<string, unknown>)[k] : null))
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    if (parts.length > 0) return parts.join(' | ')
  }
  return 'Failed to process nominations request.'
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type UploadRow = {
  wardNumber: unknown
  candidateFullName: unknown
  vote: unknown
}

type UploadPayload = {
  action: 'bulk_upload'
  sourceFilename: unknown
  rows: unknown
}

type ManualCapturePayload = {
  action: 'manual_capture'
  wardId: unknown
  candidateIds: unknown
}

type NominationsPayload = UploadPayload | ManualCapturePayload | { action?: unknown }

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export const handler = async (event: { httpMethod?: string; body?: string | null }) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { ok: false, error: 'Missing Supabase admin environment variables.' })
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed.' })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createClient(supabaseUrl, serviceRoleKey) as any

  try {
    const payload = JSON.parse(event.body ?? '{}') as NominationsPayload

    if (payload.action === 'bulk_upload') {
      return await handleBulkUpload(adminClient, payload as UploadPayload)
    }

    if (payload.action === 'manual_capture') {
      return await handleManualCapture(adminClient, payload as ManualCapturePayload)
    }

    return json(400, { ok: false, error: 'Unknown action. Expected bulk_upload or manual_capture.' })
  } catch (error) {
    return json(400, { ok: false, error: readErrorMessage(error) })
  }
}

// ---------------------------------------------------------------------------
// Bulk upload
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleBulkUpload(adminClient: any, payload: UploadPayload) {
  const sourceFilename = requiredString(payload.sourceFilename, 'sourceFilename')

  if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
    return json(400, { ok: false, error: 'rows must be a non-empty array.' })
  }

  const rawRows = payload.rows as UploadRow[]

  // ------------------------------------------------------------------
  // 1. Load reference data for validation.
  // ------------------------------------------------------------------
  const [wardsResult, candidatesResult] = await Promise.all([
    adminClient.from('wards').select('id, ward_number'),
    adminClient.from('candidates').select('id, full_name').eq('is_active', true),
  ])

  if (wardsResult.error) throw wardsResult.error
  if (candidatesResult.error) throw candidatesResult.error

  const wardMap = new Map<number, string>()
  for (const row of wardsResult.data as Array<{ id: string; ward_number: number }>) {
    wardMap.set(row.ward_number, row.id)
  }

  const candidateMap = new Map<string, string>()
  for (const row of candidatesResult.data as Array<{ id: string; full_name: string }>) {
    candidateMap.set(row.full_name.trim().toLowerCase(), row.id)
  }

  // ------------------------------------------------------------------
  // 2. Validate rows.
  // ------------------------------------------------------------------
  type ValidRow = { wardId: string; wardNumber: number; candidateId: string; candidateName: string }
  const validRows: ValidRow[] = []
  const rejectedRows: Array<{ rowIndex: number; wardNumber: unknown; candidate: unknown; reason: string }> = []
  const seenPairs = new Set<string>()

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]
    const rowNum = i + 1
    const wardNumber = Number(raw.wardNumber)
    const candidateName = typeof raw.candidateFullName === 'string' ? raw.candidateFullName.trim() : ''
    const vote = Number(raw.vote)

    if (!Number.isInteger(wardNumber) || wardNumber <= 0) {
      rejectedRows.push({ rowIndex: rowNum, wardNumber: raw.wardNumber, candidate: candidateName, reason: 'Invalid ward number.' })
      continue
    }

    if (vote !== 0 && vote !== 1) {
      rejectedRows.push({ rowIndex: rowNum, wardNumber: wardNumber, candidate: candidateName, reason: `vote must be 0 or 1, got: ${String(raw.vote)}` })
      continue
    }

    if (vote === 0) {
      // vote = 0 rows are accepted but produce no nomination row; skip silently.
      continue
    }

    if (!candidateName) {
      rejectedRows.push({ rowIndex: rowNum, wardNumber: wardNumber, candidate: raw.candidateFullName, reason: 'Candidate full name is blank.' })
      continue
    }

    const wardId = wardMap.get(wardNumber)
    if (!wardId) {
      rejectedRows.push({ rowIndex: rowNum, wardNumber: wardNumber, candidate: candidateName, reason: `Ward ${wardNumber} is not registered in the reference table.` })
      continue
    }

    const candidateId = candidateMap.get(candidateName.toLowerCase())
    if (!candidateId) {
      rejectedRows.push({ rowIndex: rowNum, wardNumber: wardNumber, candidate: candidateName, reason: `Candidate "${candidateName}" is not found or is inactive.` })
      continue
    }

    const pairKey = `${wardId}::${candidateId}`
    if (seenPairs.has(pairKey)) {
      rejectedRows.push({ rowIndex: rowNum, wardNumber: wardNumber, candidate: candidateName, reason: 'Duplicate (ward, candidate) pair in this submission.' })
      continue
    }
    seenPairs.add(pairKey)

    validRows.push({ wardId, wardNumber, candidateId, candidateName })
  }

  // ------------------------------------------------------------------
  // 3. Check per-ward vote totals.
  // ------------------------------------------------------------------
  const wardGroups = new Map<string, { wardNumber: number; candidateIds: string[] }>()
  for (const row of validRows) {
    if (!wardGroups.has(row.wardId)) {
      wardGroups.set(row.wardId, { wardNumber: row.wardNumber, candidateIds: [] })
    }
    wardGroups.get(row.wardId)!.candidateIds.push(row.candidateId)
  }

  const wardWarnings: string[] = []
  const hardRejectedWards: string[] = []

  for (const [wardId, group] of wardGroups) {
    if (group.candidateIds.length > 6) {
      hardRejectedWards.push(wardId)
      rejectedRows.push({
        rowIndex: -1,
        wardNumber: group.wardNumber,
        candidate: '(all candidates for this ward)',
        reason: `Ward ${group.wardNumber} has ${group.candidateIds.length} votes — exceeds the maximum of 6. All rows for this ward are rejected.`,
      })
    } else if (group.candidateIds.length < 6) {
      wardWarnings.push(`Ward ${group.wardNumber} has ${group.candidateIds.length} / 6 votes (partial allocation).`)
    }
  }

  for (const wardId of hardRejectedWards) {
    wardGroups.delete(wardId)
  }

  if (wardGroups.size === 0) {
    return json(422, {
      ok: false,
      error: 'No valid wards to process after validation.',
      rejectedRows,
      warnings: wardWarnings,
    })
  }

  // ------------------------------------------------------------------
  // 4. Create ingestion batch record.
  // ------------------------------------------------------------------
  const batchInsert = await adminClient
    .from('ingestion_batches')
    .insert({
      source_filename: sourceFilename,
      status: 'PENDING',
    })
    .select('id')
    .single()

  if (batchInsert.error) throw batchInsert.error
  const batchId: string = (batchInsert.data as { id: string }).id

  // ------------------------------------------------------------------
  // 5. Persist raw rows to workbook_sheet_rows for audit.
  // ------------------------------------------------------------------
  const auditRows = rawRows.map((row, idx) => ({
    batch_id: batchId,
    sheet_name: 'Votes',
    row_index: idx + 1,
    row_data: [row.wardNumber, row.candidateFullName, row.vote],
  }))

  const auditInsert = await adminClient.from('workbook_sheet_rows').insert(auditRows)
  if (auditInsert.error) {
    // Non-fatal: audit persistence failure should not block the actual write.
    wardWarnings.push(`Audit row persistence failed: ${auditInsert.error.message}`)
  }

  // ------------------------------------------------------------------
  // 6. Call replace_ward_nominations RPC per ward.
  // ------------------------------------------------------------------
  let votesInserted = 0

  for (const [wardId, group] of wardGroups) {
    const rpcResult = await adminClient.rpc('replace_ward_nominations', {
      p_ward_id: wardId,
      p_candidate_ids: group.candidateIds,
      p_batch_id: batchId,
    })

    if (rpcResult.error) {
      await adminClient
        .from('ingestion_batches')
        .update({ status: 'FAILED', error_summary: rpcResult.error.message })
        .eq('id', batchId)
      return json(422, { ok: false, error: `Failed to write nominations for Ward ${group.wardNumber}: ${rpcResult.error.message}`, batchId })
    }

    votesInserted += group.candidateIds.length
  }

  // ------------------------------------------------------------------
  // 7. Mark batch SUCCESS.
  // ------------------------------------------------------------------
  await adminClient
    .from('ingestion_batches')
    .update({ status: 'SUCCESS' })
    .eq('id', batchId)

  return json(200, {
    ok: true,
    batchId,
    wardsProcessed: wardGroups.size,
    votesInserted,
    warnings: wardWarnings,
    rejectedRows,
  })
}

// ---------------------------------------------------------------------------
// Manual capture
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleManualCapture(adminClient: any, payload: ManualCapturePayload) {
  const wardId = requiredString(payload.wardId, 'wardId')

  if (!Array.isArray(payload.candidateIds)) {
    return json(400, { ok: false, error: 'candidateIds must be an array.' })
  }

  const candidateIds = payload.candidateIds as unknown[]
  if (candidateIds.length > 6) {
    return json(422, {
      ok: false,
      error: `Cannot cast more than 6 votes per ward; ${candidateIds.length} candidates provided.`,
    })
  }

  for (const cid of candidateIds) {
    if (typeof cid !== 'string' || cid.trim() === '') {
      return json(400, { ok: false, error: 'Each candidateId must be a non-empty string.' })
    }
  }

  const validCandidateIds = (candidateIds as string[]).map((id) => id.trim())

  // Verify ward exists.
  const wardCheck = await adminClient.from('wards').select('id').eq('id', wardId).maybeSingle()
  if (wardCheck.error) throw wardCheck.error
  if (!wardCheck.data) {
    return json(422, { ok: false, error: `Ward ${wardId} does not exist.` })
  }

  // Verify all candidates exist and are active.
  if (validCandidateIds.length > 0) {
    const candidateCheck = await adminClient
      .from('candidates')
      .select('id')
      .in('id', validCandidateIds)
      .eq('is_active', true)

    if (candidateCheck.error) throw candidateCheck.error
    const foundIds = new Set((candidateCheck.data as Array<{ id: string }>).map((r) => r.id))
    const missing = validCandidateIds.filter((id) => !foundIds.has(id))
    if (missing.length > 0) {
      return json(422, {
        ok: false,
        error: `The following candidate IDs are not found or are inactive: ${missing.join(', ')}`,
      })
    }
  }

  // Create batch record.
  const batchInsert = await adminClient
    .from('ingestion_batches')
    .insert({ source_filename: 'manual-entry', status: 'PENDING' })
    .select('id')
    .single()

  if (batchInsert.error) throw batchInsert.error
  const batchId: string = (batchInsert.data as { id: string }).id

  // Call RPC.
  const rpcResult = await adminClient.rpc('replace_ward_nominations', {
    p_ward_id: wardId,
    p_candidate_ids: validCandidateIds.length > 0 ? validCandidateIds : null,
    p_batch_id: batchId,
  })

  if (rpcResult.error) {
    await adminClient
      .from('ingestion_batches')
      .update({ status: 'FAILED', error_summary: rpcResult.error.message })
      .eq('id', batchId)
    return json(422, { ok: false, error: rpcResult.error.message, batchId })
  }

  await adminClient
    .from('ingestion_batches')
    .update({ status: 'SUCCESS' })
    .eq('id', batchId)

  return json(200, {
    ok: true,
    batchId,
    votesInserted: validCandidateIds.length,
  })
}
