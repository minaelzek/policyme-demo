import type { Extraction, ExtractorProvider, Field, Span } from '../types'
import { CONDITION_LEXICON } from '../conditions'

/**
 * Rule-based "mock" extractor. Deterministic, runs in the browser, needs no API key.
 * It doubles as a baseline: the eval tab shows exactly where rules break down
 * (the cases an LLM provider would be swapped in for).
 */

const empty = <T,>(note?: string): Field<T> => ({ value: null, confidence: 0, evidence: [], note })

// Name: Unicode capitalised words separated by single spaces (no `i` flag: with /iu, \p{Lu} would match lowercase).
const W = "[\\p{Lu}][\\p{L}'’.-]+"
const NAME = `(${W}(?: ${W}){1,3})`
const NAME_STOP = new Set(['Age', 'Date', 'DOB', 'Province', 'Coverage', 'Smoker', 'Term', 'CAD'])

const NAME_PATTERNS: { re: RegExp; confidence: number }[] = [
  { re: new RegExp(`(?:[Ff]ull (?:[Ll]egal )?[Nn]ame|[Aa]pplicant [Nn]ame|[Nn]ame of [Aa]pplicant|[Ee]xaminee|[Nn]ame)[ \\t]*[:\\-][ \\t]*${NAME}`, 'u'), confidence: 0.95 },
  { re: new RegExp(`(?:I'm|I am|[Mm]y name is) ${NAME}`, 'u'), confidence: 0.85 },
  { re: new RegExp(`(?:[Aa]pplicant|[Ii]nsured|[Cc]lient|[Ee]xaminee),? ${NAME}`, 'u'), confidence: 0.85 },
  { re: new RegExp(`[Nn]ame\\?[ \\t]*\\n[^:\\n]*:[ \\t]*${NAME}`, 'u'), confidence: 0.8 },
]

export function extractName(text: string): Field<string> & { end?: number } {
  for (const { re, confidence } of NAME_PATTERNS) {
    const m = re.exec(text)
    if (!m) continue
    const words = m[1].split(' ')
    while (words.length && NAME_STOP.has(words[words.length - 1])) words.pop()
    if (words.length < 2) continue
    const value = words.join(' ')
    const start = m.index + m[0].lastIndexOf(m[1])
    return { value, confidence, evidence: [{ start, end: start + value.length }], end: start + value.length }
  }
  return empty('No name pattern matched')
}

function yearsBetween(dob: string, ref: string): number {
  const [y1, m1, d1] = dob.split('-').map(Number)
  const [y2, m2, d2] = ref.split('-').map(Number)
  let age = y2 - y1
  if (m2 < m1 || (m2 === m1 && d2 < d1)) age--
  return age
}

export function extractAge(text: string, nameEnd?: number): Field<number> {
  const explicit = /\bage(?:d)?[ \t]*[:\-]?[ \t]*(\d{2})\b/i.exec(text)
  if (explicit) return spanField(Number(explicit[1]), 0.95, explicit, explicit[1])

  const dob = /\b(?:date of birth|dob)[ \t]*[:\-][ \t]*(\d{4}-\d{2}-\d{2})/i.exec(text)
  if (dob) {
    const ref = /\b(?:date signed|application date|signed on)[ \t]*[:\-]?[ \t]*(\d{4}-\d{2}-\d{2})/i.exec(text)
    if (ref) {
      const f = spanField(yearsBetween(dob[1], ref[1]), 0.9, dob, dob[1])
      f.evidence.push(spanOf(ref, ref[1]))
      f.note = `Computed from DOB ${dob[1]} at application date ${ref[1]}`
      return f
    }
    const f = spanField(yearsBetween(dob[1], new Date().toISOString().slice(0, 10)), 0.6, dob, dob[1])
    f.note = 'Computed from DOB vs. today (no application date found) — review'
    return f
  }

  const yo = /\b(\d{2})[- ]year[- ]old\b/i.exec(text)
  if (yo) return spanField(Number(yo[1]), 0.9, yo, yo[1])

  if (nameEnd !== undefined) {
    const after = /^,[ \t]*(\d{2})\b/.exec(text.slice(nameEnd))
    if (after) {
      const start = nameEnd + after[0].lastIndexOf(after[1])
      return { value: Number(after[1]), confidence: 0.8, evidence: [{ start, end: start + 2 }] }
    }
  }

  const qa = /\bage\?[ \t]*\n[^:\n]*:[ \t]*(\d{2})\b/i.exec(text)
  if (qa) return spanField(Number(qa[1]), 0.8, qa, qa[1])

  return empty('No age or date of birth found')
}

const AMOUNT = /(\$[ \t]?)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)[ \t]*(k|m|million|thousand)?\b/gi
const COVERAGE_KEYWORDS = /coverage|benefit|face amount|sum insured|insurance amount|term life|top up/i

export function parseAmount(raw: string, mult?: string): number {
  let n = Number(raw.replace(/,/g, ''))
  const m = mult?.toLowerCase()
  if (m === 'k' || m === 'thousand') n *= 1_000
  if (m === 'm' || m === 'million') n *= 1_000_000
  return Math.round(n)
}

function amountsIn(text: string, offset: number): { value: number; span: Span }[] {
  const out: { value: number; span: Span }[] = []
  for (const m of text.matchAll(AMOUNT)) {
    if (!m[1] && !m[3]) continue // need a $ or a multiplier, so "20 years" / "2026" don't count
    const value = parseAmount(m[2], m[3])
    if (value < 10_000) continue
    const start = offset + m.index!
    out.push({ value, span: { start, end: start + m[0].trimEnd().length } })
  }
  return out
}

