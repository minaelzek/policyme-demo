import type { Extraction, FieldKey } from '../lib/types'
import { FIELD_KEYS, FIELD_LABELS } from '../lib/types'
import { Pill } from './ui'

export const REVIEW_THRESHOLD = 0.7

export function formatValue(key: FieldKey, v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (key === 'coverageAmount') return `$${(v as number).toLocaleString('en-CA')}`
  if (key === 'smoker') return v ? 'Yes' : 'No'
  if (key === 'conditions') return (v as string[]).length ? (v as string[]).join(', ') : 'None disclosed'
  return String(v)
}

export function ResultTable({ e }: { e: Extraction }) {
  return (
    <dl className="divide-y divide-stone/70">
      {FIELD_KEYS.map((k) => {
        const f = e[k]
        const review = f.value === null || f.confidence < REVIEW_THRESHOLD
        return (
          <div key={k} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 py-2.5">
            <dt className="text-xs uppercase tracking-wide text-sage">{FIELD_LABELS[k]}</dt>
            <dd className="row-span-2 self-center">
              {review ? <Pill tone="signal">Needs review</Pill> : <Pill>{Math.round(f.confidence * 100)}%</Pill>}
            </dd>
            <dd className="text-[15px] font-medium text-coal">
              {formatValue(k, f.value)}
              {f.note && <span className="ml-2 text-xs font-normal text-pebble">{f.note}</span>}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
