import { useEffect, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

export function NavigationEffects() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const [completedKey, setCompletedKey] = useState(location.key)
  useEffect(() => {
    history.scrollRestoration = 'manual'
    return () => { history.scrollRestoration = 'auto' }
  }, [])
  useEffect(() => {
    const key = 'shy-scroll:' + location.pathname + location.search
    const restore = navigationType === 'POP' ? Number(sessionStorage.getItem(key) ?? 0) : 0
    const frame = requestAnimationFrame(() => window.scrollTo({ top: restore, behavior: 'instant' }))
    return () => {
      cancelAnimationFrame(frame)
      sessionStorage.setItem(key, String(window.scrollY))
    }
  }, [location.key, location.pathname, location.search, navigationType])
  useEffect(() => {
    const timer = window.setTimeout(() => setCompletedKey(location.key), 450)
    return () => window.clearTimeout(timer)
  }, [location.key])
  return <div className={`route-progress ${completedKey !== location.key ? 'active' : ''}`} aria-hidden="true" />
}
