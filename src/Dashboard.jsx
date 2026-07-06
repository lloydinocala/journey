export default function Dashboard({ profile }) {
  return (
    <div>
      <p>Welcome, {profile?.full_name}.</p>

      {profile?.role === 'super_admin' && !profile?.org_id && (
        <p style={{ color: 'var(--mist)' }}>
          You're signed in as platform owner. Use the Organizations tab above
          to manage licensees.
        </p>
      )}
    </div>
  )
}
