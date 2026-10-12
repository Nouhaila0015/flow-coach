import type { ReactNode } from 'react'

export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

/** Demande de confirmation avant une action irréversible. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmer',
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog title={title} onClose={onCancel}>
      <p style={{ margin: 0 }}>{message}</p>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn soft" onClick={onCancel}>Annuler</button>
        <button className={`btn${danger ? ' danger' : ''}`} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Dialog>
  )
}
