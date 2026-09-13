/* oxlint-disable react/only-export-components */
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'
interface Toast { id: string; message: string; type: ToastType }
interface ToastContextValue { showToast: (message: string, type?: ToastType) => void }
const ToastContext = createContext<ToastContextValue | null>(null)
const icons = { success: CheckCircle, error: XCircle, info: Info, warning: AlertTriangle }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = useCallback((id: string) => setToasts((items) => items.filter((item) => item.id !== id)), [])
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID()
    setToasts((items) => [...items, { id, message, type }])
    window.setTimeout(() => dismiss(id), 4000)
  }, [dismiss])
  const value = useMemo(() => ({ showToast }), [showToast])
  return <ToastContext.Provider value={value}>{children}<div className="toast-stack" aria-live="polite">{toasts.map((toast) => { const Icon = icons[toast.type]; return <div key={toast.id} className={`toast ${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}><Icon /><span>{toast.message}</span><button onClick={() => dismiss(toast.id)} aria-label="Dismiss notification"><X /></button></div> })}</div></ToastContext.Provider>
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside ToastProvider')
  return value
}
