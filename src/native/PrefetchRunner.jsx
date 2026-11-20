// "Load my day" — runs inside a hidden frame (see PrefetchHost). It opens the tech's job screens
// for today and tomorrow one at a time, exactly as the tech would, so every read those screens
// make lands in the offline cache. The frame can't write or send anything (native/offline.js).
import { useEffect, useState } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { prefetchInflight } from './offline'
import FieldJobs from '../field/FieldJobs'
import FieldJobData from '../field/FieldJobData'
import FieldHome from '../field/FieldHome'
import TechJobCard from '../TechJobCard'

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Wait until the screen has stopped loading: no reads in flight for a moment (max ~25 s).
async function settle() {
  const start = Date.now()
  let quietSince = 0
  await sleep(400)
  while (Date.now() - start < 25000) {
    if (prefetchInflight() === 0) {
      if (!quietSince) quietSince = Date.now()
      if (Date.now() - quietSince > 1200) return
    } else quietSince = 0
    await sleep(200)
  }
}

const post = (msg) => { try { window.parent.postMessage({ journeyPrefetch: true, ...msg }, window.location.origin) } catch { /* ignore */ } }

export default function PrefetchRunner() {
  const [step, setStep] = useState(null)
  useEffect(() => {
    let profile = null
    try { profile = window.parent.__journeyProfile || null } catch { /* ignore */ }
    if (!profile?.org_id) { post({ done: true, jobs: 0 }); return }
    // The visible app keeps the sign-in fresh; this frame must not refresh it on its own.
    try { supabase.auth.stopAutoRefresh() } catch { /* ignore */ }
    let live = true
    ;(async () => {
      const today = new Date()
      const tomorrow = new Date(today.getTime() + 86400000)
      const days = [iso(today), iso(tomorrow)]
      const screens = [{ path: '/tech/field', el: <FieldHome profile={profile} /> }]
      for (const d of days) screens.push({ path: `/tech/field/jobs?date=${d}`, el: <FieldJobs profile={profile} />, route: '/tech/field/jobs' })
      // Which jobs: supervisors and admins get the whole company's day; techs get their own.
      const wide = profile.role === 'org_admin' || profile.role === 'super_admin' || profile.is_field_supervisor
      const { data: jobs } = await supabase.from('jobs').select('id, job_date, status')
        .eq('org_id', profile.org_id).in('job_date', days).is('deleted_at', null).limit(80)
      let ids = (jobs || []).filter((j) => j.status !== 'canceled' && j.status !== 'cancelled').map((j) => j.id)
      if (!wide && ids.length) {
        const { data: mine } = await supabase.from('job_technicians').select('job_id').eq('user_id', profile.id).in('job_id', ids)
        const set = new Set((mine || []).map((r) => r.job_id))
        ids = ids.filter((id) => set.has(id))
      }
      ids = ids.slice(0, 40)
      for (const id of ids) {
        screens.push({ path: `/tech/field/job/${id}`, el: <FieldJobData profile={profile} />, route: '/tech/field/job/:jobId' })
        screens.push({ path: `/tech/${id}`, el: <TechJobCard profile={profile} />, route: '/tech/:jobId' })
      }
      for (let i = 0; i < screens.length && live; i++) {
        setStep({ ...screens[i], key: i })
        await settle()
        post({ progress: i + 1, total: screens.length })
      }
      setStep(null)
      post({ done: true, jobs: ids.length })
    })().catch(() => post({ done: true, error: true }))
    return () => { live = false }
  }, [])

  if (!step) return null
  return (
    <MemoryRouter key={step.key} initialEntries={[step.path]}>
      <Routes>
        <Route path={step.route || step.path.split('?')[0]} element={step.el} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>
  )
}
