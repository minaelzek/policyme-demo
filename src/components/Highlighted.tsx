import type { ReactNode } from 'react'
import type { Span } from '../lib/types'

export function Highlighted({ text, spans }: { text: string; spans: Span[] }) {
  const sorted = [...spans].sort((a, b) => a.start - b.start).filter((s, i, arr) => i === 0 || s.start >= arr[i - 1].end)
  const parts: ReactNode[] = []
  let at = 0
  sorted.forEach((s, i) => {
    if (s.start > at) parts.push(text.slice(at, s.start))
    parts.push(
      <mark key={i} className={s.negated ? 'ev-neg' : 'ev'} title={s.negated ? 'Read as negated / family history' : 'Evidence'}>
        {text.slice(s.start, s.end)}
      </mark>,
    )
    at = s.end
  })
  parts.push(text.slice(at))
  return <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-6 text-coal">{parts}</pre>
}
