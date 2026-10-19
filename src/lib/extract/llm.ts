import type { Extraction, ExtractorProvider, Field, Span } from '../types'
import { CANONICAL_CONDITIONS } from '../conditions'

/**
 * Optional pluggable LLM provider for any OpenAI-compatible /chat/completions endpoint.
 * The key is typed into the page at runtime, held in memory only, and sent straight
 * from the browser to the endpoint you choose. Nothing is stored or proxied.
 */
export type LlmConfig = { baseUrl: string; apiKey: string; model: string }

export const DEFAULT_LLM_CONFIG: LlmConfig = { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' }

export const SYSTEM_PROMPT = `You extract underwriting fields from Canadian life/health insurance application text.
Return ONLY a JSON object with keys:
  fullName (string|null), age (integer|null), coverageAmount (integer CAD|null),
  smoker (boolean|null — true if any tobacco/nicotine/vaping use in the last 12 months),
  conditions (array of strings, chosen only from: ${CANONICAL_CONDITIONS.join(', ')}).
Rules: only the applicant's own conditions (exclude family history and negated mentions).
If a value is not stated, use null. Do not guess.`

type Raw = { fullName?: unknown; age?: unknown; coverageAmount?: unknown; smoker?: unknown; conditions?: unknown }

function locate(text: string, needle: string | null): Span[] {
  if (!needle) return []
  const i = text.toLowerCase().indexOf(needle.toLowerCase())
  return i === -1 ? [] : [{ start: i, end: i + needle.length }]
}

function field<T>(value: T | null, text: string, needle: string | null): Field<T> {
  return { value, confidence: value === null ? 0 : 0.85, evidence: locate(text, needle), note: 'LLM output (evidence located by string match)' }
}

export function parseLlmJson(content: string, text: string): Extraction {
  const json = content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1)
  const raw = JSON.parse(json) as Raw
  const name = typeof raw.fullName === 'string' ? raw.fullName : null
  const age = Number.isInteger(raw.age) ? (raw.age as number) : null
  const cov = typeof raw.coverageAmount === 'number' ? Math.round(raw.coverageAmount) : null
  const smoker = typeof raw.smoker === 'boolean' ? raw.smoker : null
  const conditions = Array.isArray(raw.conditions)
    ? [...new Set(raw.conditions.filter((c): c is string => typeof c === 'string' && CANONICAL_CONDITIONS.includes(c)))].sort()
    : []
  return {
    fullName: field(name, text, name),
    age: field(age, text, age === null ? null : String(age)),
    coverageAmount: field(cov, text, null),
    smoker: field(smoker, text, null),
    conditions: { value: conditions, confidence: 0.85, evidence: [], note: 'LLM output' },
  }
}

export function makeLlmProvider(cfg: LlmConfig, fetchImpl: typeof fetch = fetch): ExtractorProvider {
  return {
    id: 'llm',
    label: `LLM (${cfg.model})`,
    async extract(text) {
      if (!cfg.apiKey) throw new Error('Add an API key to use the LLM provider (the mock provider needs none).')
      const res = await fetchImpl(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: cfg.model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: text },
          ],
        }),
      })
      if (!res.ok) throw new Error(`LLM request failed: ${res.status}`)
      const data = (await res.json()) as { choices: { message: { content: string } }[] }
      return parseLlmJson(data.choices[0].message.content, text)
    },
  }
}
