import { describe, expect, it, vi } from 'vitest'
import { makeLlmProvider, parseLlmJson } from './llm'

describe('LLM provider', () => {
  it('parses JSON and drops unknown conditions', () => {
    const e = parseLlmJson('```json\n{"fullName":"Jo Bloggs","age":30,"coverageAmount":500000,"smoker":false,"conditions":["asthma","gout"]}\n```', 'Jo Bloggs is 30')
    expect(e.fullName.value).toBe('Jo Bloggs')
    expect(e.fullName.evidence).toEqual([{ start: 0, end: 9 }])
    expect(e.conditions.value).toEqual(['asthma'])
  })

  it('refuses to call without a key', async () => {
    const fetchSpy = vi.fn()
    await expect(makeLlmProvider({ baseUrl: 'x', apiKey: '', model: 'm' }, fetchSpy).extract('t')).rejects.toThrow(/API key/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('calls an OpenAI-compatible endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"fullName":null,"age":41,"coverageAmount":null,"smoker":true,"conditions":[]}' } }] }),
    })
    const e = await makeLlmProvider({ baseUrl: 'https://llm.example/v1/', apiKey: 'k', model: 'm' }, fetchSpy as never).extract('age 41')
    expect(fetchSpy.mock.calls[0][0]).toBe('https://llm.example/v1/chat/completions')
    expect(e.age.value).toBe(41)
    expect(e.smoker.value).toBe(true)
  })
})
