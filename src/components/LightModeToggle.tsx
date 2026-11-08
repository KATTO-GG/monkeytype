import { useState, useEffect } from 'react'

export function LightModeToggle() {
  const [isLight, setIsLight] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
    const saved = localStorage.getItem('theme')
    if (saved !== null) {
      setIsLight(saved === 'light')
    } else {
      setIsLight(prefersLight)
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    if (isLight) {
      root.setAttribute('data-theme', 'light')
      localStorage.setItem('theme', 'light')
    } else {
      root.removeAttribute('data-theme')
      localStorage.setItem('theme', 'dark')
    }
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