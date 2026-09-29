# NoteSync backend

Django REST API for the first NoteSync scheduling release. The project uses PostgreSQL only and keeps company-owned data explicitly scoped by `Company`.

## Local setup

1. Create and activate a Python 3.12 virtual environment.
2. Install direct dependencies with `python -m pip install -r requirements.txt`.
3. Copy `.env.example` to `.env` and provide local values. Never commit `.env`.
4. Create the PostgreSQL database and role named in `.env`.
5. Run `python manage.py migrate` and `python manage.py check`.

Create the first platform owner with `python manage.py createsuperuser`. Platform privileges are determined only by Django's `is_superuser` flag; `PLATFORM_ADMIN_EMAIL` does not grant access.

Tests use Django's PostgreSQL test database and therefore require the configured database role to have permission to create and drop a dedicated test database:

```powershell
python manage.py test
python manage.py test --tag=adversarial_1
python manage.py test --tag=adversarial_2
```

## API

All routes use `/api/v1/`.

- Auth: `auth/csrf/`, `auth/login/`, `auth/refresh/`, `auth/logout/`, `auth/me/`. Login returns access plus user; refresh lives only in the `obn_refresh` HttpOnly cookie.
- Platform owner: `platform/metrics/`, `platform/registration-keys/`, `platform/companies/`, plus company `suspend/` and `reactivate/` actions.
- Company onboarding: `companies/register/`.
- Company admin: `company/profile/`, `company/settings/`, `company/customers/`, and routers for `services/`, `professionals/`, `work-schedules/`, and `appointments/` (including `confirm/` and `cancel/`).
- Public: `public/platform/`, paginated active-company search at `public/companies/`, `public/companies/{slug}/`, privacy-preserving view tracking at `public/companies/{slug}/view/`, `services/`, `professionals/`, `availability/`, and appointment create/cancel/reschedule routes.
- Legal: `legal/current/` publishes the server-controlled current Terms and Privacy versions and returns only the authenticated caller's acceptance state.
- Customer: `customers/register/`, `customers/profile/me/` (including avatar), `customers/appointments/` with cancel/reschedule actions, and the account-security routes below.

### Customer account security

Changing an e-mail address or password requires an authenticated customer and never accepts a user id from the browser. Password changes use `customers/security/password/request/`, `customers/security/password/verify/`, then the compatible final route `customers/password/change/`. E-mail changes use the current-address `request/` and `verify/` routes followed by the new-address `request/` and `verify/` routes under `customers/security/email-change/`.

The backend creates six-digit codes with Python's cryptographic RNG and stores only Django password hashes. Codes expire after 10 minutes, allow five wrong attempts, have a 60-second resend cooldown, are single-use and are bound to one of `PASSWORD_CHANGE`, `EMAIL_CHANGE_CURRENT`, or `EMAIL_CHANGE_NEW`. Successful verification creates a separate random, single-use authorization valid for 10 minutes; only its SHA-256 digest is stored.

Security endpoint limits are persisted in PostgreSQL and therefore work across application workers: code requests and sensitive final actions allow five attempts per 10-minute user/IP/purpose window, while verification endpoints also have a 15-attempt endpoint window and each challenge still stops after five wrong codes. Old fixed windows are removed opportunistically. These limits supplement, rather than replace, reverse-proxy/CDN controls.

After a password change, `auth_version` invalidates every existing access JWT immediately and all outstanding refresh JWTs are blacklisted. The customer must sign in again.

### Transactional e-mail

All account-security e-mail is sent server-side through the shared Resend service. Configure:

```dotenv
EMAIL_PROVIDER=resend
RESEND_API_KEY=replace-with-a-resend-api-key
DEFAULT_FROM_EMAIL="NoteSync <no-reply@your-verified-domain.example>"
```

The sender domain must be verified in Resend. Never expose these values through `VITE_*` variables. Production configuration fails closed if the provider, API key, or sender is missing. A failed OTP delivery returns a generic service error and leaves no valid challenge. Security notifications are best-effort after the database transaction and failures are recorded without addresses, codes, tokens, or passwords.

Registration authorization keys and anonymous appointment-management tokens are returned in full only when issued. Only SHA-256 digests of the high-entropy random secrets are stored. Passwords use Django's password system with Argon2 preferred. JWT refresh tokens rotate, the previous token is blacklisted, and refresh/logout are protected by Django CSRF.

Company search accepts `search` (or the compatible `q` alias), `state`, `city`, `niche`, `business_type`, `service`, `ordering=recommended|name|-name`, `page`, and `page_size`. The default `recommended` order prioritizes the authenticated customer's own favorites before pagination, without excluding other matches. Anonymous customers and customers without favorites retain alphabetical results. Explicit alphabetical ordering remains available. Filtering happens in PostgreSQL with the `unaccent` extension, so relevant searches ignore case and accents, while public responses omit owner and administrative data. Service and location filters must match the same active unit. Company views are aggregated daily; only a SHA-256 digest of the browser-generated anonymous identifier is stored, and repeated views inside a 30-minute window are ignored.

Each service owns its scheduling interval. Migration `services.0003` copies the former company-wide interval to every existing service before enforcing the new field. The legacy company column remains only for database compatibility and is no longer exposed or used by availability. Company booking settings also contain tenant-scoped WhatsApp templates for waiting, confirmed and cancelled appointments; unknown placeholders are preserved as plain text and blank templates fall back to safe defaults.

Turnstile server validation can be required through `TURNSTILE_REQUIRED`; production fails closed if its secret is missing. Current scoped limits are login 5/minute plus identity/IP 20/hour, refresh 20/minute, company registration 3/hour, customer registration 5/10 minutes, anonymous booking 10/10 minutes, anonymous cancel/reschedule 10/10 minutes, availability 60/minute and light public reads 120/minute. Authenticated users also receive a 1000/hour general limit.

