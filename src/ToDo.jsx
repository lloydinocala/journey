import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import Reminders from './Reminders'

// Standalone home for the office To-Do list (the office_reminders feature).
// The same Reminders component is also embedded in the Call Console.
export default function ToDo({ profile }) {
  const isSuper = profile.role === 'super_admin'
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [orgs, setOrgs] = useState([])

  useEffect(() => {
    if (!isSuper) return
    supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || []))
  }, [isSuper])

  return (
    <div style={{ padding: '20px 24px', maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>To-Do List</h2>
        {isSuper && orgs.length > 0 && <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />}
      </div>
      <Reminders orgId={selectedOrg} profile={profile} />
    </div>
  )
}
