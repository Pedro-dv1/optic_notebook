import { useState, type FormEvent } from 'react'
import { api, apiErrorMessage } from '../api/client'
import { PublicBackLink, PublicPage } from '../components/PublicLayout'
import { Button, Notice, SelectField, TextAreaField } from '../components/ui'

export default function ReviewPage() {
  const [done, setDone] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token') || ''
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError(''); try { await api.post('/public/reviews/', { review_token: token, rating: Number(data.get('rating')), comment: data.get('comment') }); setDone(true) } catch (caught) { setError(apiErrorMessage(caught)) } finally { setBusy(false) } }
  return <PublicPage mode="customer"><section className="mx-auto max-w-xl px-5 py-12"><PublicBackLink to="/" /><div className="public-form-card p-7"><h1 className="public-display text-3xl">Avalie seu <span>atendimento</span></h1>{done ? <div className="mt-6"><Notice kind="success">Avaliação enviada. Obrigado!</Notice></div> : <form className="mt-6 grid gap-4" onSubmit={submit}><SelectField label="Nota" name="rating" required><option value="">Selecione</option>{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} estrela{value > 1 ? 's' : ''}</option>)}</SelectField><TextAreaField label="Comentário opcional" name="comment" maxLength={2000} />{!token && <Notice>Link de avaliação inválido.</Notice>}{error && <Notice>{error}</Notice>}<Button disabled={!token} loading={busy}>Enviar avaliação</Button></form>}</div></section></PublicPage>
}
