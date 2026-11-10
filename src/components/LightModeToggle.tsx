import { useState, useEffect } from 'react'

export function LightModeToggle() {
  const [isLight, setIsLight] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
    let saved: string | null = null
    try { saved = localStorage.getItem('theme') } catch { /* storage unavailable */ }
    setIsLight(saved !== null ? saved === 'light' : prefersLight)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const theme = isLight ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('theme', theme) } catch { /* storage unavailable */ }
  }, [isLight, mounted])

  if (!mounted) return <div className="mode-btn" aria-hidden="true">Theme</div>

  return (
    <button
      className="mode-btn"
      onClick={() => setIsLight(!isLight)}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-pressed={isLight}
    >
      {isLight ? '☀️' : '🌙'}
    </button>
  )
}
