import { LegalDocumentPage } from '../components/LegalDocuments'
import { PublicPage } from '../components/PublicLayout'
import { termsDocument } from '../content/legal/terms'

export default function TermsPage() {
  return <PublicPage decorations={false}><LegalDocumentPage document={termsDocument} /></PublicPage>
}
