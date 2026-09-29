import { PublicPage } from '../components/PublicLayout'
import { AccountMenu } from '../components/account/AccountMenu'
import { Link } from 'react-router'

export default function CustomerProfilePage() {
  return <PublicPage mode="customer" decorations={false}>
    <div className="mx-auto w-full max-w-[72rem] px-4 py-7 sm:px-7 lg:px-10 lg:py-9"><Link to="/cliente/feedback" className="btn btn-secondary mb-5">Ajuda e feedback</Link><AccountMenu page /></div>
  </PublicPage>
}
