import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { usePlayer } from '../contexts/usePlayer'
import { useToast } from '../contexts/ToastContext'

const roots = new Set(['/', '/artists', '/library', '/discover', '/fans'])

export function NativeBackHandler() {
  const location = useLocation()
  const player = usePlayer()
  const { expanded, setExpanded } = player
  const toast = useToast()
  const lastBack = useRef(0)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let remove: (() => Promise<void>) | undefined
    void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (window.history.state?.shyOverlay) { window.history.back(); return }
      if (expanded) {
        if (window.history.state?.shyPlayer) window.history.back()
        else setExpanded(false)
        return
      }
      if (!roots.has(location.pathname) || canGoBack) { window.history.back(); return }
      const now = Date.now()
      if (now - lastBack.current < 2_000) { void CapacitorApp.exitApp(); return }
      lastBack.current = now
      toast.showToast('Press back again to exit', 'info')
    }).then((handle) => { remove = () => handle.remove() })
    return () => { void remove?.() }
  }, [expanded, location.pathname, setExpanded, toast])
  return null
}
