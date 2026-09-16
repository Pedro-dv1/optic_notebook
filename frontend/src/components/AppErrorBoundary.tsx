import { Component, type ReactNode } from 'react'

interface AppErrorBoundaryState {
  hasError: boolean
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false }

  componentDidMount() {
    window.addEventListener('popstate', this.reset)
  }

  componentWillUnmount() {
    window.removeEventListener('popstate', this.reset)
  }

  reset = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return <main className="public-page grid min-h-screen place-items-center px-5 py-16 text-center">
      <section className="max-w-lg">
        <p className="text-sm font-bold uppercase tracking-[.18em] text-[#087cf0]">OpticNoteBook</p>
        <h1 className="public-display mt-4 text-3xl">Não foi possível exibir esta página</h1>
        <p className="mt-4 leading-7 text-[#7182b2]">Ocorreu um erro inesperado. Você pode tentar novamente ou voltar ao início.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-secondary" onClick={this.reset}>Tentar novamente</button>
          <a href="/" className="public-primary-link">Voltar para o início</a>
        </div>
      </section>
    </main>
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }
}
