import ExcelJS from 'exceljs'
import { supabase } from './supabaseClient'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type VotingTemplateWard = {
  wardNumber: number
}

export type VotingTemplateCandidate = {
  id: string
  fullName: string
}

export type ParsedVoteRow = {
  rowIndex: number
  wardNumber: number | null
  candidateFullName: string
  vote: number | null
  parseError: string | null
}

export type BulkUploadResult = {
  ok: boolean
  batchId?: string
  wardsProcessed?: number
  votesInserted?: number
  warnings?: string[]
  rejectedRows?: Array<{ rowIndex: number; wardNumber: unknown; candidate: unknown; reason: string }>
  error?: string
}

export type ManualCaptureResult = {
  ok: boolean
  batchId?: string
  votesInserted?: number
  error?: string
}

// ---------------------------------------------------------------------------
// Fetch active candidates for template/form
// ---------------------------------------------------------------------------
export async function fetchActiveCandidatesForVoting(): Promise<VotingTemplateCandidate[]> {
  const { data, error } = await supabase
    .from('candidates')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  if (error) {
    throw new Error(`Failed to load active candidates: ${error.message}`)
  }

  return (data as Array<{ id: string; full_name: string }>).map((row) => ({
    id: row.id,
    fullName: row.full_name,
  }))
}

// ---------------------------------------------------------------------------
// Download Excel template
// ---------------------------------------------------------------------------
export async function downloadVotingTemplate(
  wards: VotingTemplateWard[],
  activeCandidates: VotingTemplateCandidate[],
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ANC Ekurhuleni Nominations System'
  workbook.created = new Date()

  // -----------------------------------------------------------------------
  // Instructions sheet
  // -----------------------------------------------------------------------
  const instructionsSheet = workbook.addWorksheet('Instructions')
  instructionsSheet.getColumn(1).width = 90

  const instructionLines: Array<[string, boolean]> = [
    ['ANC Ekurhuleni BGM 2026 — Voting Nominations Template', true],
    ['', false],
    ['HOW TO USE THIS TEMPLATE', true],
    ['1. Use the "Votes" sheet to capture nomination results.', false],
    ['2. Each row represents one candidate in one ward.', false],
    ['3. Set Vote (0 or 1) to 1 if the candidate received a vote from that ward, or 0 if not.', false],
    ['4. Upload the completed file via the Admin CMS → Report tab → Bulk Upload.', false],
    ['', false],
    ['AUTHORITATIVE VOTING RULES', true],
    ['Rule 1 — Six Votes Per Branch:', true],
    ['  Each Ward/Branch may cast at most 6 votes across all candidates.', false],
    ['  Fewer than 6 votes is permitted (partial allocation).', false],
    ['  More than 6 votes is rejected.', false],
    ['', false],
    ['Rule 2 — One Vote Per Candidate Per Branch:', true],
    ['  A candidate may receive at most 1 vote from any single ward.', false],
    ['  The Vote column must be 0 or 1 — no other values.', false],
    ['', false],
    ['Rule 3 — Candidate Score = SUM Across All Branches:', true],
    ['  A candidate\'s total score is the sum of their votes across all wards.', false],
    ['', false],
    ['IMPORTANT — DO NOT MODIFY COLUMN HEADERS', true],
    ['  The upload parser requires columns: Ward Number | Candidate Full Name | Vote (0 or 1)', false],
    ['  Candidate names must match the system exactly (use the dropdown provided).', false],
    ['', false],
    ['DATA QUALITY NOTICE', true],
    ['  The initial data transferred to the system contained errors (vote_count > 1 per ward/candidate).', false],
    ['  All wards must be re-submitted using this template to ensure accurate totals.', false],
  ]

  for (const [text, bold] of instructionLines) {
    const row = instructionsSheet.addRow([text])
    if (bold) {
      row.getCell(1).font = { bold: true, size: 11 }
    }
  }

  // -----------------------------------------------------------------------
  // Votes sheet — long/tall table, one row per ward+candidate combo
  // -----------------------------------------------------------------------
  const votesSheet = workbook.addWorksheet('Votes')

  // Build all rows: every candidate × every ward = full cross-product (user fills in 0/1).
  const headers = ['Ward Number', 'Candidate Full Name', 'Vote (0 or 1)']
  votesSheet.addRow(headers)

  const headerRow = votesSheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF006400' },
  }
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }

  // Add data rows: sorted wards, then candidates.
  const sortedWards = [...wards].sort((a, b) => a.wardNumber - b.wardNumber)
  const dataStartRow = 2

  for (const ward of sortedWards) {
    for (const candidate of activeCandidates) {
      votesSheet.addRow([ward.wardNumber, candidate.fullName, 0])
    }
  }

  const lastDataRow = 1 + sortedWards.length * activeCandidates.length

  // Column widths.
  votesSheet.getColumn(1).width = 14
  votesSheet.getColumn(2).width = 36
  votesSheet.getColumn(3).width = 16

  // Data validation — Vote column: allow only 0 or 1.
  // Cast to any: exceljs runtime supports dataValidations but TS types vary by version.
  const ws = votesSheet as unknown as { dataValidations: { add: (ref: string, rules: Record<string, unknown>) => void } }
  if (lastDataRow >= dataStartRow) {
    ws.dataValidations.add(`C${dataStartRow}:C${lastDataRow}`, {
      type: 'list',
      allowBlank: false,
      formulae: ['"0,1"'],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Invalid vote value',
      error: 'Vote must be 0 (no vote) or 1 (voted).',
    })

    // Data validation — Candidate column: list of active candidate names.
    const candidateNamesCsv = activeCandidates.map((c) => c.fullName).join(',')
    if (candidateNamesCsv.length <= 255) {
      // Excel inline list limit is 255 chars; fall back gracefully if it exceeds that.
      ws.dataValidations.add(`B${dataStartRow}:B${lastDataRow}`, {
        type: 'list',
        allowBlank: false,
        formulae: [`"${candidateNamesCsv}"`],
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Unrecognised candidate',
        error: 'This candidate name does not match a registered active candidate.',
      })
    }
  }

  // Add an Excel Table so the data is filterable.
  if (lastDataRow >= dataStartRow) {
    votesSheet.addTable({
      name: 'VotesTable',
      ref: `A1:C${lastDataRow}`,
      headerRow: true,
      style: {
        theme: 'TableStyleMedium7',
        showRowStripes: true,
      },
      columns: [
        { name: 'Ward Number', filterButton: true },
        { name: 'Candidate Full Name', filterButton: true },
        { name: 'Vote (0 or 1)', filterButton: true },
      ],
      rows: sortedWards.flatMap((ward) =>
        activeCandidates.map((c) => [ward.wardNumber, c.fullName, 0]),
      ),
    })
  }

  // -----------------------------------------------------------------------
  // Trigger download in the browser
  // -----------------------------------------------------------------------
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `ANC_Nominations_Template_${new Date().toISOString().slice(0, 10)}.xlsx`
  anchor.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Parse an uploaded workbook
