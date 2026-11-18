import { useState } from 'react'

const STORAGE_KEY = 'tt-theme'

function isDark(): boolean {
  const explicit = document.documentElement.getAttribute('data-theme')
  if (explicit) return explicit === 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Light/dark switch. The saved choice is applied before first paint in index.html. */
export function ThemeToggle() {
  const [dark, setDark] = useState(isDark)

  const toggle = () => {
    const next = dark ? 'light' : 'dark'
    // Suspend transitions for the swap so every surface changes on the same frame.
    const style = document.createElement('style')
    style.textContent = '*,*::before,*::after{transition:none!important}'
    document.head.appendChild(style)
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode: the choice just won't persist.
    }
    setDark(next === 'dark')
    requestAnimationFrame(() => requestAnimationFrame(() => style.remove()))
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="press relative w-10 h-10 grid place-items-center rounded-[10px] text-text-steel hover:bg-card-raised hover:text-text-primary"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        )}
      </svg>
    </button>
  )
}
