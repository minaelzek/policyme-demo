import { useEffect, useMemo, useState } from 'react'
import { SAMPLES } from './data'
import { DEFAULT_LLM_CONFIG, makeLlmProvider, mockProvider, type LlmConfig } from './lib/extract'
import { runEval, toPredictions, type EvalReport } from './lib/eval'
import type { Extraction } from './lib/types'
import { FIELD_KEYS, FIELD_LABELS } from './lib/types'
import { Highlighted } from './components/Highlighted'
import { ResultTable, formatValue } from './components/ResultTable'
import { Button, Card, Pill } from './components/ui'

type Tab = 'extract' | 'eval'
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`

export default function App() {
  const [tab, setTab] = useState<Tab>(() => (location.hash === '#eval' ? 'eval' : 'extract'))
  const [providerId, setProviderId] = useState<'mock' | 'llm'>('mock')
  const [llm, setLlm] = useState<LlmConfig>(DEFAULT_LLM_CONFIG)
  const provider = useMemo(() => (providerId === 'mock' ? mockProvider : makeLlmProvider(llm)), [providerId, llm])

  useEffect(() => {
    history.replaceState(null, '', tab === 'eval' ? '#eval' : location.pathname)
  }, [tab])

  return (
    <div className="min-h-screen bg-snow">
      <header className="border-b border-stone bg-white/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-army font-mono text-sm text-bisque">{'{}'}</div>
            <div>
              <div className="font-display text-lg leading-tight text-coal">Intake Extractor + Eval</div>
              <div className="text-xs text-sage">Independent demo · all data is fake</div>
            </div>
          </div>
          <nav className="flex rounded-full border border-stone bg-cloud p-1 text-sm">
            {(['extract', 'eval'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 font-medium transition ${tab === t ? 'bg-army text-white' : 'text-sage hover:text-army'}`}>
                {t === 'extract' ? '1 · Extract' : '2 · Evaluate'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-7 max-w-3xl">
          <h1 className="font-display text-3xl leading-tight text-coal sm:text-4xl">
            Turn messy application text into <span className="text-rust">underwriting-ready fields</span>, then measure how often it’s right.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-sage">
            Paste a life or critical-illness application, a broker note, or a medical questionnaire. The extractor pulls name, age, coverage, smoker status and
            disclosed conditions with highlighted evidence, and flags low-confidence fields for a human. The eval tab scores any provider against a labelled set.
          </p>
        </div>

        <ProviderBar providerId={providerId} setProviderId={setProviderId} llm={llm} setLlm={setLlm} />

        {tab === 'extract' ? <ExtractView provider={provider} /> : <EvalView provider={provider} />}
      </main>

      <footer className="border-t border-stone">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-xs text-sage">
          <span>Independent demo by Mina Elzek — not affiliated with PolicyMe.</span>
          <span>All applicants and documents are fictional · runs entirely in your browser</span>
        </div>
      </footer>
    </div>
  )
}

function ProviderBar(props: { providerId: 'mock' | 'llm'; setProviderId: (p: 'mock' | 'llm') => void; llm: LlmConfig; setLlm: (c: LlmConfig) => void }) {
  const { providerId, setProviderId, llm, setLlm } = props
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-stone bg-lace px-4 py-3 text-sm">
      <span className="font-medium text-army">Provider</span>
      <select value={providerId} onChange={(e) => setProviderId(e.target.value as 'mock' | 'llm')} className="w-full min-w-0 rounded-lg border border-stone bg-white px-3 py-1.5 sm:w-auto">
        <option value="mock">Rule-based baseline (no API key)</option>
        <option value="llm">LLM: OpenAI-compatible endpoint (bring your own key)</option>
      </select>
      {providerId === 'llm' ? (
        <>
          <input aria-label="Base URL" className="w-56 rounded-lg border border-stone bg-white px-3 py-1.5" value={llm.baseUrl} onChange={(e) => setLlm({ ...llm, baseUrl: e.target.value })} />
          <input aria-label="Model" className="w-36 rounded-lg border border-stone bg-white px-3 py-1.5" value={llm.model} onChange={(e) => setLlm({ ...llm, model: e.target.value })} />
          <input aria-label="API key" type="password" placeholder="API key (kept in memory only)" className="w-60 rounded-lg border border-stone bg-white px-3 py-1.5" value={llm.apiKey} onChange={(e) => setLlm({ ...llm, apiKey: e.target.value })} />
        </>
      ) : (
        <span className="text-sage">Deterministic regex + negation rules. Swap in an LLM to compare on the same eval.</span>
      )}
    </div>
  )
}

