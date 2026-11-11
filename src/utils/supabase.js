import { createClient } from '@supabase/supabase-js'
import { offlineFetch, setAuthSource } from '../native/offline'

const supabaseUrl = 'https://gatndtsmjrxdgxquvydw.supabase.co'
const supabaseKey = 'sb_publishable_n9IwxZ46elew_qnLNYFNcA_z0SWP70y'
export const SUPABASE_URL = supabaseUrl
export const SUPABASE_KEY = supabaseKey

// offlineFetch keeps the Field App working in low-signal areas (see native/offline.js).
// Office (desktop) pages pass straight through to the network as before.
export const supabase = createClient(supabaseUrl, supabaseKey, { global: { fetch: (...a) => offlineFetch(...a) } })

setAuthSource(async () => {
  try { const { data } = await supabase.auth.getSession(); return data?.session?.access_token || null } catch { return null }
}, supabaseKey)
