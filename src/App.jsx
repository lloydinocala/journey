import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

export default function App() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    async function checkConnection() {
      const { error } = await supabase.from('organizations').select('id').limit(1)
      setStatus(error ? `Error: ${error.message}` : 'Connected to journey-core ✅')
    }
    checkConnection()
  }, [])

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Journey</h1>
      <p>{status}</p>
    </div>
  )
}
