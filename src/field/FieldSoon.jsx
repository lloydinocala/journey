import { useNavigate } from 'react-router-dom'
import FieldShell from './FieldShell'

// Placeholder for the Field Management screens still being built (Credits & Expenses, WorkForce, Admin).
export default function FieldSoon({ profile, title }) {
  const navigate = useNavigate()
  return (
    <FieldShell profile={profile} title={title} onBack={() => navigate('/tech/field')}>
      <div className="fa-panel" style={{ minHeight: 200, justifyContent: 'center' }}>
        <p className="fa-empty" style={{ fontSize: 16, color: 'var(--fa-ink)', fontWeight: 600 }}>{title} is being built and arrives in the next update.</p>
      </div>
    </FieldShell>
  )
}
