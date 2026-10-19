export type Span = { start: number; end: number; negated?: boolean }

export type Field<T> = {
  value: T | null
  /** 0..1 — how sure the extractor is. Low values get flagged for human review. */
  confidence: number
  evidence: Span[]
  note?: string
}

export type Extraction = {
  fullName: Field<string>
  age: Field<number>
  coverageAmount: Field<number>
  smoker: Field<boolean>
  conditions: Field<string[]>
}

export type Labels = {
  fullName: string
  age: number
  coverageAmount: number
  smoker: boolean
  conditions: string[]
}

export type FieldKey = keyof Labels

export const FIELD_KEYS: FieldKey[] = ['fullName', 'age', 'coverageAmount', 'smoker', 'conditions']

export const FIELD_LABELS: Record<FieldKey, string> = {
  fullName: 'Applicant name',
  age: 'Age',
  coverageAmount: 'Coverage amount (CAD)',
  smoker: 'Smoker / nicotine (last 12 mo)',
  conditions: 'Disclosed conditions',
}

export type Sample = {
  id: string
  title: string
  kind: 'form' | 'narrative' | 'questionnaire' | 'email'
  text: string
  labels: Labels
}

export interface ExtractorProvider {
  id: string
  label: string
  extract(text: string): Promise<Extraction>
}
