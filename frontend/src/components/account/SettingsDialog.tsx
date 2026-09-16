import { LuChevronRight as ChevronRight, LuLockKeyhole as LockKeyhole } from 'react-icons/lu'
import { Button } from '../ui'

export function SettingsHome({ onSecurity }: { onSecurity: () => void }) {
  return <section aria-labelledby="settings-home-title">
    <h3 id="settings-home-title" className="sr-only">Configurações</h3>
    <p className="text-sm leading-6 text-[#52658f]">Gerencie as configurações da sua conta.</p>
    <div className="mt-8">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-[#edf5ff] text-[#087cf0]"><LockKeyhole className="size-5" aria-hidden="true" /></span>
        <div><h3 className="font-bold text-[#071044]">Segurança</h3><p className="text-sm text-[#7182a8]">Proteja o acesso à sua conta.</p></div>
      </div>
      <button type="button" aria-label="Abrir Segurança" className="mt-5 flex min-h-20 w-full items-center justify-between gap-4 rounded-xl border border-[#d8e5f4] px-4 py-3 text-left transition-colors hover:border-[#8fc0f1] hover:bg-[#f7fbff]" onClick={onSecurity}>
        <span><span className="block font-semibold text-[#172653]">Segurança</span><span className="mt-1 block text-sm text-[#7182a8]">Gerencie senha e acesso à sua conta.</span></span>
        <ChevronRight className="size-5 shrink-0 text-[#7182a8]" aria-hidden="true" />
      </button>
    </div>
  </section>
}

export function SecuritySettings({ onPassword }: { onPassword: () => void }) {
  return <section aria-labelledby="security-settings-title">
    <h3 id="security-settings-title" className="sr-only">Segurança</h3>
    <p className="text-sm leading-6 text-[#52658f]">Gerencie a proteção e o acesso à sua conta.</p>
    <button type="button" aria-label="Abrir Senha" className="mt-8 flex min-h-20 w-full items-center justify-between gap-4 rounded-xl border border-[#d8e5f4] px-4 py-3 text-left transition-colors hover:border-[#8fc0f1] hover:bg-[#f7fbff]" onClick={onPassword}>
      <span><span className="block font-semibold text-[#172653]">Senha</span><span className="mt-1 block text-sm text-[#7182a8]">Gerencie a senha usada para acessar sua conta.</span></span>
      <ChevronRight className="size-5 shrink-0 text-[#7182a8]" aria-hidden="true" />
    </button>
  </section>
}

export function PasswordSettings({ onPasswordChange }: { onPasswordChange: () => void }) {
  return <section aria-labelledby="password-settings-title">
    <h3 id="password-settings-title" className="sr-only">Senha</h3>
    <p className="text-sm leading-6 text-[#52658f]">Gerencie a senha usada para acessar sua conta.</p>
    <div className="mt-8 flex flex-col gap-5 rounded-xl border border-[#d8e5f4] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="font-semibold text-[#172653]">Senha</p><p className="mt-2 text-sm tracking-[.18em] text-[#7182a8]">••••••••••••</p></div>
      <Button variant="secondary" onClick={onPasswordChange}>Alterar senha</Button>
    </div>
  </section>
}
