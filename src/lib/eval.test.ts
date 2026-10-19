import { describe, expect, it } from 'vitest'
import { SAMPLES } from '../data'
import { mockProvider } from './extract'
import { runEval, score, toPredictions } from './eval'
import { FIELD_KEYS } from './types'

describe('eval harness', () => {
  it('every sample is labelled and marked fake', () => {
    expect(SAMPLES.length).toBeGreaterThanOrEqual(10)
    for (const s of SAMPLES) {
      expect(s.text.startsWith('[FAKE SAMPLE')).toBe(true)
      for (const k of FIELD_KEYS) expect(s.labels[k]).not.toBeUndefined()
    }
  })

  it('a perfect extractor scores 100%', () => {
    const docs = SAMPLES.map((sample) => ({
      sample,
      extraction: Object.fromEntries(FIELD_KEYS.map((k) => [k, { value: sample.labels[k], confidence: 1, evidence: [] }])) as never,
    }))
    const r = score('oracle', docs)
    expect(r.overallFieldAccuracy).toBe(1)
    expect(r.exactMatchRate).toBe(1)
    expect(r.conditions.f1).toBe(1)
  })

  it('the rule-based baseline clears 90% field accuracy but is not perfect', async () => {
    const r = await runEval(mockProvider, SAMPLES)
    expect(r.overallFieldAccuracy).toBeGreaterThanOrEqual(0.9)
    expect(r.exactMatchRate).toBeLessThan(1) // the hard cases are there on purpose
    expect(toPredictions(r)).toHaveLength(SAMPLES.length)
  })
})