function ExtractView({ provider }: { provider: ReturnType<typeof makeLlmProvider> }) {
  const [sampleId, setSampleId] = useState(SAMPLES[1].id)
  const [text, setText] = useState(SAMPLES[1].text)
  const [result, setResult] = useState<Extraction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (t = text) => {
    setBusy(true)
    setError(null)
    try {
      setResult(await provider.extract(t))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (provider.id === 'mock') void run() // never auto-call a paid endpoint
    else setResult(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  const spans = result ? FIELD_KEYS.flatMap((k) => result[k].evidence) : []
  const reviewCount = result ? FIELD_KEYS.filter((k) => result[k].value === null || result[k].confidence < 0.7).length : 0

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_1fr]">
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl">Source document</h2>
          <select
            value={sampleId}
            onChange={(e) => {
              const s = SAMPLES.find((x) => x.id === e.target.value)!
              setSampleId(s.id)
              setText(s.text)
              void run(s.text)
            }}
            className="w-full min-w-0 rounded-lg border border-stone bg-cloud px-3 py-1.5 text-sm sm:w-auto"
          >
            {SAMPLES.map((s) => (
              <option key={s.id} value={s.id}>
                Fake sample: {s.title}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          spellCheck={false}
          className="w-full rounded-xl border border-stone bg-cloud p-3 font-mono text-[12.5px] leading-5 outline-none focus:border-army"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={() => run()} disabled={busy}>{busy ? 'Extracting…' : 'Extract fields'}</Button>
          <span className="text-xs text-pebble">Edit the text or paste your own (please don’t paste real personal data).</span>
        </div>
        {result && (
          <div className="mt-5 rounded-xl border border-dashed border-stone bg-snow p-3">
            <div className="mb-1 text-xs uppercase tracking-wide text-sage">Evidence</div>
            <Highlighted text={text} spans={spans} />
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl">Extracted fields</h2>
          {result && (reviewCount ? <Pill tone="signal">{reviewCount} to review</Pill> : <Pill>Ready for underwriting</Pill>)}
        </div>
        {error && <p className="rounded-lg bg-[#fde7e1] p-3 text-sm text-signal">{error}</p>}
        {result && <ResultTable e={result} />}
        {result && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-army">JSON payload</summary>
            <pre className="mt-2 overflow-auto rounded-lg bg-coal p-3 text-[12px] text-oat">
              {JSON.stringify(Object.fromEntries(FIELD_KEYS.map((k) => [k, result[k].value])), null, 2)}
            </pre>
          </details>
        )}
      </Card>
    </div>
  )
}

function EvalView({ provider }: { provider: ReturnType<typeof makeLlmProvider> }) {
  const [report, setReport] = useState<EvalReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      setReport(await runEval(provider, SAMPLES))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    if (provider.id === 'mock') void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  const download = () => {
    if (!report) return
    const blob = new Blob([JSON.stringify(toPredictions(report), null, 2)], { type: 'application/json' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'predictions.json' })
    a.click()
  }

  const misses = report?.docs.flatMap((d) => FIELD_KEYS.filter((k) => !d.correct[k]).map((k) => ({ d, k }))) ?? []

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Accuracy on {SAMPLES.length} labelled fake documents</h2>
            <p className="text-sm text-sage">Forms, broker notes, questionnaires, emails and a chat transcript, including deliberate hard cases. Provider: {provider.label}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={run} disabled={busy}>{busy ? 'Running…' : 'Run eval'}</Button>
            <Button variant="ghost" onClick={download} disabled={!report}>Download predictions</Button>
          </div>
        </div>
        {error && <p className="mt-3 rounded-lg bg-[#fde7e1] p-3 text-sm text-signal">{error}</p>}
        {report && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Field accuracy" value={pct(report.overallFieldAccuracy)} />
            <Stat label="Documents fully correct" value={`${report.docs.filter((d) => FIELD_KEYS.every((k) => d.correct[k])).length} / ${report.docs.length}`} />
            <Stat label="Conditions F1" value={report.conditions.f1.toFixed(2)} sub={`P ${report.conditions.precision.toFixed(2)} · R ${report.conditions.recall.toFixed(2)}`} />
          </div>
        )}
      </Card>

      {report && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <h3 className="mb-3 font-display text-lg">Per-field accuracy</h3>
            <div className="space-y-3">
              {FIELD_KEYS.map((k) => (
                <div key={k}>
                  <div className="mb-1 flex justify-between text-sm"><span>{FIELD_LABELS[k]}</span><span className="font-medium">{pct(report.fieldAccuracy[k])}</span></div>
                  <div className="h-2 rounded-full bg-lace"><div className="h-2 rounded-full bg-army" style={{ width: pct(report.fieldAccuracy[k]) }} /></div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className="mb-3 font-display text-lg">Misses ({misses.length})</h3>
            {misses.length === 0 ? (
              <p className="text-sm text-sage">No misses.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {misses.map(({ d, k }) => (
                  <li key={d.sample.id + k} className="rounded-lg border border-stone bg-cloud p-3">
                    <div className="font-medium">{d.sample.title} <span className="text-sage">· {FIELD_LABELS[k]}</span></div>
                    <div className="mt-1 text-xs text-sage">
                      expected <span className="font-medium text-army">{formatValue(k, d.sample.labels[k])}</span> · got{' '}
                      <span className="font-medium text-rust">{formatValue(k, d.extraction[k].value)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-pebble">Misses are where rules stop scaling (“half a million”, a name only in a subject line) — the cases an LLM provider should win.</p>
          </Card>
        </div>
      )}
    </div>
  )
}

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-xl bg-lace p-4">
    <div className="text-xs uppercase tracking-wide text-sage">{label}</div>
    <div className="mt-1 font-display text-3xl text-army">{value}</div>
    {sub && <div className="text-xs text-pebble">{sub}</div>}
  </div>
)
