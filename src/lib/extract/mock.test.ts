import { describe, expect, it } from 'vitest'
import { extractAge, extractConditions, extractCoverage, extractName, extractRules, extractSmoker, parseAmount, segments } from './mock'

describe('rule-based extractor', () => {
  it('reads labelled form fields', () => {
    const e = extractRules('Full name: Priya Ramanathan\nAge: 35\nCoverage requested: $750,000\nSmoker: No\nAsthma: Yes')
    expect(e.fullName.value).toBe('Priya Ramanathan')
    expect(e.age.value).toBe(35)
    expect(e.coverageAmount.value).toBe(750000)
    expect(e.smoker.value).toBe(false)
    expect(e.conditions.value).toEqual(['asthma'])
  })

  it('handles unicode names and drops trailing labels', () => {
    expect(extractName('Insured, Tomás Herrera, aged 33').value).toBe('Tomás Herrera')
    expect(extractName('Examinee: Aisha Siddiqui    Age 44').value).toBe('Aisha Siddiqui')
  })

  it('computes age from DOB at the application date', () => {
    expect(extractAge('DOB: 1984-11-30\nApplication date: 2026-10-01').value).toBe(41)
    expect(extractAge('DOB: 1984-09-30\nApplication date: 2026-10-01').value).toBe(42)
  })

  it('parses $ amounts with k / M / million multipliers', () => {
    expect(parseAmount('500', 'K')).toBe(500_000)
    expect(parseAmount('1.2', 'M')).toBe(1_200_000)
    expect(parseAmount('1,000,000')).toBe(1_000_000)
  })

  it('prefers the amount in the coverage sentence over salary or mortgage', () => {
    const t = 'Earns $95,000/yr and has a $420,000 mortgage. Recommended coverage: $850,000 over 20 years.'
    expect(extractCoverage(t).value).toBe(850000)
  })

  it('does not split sentences on decimal points', () => {
    expect(segments('Wants $1.2M of term life. Smokes.').map((s) => s.text.trim())).toEqual(['Wants $1.2M of term life.', 'Smokes.'])
  })

  it('applies a 12-month window to quit dates', () => {
    expect(extractSmoker('I quit smoking about 6 months ago.').value).toBe(true)
    expect(extractSmoker('Former smoker — quit 3 years ago.').value).toBe(false)
    expect(extractSmoker('Non-smoker.').value).toBe(false)
    expect(extractSmoker('Nothing relevant here').value).toBeNull()
  })

  it('ignores negated mentions and family history', () => {
    const c = extractConditions('Denies hypertension, diabetes, or heart disease. Father had cancer. Reports anxiety.')
    expect(c.value).toEqual(['anxiety/depression'])
    expect(c.evidence.filter((e) => e.negated)).toHaveLength(4)
  })

  it('reads Y/N answers in questionnaires', () => {
    expect(extractConditions('Diagnosed with cancer? N\nSleep apnea? Y').value).toEqual(['sleep apnea'])
  })
})
