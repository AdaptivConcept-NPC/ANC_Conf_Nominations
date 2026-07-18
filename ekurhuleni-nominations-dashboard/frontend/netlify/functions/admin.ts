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

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required field: ${field}`)
  }
  return value.trim()
}

function requiredNumber(value: unknown, field: string) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    throw new Error(`Missing required numeric field: ${field}`)
  }
  return numeric
}

export const handler = async (event: { httpMethod?: string; body?: string | null }) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    }
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { ok: false, error: 'Missing Supabase admin environment variables.' })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed.' })
  }

  try {
    const payload = JSON.parse(event.body ?? '{}') as Record<string, unknown> & { resource?: string }

    switch (payload.resource) {
      case 'zone': {
        const row = {
          ...(payload.id ? { id: requiredString(payload.id, 'id') } : {}),
          name: requiredString(payload.name, 'name'),
          coordinator_name: typeof payload.coordinatorName === 'string' ? payload.coordinatorName.trim() : null,
        }
        const conflictKey = payload.id ? 'id' : 'name'
        const { error } = await adminClient.from('zones').upsert(row, { onConflict: conflictKey })
        if (error) throw error
        return json(200, { ok: true })
      }

      case 'ward': {
        const row = {
          ...(payload.id ? { id: requiredString(payload.id, 'id') } : {}),
          ward_number: requiredNumber(payload.wardNumber, 'wardNumber'),
          zone_id: typeof payload.zoneId === 'string' && payload.zoneId.trim() ? payload.zoneId.trim() : null,
        }
        const conflictKey = payload.id ? 'id' : 'ward_number'
        const { error } = await adminClient.from('wards').upsert(row, { onConflict: conflictKey })
        if (error) throw error
        return json(200, { ok: true })
      }

      case 'candidate': {
        const row = {
          ...(payload.id ? { id: requiredString(payload.id, 'id') } : {}),
          full_name: requiredString(payload.fullName, 'fullName'),
          is_active: Boolean(payload.isActive),
        }
        const conflictKey = payload.id ? 'id' : 'full_name'
        const { error } = await adminClient.from('candidates').upsert(row, { onConflict: conflictKey })
        if (error) throw error
        return json(200, { ok: true })
      }

      case 'alias': {
        const row = {
          ...(payload.id ? { id: requiredString(payload.id, 'id') } : {}),
          candidate_id: requiredString(payload.candidateId, 'candidateId'),
          alias_name: requiredString(payload.aliasName, 'aliasName'),
          source_note: typeof payload.sourceNote === 'string' ? payload.sourceNote.trim() : null,
        }
        const conflictKey = payload.id ? 'id' : 'alias_name'
        const { error } = await adminClient.from('candidate_aliases').upsert(row, { onConflict: conflictKey })
        if (error) throw error
        return json(200, { ok: true })
      }

      case 'profile': {
        const row = {
          ...(payload.id ? { id: requiredString(payload.id, 'id') } : {}),
          candidate_id: requiredString(payload.candidateId, 'candidateId'),
          display_name: requiredString(payload.displayName, 'displayName'),
          photo_url: typeof payload.photoUrl === 'string' ? payload.photoUrl.trim() : null,
          short_bio: typeof payload.shortBio === 'string' ? payload.shortBio.trim() : null,
          contact_phone: typeof payload.contactPhone === 'string' ? payload.contactPhone.trim() : null,
          contact_email: typeof payload.contactEmail === 'string' ? payload.contactEmail.trim() : null,
          zone_id: typeof payload.zoneId === 'string' && payload.zoneId.trim() ? payload.zoneId.trim() : null,
          ward_id: typeof payload.wardId === 'string' && payload.wardId.trim() ? payload.wardId.trim() : null,
          status: payload.status === 'active' || payload.status === 'archived' ? payload.status : 'draft',
          notes: typeof payload.notes === 'string' ? payload.notes.trim() : null,
        }
        const conflictKey = payload.id ? 'id' : 'candidate_id'
        const { error } = await adminClient.from('candidate_profiles').upsert(row, { onConflict: conflictKey })
        if (error) throw error
        return json(200, { ok: true })
      }

      case 'app_user': {
        const row = {
          ...(payload.id ? { id: requiredString(payload.id, 'id') } : {}),
          email: requiredString(payload.email, 'email'),
          full_name: requiredString(payload.fullName, 'fullName'),
          contact_number: typeof payload.contactNumber === 'string' ? payload.contactNumber.trim() : null,
          role: payload.role === 'SuperAdmin' || payload.role === 'Admin' || payload.role === 'Viewer' ? payload.role : 'Viewer',
          is_active: Boolean(payload.isActive),
        }
        const conflictKey = payload.id ? 'id' : 'email'
        const { error } = await adminClient.from('app_users').upsert(row, { onConflict: conflictKey })
        if (error) throw error
        return json(200, { ok: true })
      }

      default:
        return json(400, { ok: false, error: 'Unknown admin resource.' })
    }
  } catch (error) {
    return json(400, { ok: false, error: error instanceof Error ? error.message : 'Failed to save admin record.' })
  }
}