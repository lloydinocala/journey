import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gatndtsmjrxdgxquvydw.supabase.co'
const supabaseKey = 'sb_publishable_n9IwxZ46elew_qnLNYFNcA_z0SWP70y'

export const supabase = createClient(supabaseUrl, supabaseKey)
