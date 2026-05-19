import type { ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
  bg?: string
  ink?: string
}

export function PhoneSheet({ open, onClose, children, bg = '#fff', ink = '#111' }: Props) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: bg, color: ink,
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          padding: '10px 0 34px', maxHeight: '90%', overflow: 'auto',
          boxShadow: '0 -20px 40px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 4, background: 'rgba(0,0,0,0.15)', margin: '4px auto 10px' }} />
        {children}
      </div>
      <style>{`
        @keyframes sheet-fade { from { background: rgba(0,0,0,0); } to { background: rgba(0,0,0,0.4); } }
        @keyframes sheet-slide { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  )
}