/** Split into sentences/lines while keeping absolute offsets. */
export function segments(text: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = []
  const re = /(?:[^\n.!?]|[.!?](?=\d))*(?:[.!?]+|\n|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) && m[0] !== '') {
    out.push({ text: m[0], start: m.index })
    if (re.lastIndex >= text.length) break
  }
  return out
}

export function extractCoverage(text: string): Field<number> {
  for (const seg of segments(text)) {
    if (!COVERAGE_KEYWORDS.test(seg.text)) continue
    const found = amountsIn(seg.text, seg.start)
    if (found.length) return { value: found[0].value, confidence: 0.9, evidence: [found[0].span] }
  }
  const any = amountsIn(text, 0)
  if (any.length) return { value: any[0].value, confidence: 0.5, evidence: [any[0].span], note: 'First dollar amount in document — no coverage keyword nearby' }
  return empty('No numeric coverage amount found')
}

export function extractSmoker(text: string): Field<boolean> {
  const quit = /\bquit(?:[ \t]+(?:smoking|vaping|tobacco))?[ \t]+(?:about[ \t]+|roughly[ \t]+|~)?(\d+)[ \t]+(month|year)s?[ \t]+ago/i.exec(text)
  if (quit) {
    const months = Number(quit[1]) * (quit[2].toLowerCase() === 'year' ? 12 : 1)
    const f = spanField(months < 12, 0.85, quit, quit[0])
    f.note = `Quit ${months} months ago — ${months < 12 ? 'within' : 'outside'} the 12-month window`
    return f
  }
  const form = /\b(?:smoker|tobacco|nicotine|vap\w*)[^\n]*?[:?][ \t]*(yes|no|none|never|y|n)\b/i.exec(text)
  if (form) return spanField(/^y/i.test(form[1]), 0.95, form, form[0])
  const neg = /\b(non[- ]?smoker|does not smoke|doesn't smoke|never smoked|no tobacco|no nicotine)\b/i.exec(text)
  if (neg) return spanField(false, 0.9, neg, neg[0])
  const pos = /\b(smokes?|smoker|smoking|vapes?|vaping|cigarettes?|cigars?|nicotine pouch\w*)\b/i.exec(text)
  if (pos) return spanField(true, 0.8, pos, pos[0])
  return empty('No tobacco/nicotine statement found')
}

const NEGATION = /\b(no|not|denies|denied|never|without|negative for|none)\b/i
const FAMILY = /\b(family history|mother|father|brother|sister|sibling|parent|grandparent)s?\b/i

export function extractConditions(text: string): Field<string[]> {
  const lower = text.toLowerCase()
  const claimed: Span[] = []
  const positive = new Set<string>()
  const evidence: Span[] = []
  let formStyle = false

  const surfaces = Object.entries(CONDITION_LEXICON)
    .flatMap(([canon, forms]) => forms.map((s) => ({ canon, s })))
    .sort((a, b) => b.s.length - a.s.length)

  for (const { canon, s } of surfaces) {
    const re = new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
    for (const m of lower.matchAll(re)) {
      const start = m.index!
      const end = start + s.length
      if (claimed.some((c) => start < c.end && end > c.start)) continue
      claimed.push({ start, end })

      const lineEnd = text.indexOf('\n', end)
      const after = text.slice(end, lineEnd === -1 ? undefined : lineEnd)
      const boundary = Math.max(text.lastIndexOf('.', start - 1), text.lastIndexOf(';', start - 1), text.lastIndexOf('\n', start - 1), text.lastIndexOf('?', start - 1))
      const before = text.slice(Math.max(boundary + 1, start - 80), start)

      let isPositive: boolean
      const answer = /^[^\n]*?[:?][ \t]*(yes|no|none|y|n)\b/i.exec(after)
      if (answer) {
        formStyle = true
        isPositive = /^y/i.test(answer[1])
      } else if (FAMILY.test(before)) {
        isPositive = false
      } else {
        isPositive = !NEGATION.test(before)
      }
      if (isPositive) positive.add(canon)
      evidence.push({ start, end, negated: !isPositive })
    }
  }

  const value = [...positive].sort()
  return {
    value,
    confidence: formStyle ? 0.9 : 0.8,
    evidence: evidence.sort((a, b) => a.start - b.start),
    note: evidence.some((e) => e.negated) ? 'Struck-through mentions were read as negated or family history' : undefined,
  }
}

function spanOf(m: RegExpExecArray, part: string): Span {
  const start = m.index + m[0].indexOf(part)
  return { start, end: start + part.length }
}

function spanField<T>(value: T, confidence: number, m: RegExpExecArray, part: string): Field<T> {
  return { value, confidence, evidence: [spanOf(m, part)] }
}

export function extractRules(text: string): Extraction {
  const name = extractName(text)
  const { end, ...fullName } = name
  return {
    fullName,
    age: extractAge(text, end),
    coverageAmount: extractCoverage(text),
    smoker: extractSmoker(text),
    conditions: extractConditions(text),
  }
}

export const mockProvider: ExtractorProvider = {
  id: 'mock',
  label: 'Rule-based (mock, no API key)',
  extract: async (text) => extractRules(text),
}
