import { LegalDocumentPage } from '../components/LegalDocuments'
import { PublicPage } from '../components/PublicLayout'
import { privacyDocument } from '../content/legal/privacy'

export default function PrivacyPage() {
  return <PublicPage decorations={false}><LegalDocumentPage document={privacyDocument} /></PublicPage>
}
