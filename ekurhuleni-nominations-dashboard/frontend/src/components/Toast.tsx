import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle, XCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

type Toast = {
	id: number
	message: string
	type: ToastType
}

type ToastContextValue = {
	toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 1

const TOAST_ICONS: Record<ToastType, ReactNode> = {
	success: <CheckCircle size={18} />,
	error: <XCircle size={18} />,
	info: <Info size={18} />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([])

	const addToast = useCallback((message: string, type: ToastType = 'info') => {
		const id = nextId++
		setToasts((prev) => [...prev, { id, message, type }])
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id))
		}, 3500)
	}, [])

	return (
		<ToastContext.Provider value={{ toast: addToast }}>
			{children}
			<div className="toast-container">
				{toasts.map((t) => (
					<div key={t.id} className={`toast toast-${t.type}`}>
						<span className="toast-icon">{TOAST_ICONS[t.type]}</span>
						<span className="toast-message">{t.message}</span>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	)
}

export function useToast(): ToastContextValue {
	const ctx = useContext(ToastContext)
	if (!ctx) {
		throw new Error('useToast must be used within a ToastProvider')
	}
	return ctx
}
