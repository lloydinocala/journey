import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

// "Edit Personal Info". Customers may update their own contact details; name,
// address and billing identity stay office-managed (they anchor service and
// invoicing), so those are shown read-only with a note to call.
export default function CustomerProfile({ customer, properties }) {
  const nav = useNavigate()
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let live = true
    supabase.from('customers')
      .select('display_name, first_name, last_name, spouse_name, primary_phone, secondary_phone, email_1, email_2')
      .eq('id', customer.id).maybeSingle()
      .then(({ data }) => { if (live && data) setForm(data) })
    return () => { live = false }
  }, [customer.id])

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSaved(false) }

  async function save() {
    setBusy(true); setError('')
    const { error: err } = await supabase.rpc('update_customer_contact', {
      p_primary_phone: form.primary_phone || '',
      p_secondary_phone: form.secondary_phone || '',
      p_email_1: form.email_1 || '',
      p_email_2: form.email_2 || '',
      p_spouse_name: form.spouse_name || '',
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    setSaved(true)
  }

  if (!form) return <div className="cp-wrap"><div className="cp-empty">Loading your info…</div></div>

  const fullName = [form.first_name, form.last_name].filter(Boolean).join(' ') || form.display_name || '—'
  const prop = properties[0]

  return (
    <div className="cp-wrap">
      <button className="cp-back" onClick={() => nav('/portal')}>‹ Home</button>
      <h2 className="cp-h2">Edit Personal Info</h2>
      <p className="cp-lead">Keep your contact details current so we can always reach you.</p>

      <div className="cp-card">
        <div className="cp-label" style={{ marginTop: 0 }}>Name</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{fullName}</div>
        {prop && (
          <>
            <div className="cp-label">Address</div>
            <div style={{ fontSize: 15 }}>
              {[prop.street_address, prop.unit].filter(Boolean).join(' ')}<br />
              {[prop.city, prop.state].filter(Boolean).join(', ')} {prop.zip}
            </div>
          </>
        )}
        <p className="cp-note">To change your name or service address, give the office a call — those keep your service and billing in sync.</p>
      </div>

      <div className="cp-card">
        <div className="cp-label" style={{ marginTop: 0 }}>Spouse / partner name</div>
        <input className="cp-input" value={form.spouse_name || ''} onChange={e => set('spouse_name', e.target.value)} placeholder="Optional" />

        <div className="cp-label">Primary phone</div>
        <input className="cp-input" type="tel" inputMode="tel" value={form.primary_phone || ''} onChange={e => set('primary_phone', e.target.value)} />

        <div className="cp-label">Alternate phone</div>
        <input className="cp-input" type="tel" inputMode="tel" value={form.secondary_phone || ''} onChange={e => set('secondary_phone', e.target.value)} placeholder="Optional" />

        <div className="cp-label">Email</div>
        <input className="cp-input" type="email" inputMode="email" value={form.email_1 || ''} onChange={e => set('email_1', e.target.value)} />

        <div className="cp-label">Alternate email</div>
        <input className="cp-input" type="email" inputMode="email" value={form.email_2 || ''} onChange={e => set('email_2', e.target.value)} placeholder="Optional" />
      </div>

      {error && <div className="cp-err">{error}</div>}
      {saved && <div className="cp-card" style={{ borderLeft: '4px solid var(--go)' }}>Saved — thank you!</div>}
      <div style={{ height: 6 }} />
      <button className="cp-btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      <p className="cp-note">
        Heads up: your email is also how you sign in. If you change it, use the new address next time you log in.
      </p>
    </div>
  )
}