// ---------------------------------------------------------------------------
export async function parseVotingWorkbook(file: File): Promise<{
  rows: ParsedVoteRow[]
  parseErrors: string[]
}> {
  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()

  try {
    await workbook.xlsx.load(buffer)
  } catch {
    return { rows: [], parseErrors: ['Could not read the file as a valid Excel workbook (.xlsx).'] }
  }

  const votesSheet = workbook.getWorksheet('Votes')
  if (!votesSheet) {
    return { rows: [], parseErrors: ['The workbook does not contain a sheet named "Votes".'] }
  }

  // Identify header row (first row).
  const headerRow = votesSheet.getRow(1)
  const col1 = String(headerRow.getCell(1).value ?? '').trim().toLowerCase()
  const col2 = String(headerRow.getCell(2).value ?? '').trim().toLowerCase()
  const col3 = String(headerRow.getCell(3).value ?? '').trim().toLowerCase()

  if (!col1.includes('ward') || !col2.includes('candidate') || !col3.includes('vote')) {
    return {
      rows: [],
      parseErrors: [
        'Unexpected column headers. Expected columns: "Ward Number", "Candidate Full Name", "Vote (0 or 1)". ' +
          `Found: "${String(headerRow.getCell(1).value)}", "${String(headerRow.getCell(2).value)}", "${String(headerRow.getCell(3).value)}".`,
      ],
    }
  }

  const rows: ParsedVoteRow[] = []
  const parseErrors: string[] = []

  votesSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // skip header

    const rawWard = row.getCell(1).value
    const rawCandidate = row.getCell(2).value
    const rawVote = row.getCell(3).value

    // Skip completely blank rows.
    if (rawWard === null && rawCandidate === null && rawVote === null) return

    const wardNumber = rawWard !== null && rawWard !== '' ? Number(rawWard) : null
    const candidateFullName = typeof rawCandidate === 'string' ? rawCandidate.trim() : String(rawCandidate ?? '').trim()
    const vote = rawVote !== null && rawVote !== '' ? Number(rawVote) : null

    let parseError: string | null = null

    if (wardNumber === null || !Number.isInteger(wardNumber) || wardNumber <= 0) {
      parseError = 'Invalid ward number.'
    } else if (!candidateFullName) {
      parseError = 'Candidate full name is blank.'
    } else if (vote === null || (vote !== 0 && vote !== 1)) {
      parseError = `Vote must be 0 or 1, got: "${String(rawVote)}".`
    }

    rows.push({ rowIndex: rowNumber, wardNumber, candidateFullName, vote, parseError })
  })

  if (rows.length === 0) {
    parseErrors.push('No data rows found in the Votes sheet.')
  }

  return { rows, parseErrors }
}

// ---------------------------------------------------------------------------
// Submit bulk upload to Netlify function
// ---------------------------------------------------------------------------
export async function submitBulkVotingUpload(
  rows: ParsedVoteRow[],
  sourceFilename: string,
): Promise<BulkUploadResult> {
  const payload = {
    action: 'bulk_upload',
    sourceFilename,
    rows: rows.map((r) => ({
      wardNumber: r.wardNumber,
      candidateFullName: r.candidateFullName,
      vote: r.vote,
    })),
  }

  const response = await fetch('/.netlify/functions/nominations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  let parsed: unknown = null
  try {
    parsed = await response.json()
  } catch {
    parsed = null
  }

  if (!response.ok) {
    const msg =
      parsed && typeof parsed === 'object' && 'error' in parsed && typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : 'Bulk upload failed.'
    return { ok: false, error: msg }
  }

  return parsed as BulkUploadResult
}

// ---------------------------------------------------------------------------
// Submit manual ward ballot capture to Netlify function
// ---------------------------------------------------------------------------
export async function submitWardBallot(
  wardId: string,
  candidateIds: string[],
): Promise<ManualCaptureResult> {
  const response = await fetch('/.netlify/functions/nominations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'manual_capture', wardId, candidateIds }),
  })

  let parsed: unknown = null
  try {
    parsed = await response.json()
  } catch {
    parsed = null
  }

  if (!response.ok) {
    const msg =
      parsed && typeof parsed === 'object' && 'error' in parsed && typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : 'Manual capture failed.'
    return { ok: false, error: msg }
  }

  return parsed as ManualCaptureResult
}
