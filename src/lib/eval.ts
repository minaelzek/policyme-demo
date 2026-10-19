import type { Extraction, ExtractorProvider, FieldKey, Labels, Sample } from './types'
import { FIELD_KEYS } from './types'

export const normName = (s: string) => s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()

export function fieldCorrect(key: FieldKey, got: Extraction, want: Labels): boolean {
  const v = got[key].value
  if (v === null) return false
  switch (key) {
    case 'fullName':
      return normName(v as string) === normName(want.fullName)
    case 'conditions': {
      const a = [...(v as string[])].sort().join('|')
      const b = [...want.conditions].sort().join('|')
      return a === b
    }
    default:
      return v === want[key]
  }
}

export type DocResult = { sample: Sample; extraction: Extraction; correct: Record<FieldKey, boolean> }

export type EvalReport = {
  provider: string
  docs: DocResult[]
  fieldAccuracy: Record<FieldKey, number>
  overallFieldAccuracy: number
  exactMatchRate: number
  conditions: { precision: number; recall: number; f1: number }
}

export function score(provider: string, docs: { sample: Sample; extraction: Extraction }[]): EvalReport {
  const results: DocResult[] = docs.map(({ sample, extraction }) => ({
    sample,
    extraction,
    correct: Object.fromEntries(FIELD_KEYS.map((k) => [k, fieldCorrect(k, extraction, sample.labels)])) as Record<FieldKey, boolean>,
  }))
  const n = results.length || 1
  const fieldAccuracy = Object.fromEntries(
    FIELD_KEYS.map((k) => [k, results.filter((r) => r.correct[k]).length / n]),
  ) as Record<FieldKey, number>

  let tp = 0, fp = 0, fn = 0
  for (const r of results) {
    const got = new Set(r.extraction.conditions.value ?? [])
    const want = new Set(r.sample.labels.conditions)
    for (const c of got) (want.has(c) ? tp++ : fp++)
    for (const c of want) if (!got.has(c)) fn++
  }
  // When a doc has no conditions and none are predicted, that's correct — avoid 0/0.
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp)
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn)
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)

  return {
    provider,
    docs: results,
    fieldAccuracy,
    overallFieldAccuracy: FIELD_KEYS.reduce((s, k) => s + fieldAccuracy[k], 0) / FIELD_KEYS.length,
    exactMatchRate: results.filter((r) => FIELD_KEYS.every((k) => r.correct[k])).length / n,
    conditions: { precision, recall, f1 },
  }
}

export async function runEval(provider: ExtractorProvider, samples: Sample[]): Promise<EvalReport> {
  const docs = []
  for (const sample of samples) docs.push({ sample, extraction: await provider.extract(sample.text) })
  return score(provider.label, docs)
}

/** Flat predictions file, scorable by scripts/score.py. */
export function toPredictions(report: EvalReport) {
  return report.docs.map((d) => ({
    id: d.sample.id,
    ...Object.fromEntries(FIELD_KEYS.map((k) => [k, d.extraction[k].value])),
  }))
}
