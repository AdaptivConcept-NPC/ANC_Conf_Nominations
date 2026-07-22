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
    try {
        const workbook = new ExcelJS.Workbook()
        workbook.creator = 'ANC Ekurhuleni Nominations System'
        workbook.created = new Date()

        // -----------------------------------------------------------------------
        // Votes sheet — pivot format: candidates as rows, wards as columns + sum
        // -----------------------------------------------------------------------
        const votesSheet = workbook.addWorksheet('Votes')

        // Sort wards by ward number for consistent column order
        const sortedWards = [...wards].sort((a, b) => a.wardNumber - b.wardNumber)

        // Build header row: Candidate Full Name | Sum | Ward 1 | Ward 2 | ... | Ward N
        const wardHeaders = sortedWards.map((w) => `Ward ${w.wardNumber}`)
        votesSheet.addRow(['Candidate Full Name', 'Sum', ...wardHeaders])

        // Add data rows: one row per candidate
        const dataStartRow = 2
        for (let i = 0; i < activeCandidates.length; i++) {
            const candidate = activeCandidates[i]
            const dataRowIndex = dataStartRow + i
            const colLetterStart = String.fromCharCode(67) // 'C'
            const colLetterEnd = String.fromCharCode(66 + sortedWards.length) // Last ward column
            
            // Build row data with candidate name and ward columns filled with 0
            const rowData: any[] = [
                candidate.fullName, // Column A: Candidate name
                // Column B: Sum (will be set as formula)
                ...Array(sortedWards.length).fill(0), // Columns C onwards: 0 for each ward
            ]
            const row = votesSheet.addRow(rowData)
            
            // Set the Sum formula in column B after row is created
            const sumCell = row.getCell(2)
            sumCell.value = `=SUM(${colLetterStart}${dataRowIndex}:${colLetterEnd}${dataRowIndex})`
        }

        // Set column widths
        votesSheet.getColumn(1).width = 36 // Candidate Full Name
        votesSheet.getColumn(2).width = 10 // Sum
        for (let i = 0; i < sortedWards.length; i++) {
            votesSheet.getColumn(3 + i).width = 12 // Ward columns
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
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        throw new Error(`Template generation failed: ${errorMsg}`)
    }
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
