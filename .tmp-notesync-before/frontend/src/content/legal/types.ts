export type LegalDocumentKind = 'terms' | 'privacy'

export interface LegalSection {
  id: string
  title: string
  paragraphs: string[]
  items?: string[]
}

export interface LegalDocument {
  kind: LegalDocumentKind
  title: string
  introduction: string[]
  sections: LegalSection[]
}

export function hasLegalContent(document: LegalDocument) {
  return document.introduction.length > 0 && document.sections.length > 0
}
