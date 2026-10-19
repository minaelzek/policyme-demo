import type { ReactNode } from 'react'

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <section className={`min-w-0 rounded-[var(--radius-card)] border border-stone bg-white p-5 shadow-[0_1px_0_rgba(48,51,42,0.04)] ${className}`}>{children}</section>
)

export const Pill = ({ children, tone = 'oat' }: { children: ReactNode; tone?: 'oat' | 'bisque' | 'signal' }) => {
  const tones = { oat: 'bg-oat text-army', bisque: 'bg-bisque text-cocoa', signal: 'bg-[#fde7e1] text-signal' }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
}

export const Button = ({ children, onClick, disabled, variant = 'primary' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'ghost' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={
      variant === 'primary'
        ? 'whitespace-nowrap rounded-full border border-army bg-army px-5 py-2 text-sm font-medium text-white transition hover:bg-moss disabled:border-meadow disabled:bg-meadow'
        : 'whitespace-nowrap rounded-full border border-stone bg-white px-4 py-2 text-sm font-medium text-coal transition hover:border-army hover:text-army'
    }
  >
    {children}
  </button>
)
