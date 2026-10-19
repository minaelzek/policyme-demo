/** Canonical condition -> surface forms the rule-based extractor looks for. */
export const CONDITION_LEXICON: Record<string, string[]> = {
  'type 2 diabetes': ['type 2 diabetes', 'type ii diabetes', 't2d', 'diabetes', 'diabetic'],
  hypertension: ['hypertension', 'high blood pressure', 'htn'],
  asthma: ['asthma', 'asthmatic'],
  'anxiety/depression': ['anxiety', 'depression', 'depressive disorder', 'generalized anxiety'],
  'sleep apnea': ['sleep apnea', 'sleep apnoea', 'osa'],
  'high cholesterol': ['high cholesterol', 'hypercholesterolemia', 'hyperlipidemia'],
  cancer: ['cancer', 'melanoma', 'lymphoma', 'carcinoma'],
  'heart disease': ['heart disease', 'coronary artery disease', 'heart attack', 'myocardial infarction'],
}

export const CANONICAL_CONDITIONS = Object.keys(CONDITION_LEXICON)
