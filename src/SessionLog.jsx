import { supabase } from './supabase'

// Mirrors Layout.jsx's handleLogout on desktop. Awaited deliberately — an earlier
// desktop version of this shipped without awaiting the insert and it silently
// never sent, so this pattern is deliberate, not incidental.
export async function signOutMobile(profile) {
  const { data } = await supabase.auth.getUser()
  if (data?.user) {
    await supabase.from('session_log').insert({
      org_id: profile?.org_id || null,
      user_id: data.user.id,
      event: 'sign_out',
      source: 'mobile',
    })
  }
  await supabase.auth.signOut()
}
