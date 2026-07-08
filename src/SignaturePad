import { useRef, useEffect } from 'react'
import SignaturePadLib from 'signature_pad'

export default function SignaturePad({ onChange }) {
  const canvasRef = useRef(null)
  const padRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current

    function resize() {
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      canvas.getContext('2d').scale(ratio, ratio)
      if (padRef.current) padRef.current.clear()
    }

    padRef.current = new SignaturePadLib(canvas, { backgroundColor: 'rgb(255,255,255)' })
    padRef.current.addEventListener('endStroke', () => {
      onChange(padRef.current.isEmpty() ? null : padRef.current.toDataURL('image/png'))
    })

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  function handleClear() {
    padRef.current?.clear()
    onChange(null)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 160, border: '1px solid var(--border)', borderRadius: 8, background: 'white', touchAction: 'none', display: 'block' }}
      />
      <button type="button" className="logout-button" style={{ marginTop: 6 }} onClick={handleClear}>Clear</button>
    </div>
  )
}
