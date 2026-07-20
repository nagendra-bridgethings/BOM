import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// True only when real credentials are present (not the placeholder values).
export const supabaseConfigured =
  Boolean(url && key) &&
  !url.includes('your-project-ref') &&
  !key.includes('your-anon')

export const supabase = supabaseConfigured ? createClient(url, key) : null
