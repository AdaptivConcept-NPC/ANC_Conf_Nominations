import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error(
		'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Configure frontend environment variables before running the app.',
	)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY
export const supabaseAdmin = serviceRoleKey
	? createClient(supabaseUrl, serviceRoleKey)
	: supabase