Customer and company account registration require separate `terms_accepted` and `privacy_accepted` booleans. Anonymous bookings show a privacy notice but do not require document acceptance. The client never selects a document version: `platform_core/legal.py` is the source of truth, and the server records its own timestamp and current version in `LegalAcceptance` during account creation.

These Django/DRF controls are application-level safeguards, not complete brute-force or denial-of-service protection. Production still requires rate limiting, request-body limits, TLS and security headers at the reverse proxy/CDN/edge. Configure a Content Security Policy for the frontend that includes the official Turnstile origins and the actual API origin.

Before deploying account-security changes, run:

```powershell
python manage.py check
python manage.py makemigrations --check
python manage.py test
```

## Web Push e lembretes

Configure `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY` e `WEB_PUSH_VAPID_SUBJECT` somente no backend. A chave pública é a única exposta ao navegador. `WEB_PUSH_ALLOWED_HOST_SUFFIXES` limita os provedores que o servidor pode contatar e pode ser ampliada quando outro navegador exigir um provedor legítimo.

Agendamentos geram eventos idempotentes no banco. Execute o comando abaixo a cada minuto pelo scheduler da infraestrutura (cron, systemd timer ou scheduler da plataforma):

```powershell
python manage.py process_notifications --limit 100
```

O comando possui tentativas limitadas, timeout de rede e desativa subscriptions quando o provedor responde 404 ou 410. Não é necessário Redis ou Celery nesta versão.

Gere o par VAPID fora do repositório, por exemplo com `vapid --gen`, e armazene a chave privada no gerenciador de segredos do ambiente. Depois de atualizar dependências e configuração, execute `python manage.py migrate` antes de ativar o scheduler.

## Unidades, favoritos e calendário

Execute `python manage.py migrate` antes de iniciar esta versão. As migrations criam a unidade principal de cada empresa com o endereço original e vinculam profissionais, jornadas e agendamentos existentes. As colunas de endereço da empresa continuam compatíveis com os consumidores antigos e acompanham a unidade principal.

`company/units/` oferece CRUD somente ao proprietário autenticado da empresa. Profissionais e serviços aceitam `unit_ids` explícitos da própria empresa; nenhum catálogo sem associação é global. Se houver apenas uma unidade ativa, ela pode ser selecionada automaticamente no cadastro. Com várias unidades, a escolha é obrigatória. Criar uma unidade nunca copia serviços ou profissionais. Associações múltiplas continuam possíveis somente por configuração explícita. Nomes iguais são permitidos em unidades diferentes, e duplicatas na mesma unidade são rejeitadas sob o lock existente da empresa.

Jornadas aceitam `unit`. Horários do mesmo profissional não podem se sobrepor entre unidades. Criação pública/manual recebe `unit`; sem esse campo, apenas empresas com uma unidade ativa selecionam automaticamente. Disponibilidade e catálogos públicos aceitam o mesmo parâmetro e validam empresa, unidade, serviço e profissional em conjunto. Listagens administrativas de serviços, profissionais, jornadas e agendamentos também aceitam `?unit=`. Histórico, catálogo associado e jornadas impedem exclusão física de unidades; desativação preserva os atendimentos anteriores. Remover vínculos usados em agendamentos futuros é rejeitado; profissionais também exigem remover suas jornadas antes de desvincular uma unidade.

A migration `services.0005` converte somente serviços legados sem vínculo em associações explícitas à unidade principal e às unidades comprovadas por agendamentos ou profissionais já vinculados. Vínculos explícitos anteriores são preservados. Ela e `professionals.0006` retiram a unicidade de nome por empresa. Execute `python manage.py migrate` antes de iniciar esta versão. Para reverter essas constraints após cadastrar nomes iguais em unidades diferentes, resolva previamente as duplicatas por empresa; o backfill não apaga associações na reversão.

`customers/favorites/` permite listar, adicionar e remover favoritos do próprio cliente. As ações `status/`, `suggestions/` e `dismiss-suggestion/` fornecem estados, sugestões após três agendamentos confirmados válidos e recusa persistente por empresa. Cancelados, aguardando confirmação e não comparecimentos não contam.

`customers/appointments/` aceita `start_date` e `end_date`. A ação `calendar/` exige intervalo de até 31 dias e devolve contagem por dia com até três prévias; a listagem paginada permite consultar todos os eventos de um dia.

## Exclusão de conta e expiração

`POST auth/account/delete/` exige autenticação, CSRF, senha atual e `confirmation: "EXCLUIR"`. Não recebe identificador de outro usuário. A exclusão é transacional, revoga tokens e acesso, anonimiza o histórico vinculado ao cliente, cancela seus agendamentos futuros e preserva os dados das empresas. Proprietários de empresa e administradores da plataforma precisam resolver a titularidade com suporte antes da exclusão. Autoria de resultados, indisponibilidades e convites pode ficar vazia após exclusão, preservando os registros.

O comando periódico `process_notifications` acima também cancela solicitações `WAITING_CONFIRMATION` cujo início já passou, antes de processar notificações. Ele deve continuar sendo executado a cada minuto pelo scheduler da infraestrutura, inclusive sem usuários conectados. Não depende de VAPID para atualizar o status no banco. A operação é idempotente, processa lotes limitados e registra `EXPIRED_UNCONFIRMED`; agendamentos confirmados e resultados finais são preservados.

Se a infraestrutura separar os jobs, o comando equivalente somente para expiração é:

```powershell
python manage.py expire_pending_appointments --limit 500
```

Leituras autenticadas normalizam também o próprio escopo, e a confirmação revalida o registro sob lock. Esses mecanismos complementam o scheduler; não o substituem.
