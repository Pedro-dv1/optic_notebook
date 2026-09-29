# Pacote de navegação, calendário e preferências do NoteSync

As alterações locais que já existiam foram preservadas. Nenhum commit ou push foi feito. Nenhuma dependência foi adicionada.

Foi mantido `.tmp-notesync-navigation-before/`, um backup criado para comparar somente as alterações deste pacote com o estado inicial do workspace. A revisão automática bloqueou sua remoção por política do ambiente. Os arquivos temporários de verificação também permanecem locais.

## Comportamento implementado

- **Senha:** o login abre `PasswordChangeFlow`, o mesmo componente das configurações. O único acréscimo de interface é informar o e-mail quando não há sessão. Código, autorização, expiração, reenvio, validações de senha, notificações de segurança e revogação de sessões continuam no serviço existente. Após o sucesso, o usuário volta ao login.
- **Agenda/Calendário:** o switch e “Agendar horário” compartilham um grupo de ações. Em celulares menores, ficam empilhados no mesmo grupo; quando há espaço, ficam lado a lado.
- **Menu mobile:** abaixo de 768 px, a navegação fixa contém apenas Explorar, Agendamentos e Perfil. Usa `/cliente/procurar`, `/cliente` e `/cliente/conta`, com ícones, texto e indicação do item ativo. A rota de conta anteriormente redirecionava para a agenda; agora apresenta os mesmos painéis de perfil e configurações reutilizados por `AccountMenu`. `viewport-fit=cover`, safe-area do header e padding inferior reservam espaço para notch e indicador de início do iOS.
- **Header:** a logo pública é centralizada em relação à viewport no mobile. Os controles de conta e agenda ficam ocultos no header quando a navegação inferior está disponível. A navegação administrativa/profissional é preservada; o header mobile administrativo também centraliza sua logo.
- **Calendário:** desktop e mobile mostram o número do dia e a contagem exata em um badge azul. As células têm altura fixa por breakpoint. Ao selecionar um dia, o dialog existente carrega a lista paginada; selecionar um agendamento abre os detalhes existentes. Cards dentro dos dias foram removidos.
- **Horários:** Agenda/Calendário e Manhã/Tarde/Noite usam `SegmentedControl`, que aceita quantidades variáveis de opções. Um único indicador desliza entre os segmentos. Períodos sem disponibilidade continuam desabilitados.
- **Datas:** as setas de mês têm apenas chevrons, área de clique de 44 px, hover, interação e foco. A opção de ir diretamente para uma data foi removida do picker, inclusive seu handler e import exclusivos.
- **Acessibilidade:** botões mantêm nomes acessíveis, teclado e foco visível; controles segmentados usam `aria-pressed`; navegação usa `nav` e `aria-current`. A recuperação possui ID próprio para o e-mail, evitando conflito com o login. Transições respeitam `prefers-reduced-motion`.

## Persistência dos lembretes

`User.notification_preference` é um booleano nullable no backend:

| Valor | Significado | Próximo agendamento |
| --- | --- | --- |
| `null` | Nunca respondeu | Exibe a escolha |
| `true` | Aceitou | Usa a preferência sem repetir a pergunta |
| `false` | Recusou | Não pergunta nem ativa lembretes |

A escolha inicial é salva por PATCH no perfil autenticado, inclusive a recusa. Configurações permite mudar entre receber e não receber. `auth/me/` devolve o valor ao restaurar a sessão em qualquer dispositivo. Não há persistência da preferência em localStorage.

Novos agendamentos com preferência aceita são vinculados aos dispositivos Web Push ativos do próprio cliente no backend. Um navegador já autorizado pode ser registrado silenciosamente pelo fluxo existente. A recusa também impede o envio para vínculos antigos. A escolha na conta e a permissão do navegador são estados distintos: trocar de dispositivo não apaga a preferência, mas o novo navegador precisa ter autorizado notificações para recebê-las. Agendamentos guest continuam com ativação opcional por token e não tentam atualizar um perfil.

## Endpoints e migration

Nenhum endpoint foi criado. Foram estendidos os endpoints existentes:

- `POST /api/v1/customers/security/password/request/`: aceita e-mail no fluxo sem login; mantém o fluxo autenticado vinculado ao próprio usuário.
- `POST /api/v1/customers/security/password/verify/`: reutiliza o desafio existente para identificar o usuário no fluxo sem sessão.
- `POST /api/v1/customers/password/change/`: reutiliza a autorização existente e os validadores da conta.
- `GET /api/v1/auth/me/` e `GET/PATCH /api/v1/customers/profile/me/`: incluem a preferência de notificações.
- `POST /api/v1/push/subscriptions/`: respeita uma preferência explicitamente recusada.

As três etapas de senha exigem CSRF. Limites de recuperação por identidade/IP usam a mesma tabela e implementação de rate limiting existente. E-mails desconhecidos/inativos recebem o mesmo formato público de resposta; não ganham desafios válidos nem contas. As recomendações de recuperação foram consultadas no [guia oficial da OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), pois os arquivos de referência ASVS indicados pela skill local não estavam disponíveis.

`backend/accounts/migrations/0004_user_notification_preference.py` acrescenta somente `notification_preference boolean NULL` a `accounts_user`. Contas existentes começam em `null`, sem presumir consentimento a partir de subscriptions antigas. A migration precisa ser aplicada antes de iniciar esta versão:

```powershell
cd backend
.venv/Scripts/python.exe manage.py migrate
```

## Arquivos deste pacote

| Área | Arquivos alterados |
| --- | --- |
| Conta/backend | `backend/accounts/models.py`, `backend/accounts/serializers.py`, `backend/accounts/account_security.py`, `backend/customers/views.py` |
| Agendamento/backend | `backend/bookings/operations.py`, `backend/bookings/notifications.py`, `backend/bookings/views.py` |
| Layout/rotas | `frontend/index.html`, `frontend/src/app/App.tsx`, `frontend/src/components/PublicLayout.tsx`, `frontend/src/components/AppShell.tsx`, `frontend/src/styles/index.css` |
| Calendário/horários | `frontend/src/components/CustomerCalendar.tsx`, `frontend/src/components/BookingDatePicker.tsx`, `frontend/src/components/TimeSlots.tsx` |
| Conta/frontend | `frontend/src/components/account/AccountMenu.tsx`, `frontend/src/components/account/PasswordChangeFlow.tsx`, `frontend/src/components/account/SettingsDialog.tsx` |
| Páginas | `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/CustomerAccountPage.tsx`, `frontend/src/pages/PublicBookingPage.tsx`, `frontend/src/pages/SupportPage.tsx` |
| Integração/frontend | `frontend/src/lib/push.ts`, `frontend/src/types/api.ts` |
| Testes existentes | `frontend/src/test/app-flows.test.tsx`, `frontend/src/test/package-features.test.tsx` |
| Documentação | `backend/README.md`, este relatório |

Arquivos novos:

- `frontend/src/components/SegmentedControl.tsx`
- `frontend/src/components/CustomerMobileNavigation.tsx`
- `frontend/src/components/BookingReminders.tsx`
- `frontend/src/components/account/NotificationSettings.tsx`
- `frontend/src/pages/CustomerProfilePage.tsx`
- `frontend/src/test/navigation-preferences.test.tsx`
- `backend/platform_core/tests/test_navigation_preferences.py`
- `backend/accounts/migrations/0004_user_notification_preference.py`

## Verificação

- A suíte completa do frontend passou: **94 testes em 10 arquivos**, com `npm.cmd run test -- --testTimeout 30000`. Os 10 novos testes também passaram isoladamente, cobrindo recuperação pelos mesmos endpoints, rota de perfil, contagem/listagem paginada, segmentos variáveis, aceitação/recusa anterior e comportamento guest. O timeout ampliado acomodou a execução neste ambiente; as assertions foram preservadas.
- TypeScript, build de produção e ESLint passaram.
- `manage.py check`, `makemigrations --check --dry-run`, geração SQL da migration e validação de sintaxe Python passaram.
- Quatro testes de backend sem banco passaram: serviço de e-mail, configuração Push e helpers de mensagens/pesquisa.
- A suíte completa do backend encontrou 159 testes, mas não iniciou: a role PostgreSQL configurada não tem permissão de criar banco de testes. O cluster temporário local existente também não iniciou, com erro de sinalização durante recuperação. Os novos testes de integração ficaram disponíveis para execução em PostgreSQL com permissões de teste.
- A aplicação da migration em banco e seu rollback continuam pendentes dessa infraestrutura. Nenhuma migration foi aplicada ao banco existente da aplicação.
- A responsividade foi revisada no código: grupos de ações, breakpoints, larguras, altura das células, safe-area, padding inferior e camadas de dialogs. A inspeção visual em celulares/tablets/desktop reais não foi executada porque a ferramenta de navegador não disponibilizou nenhum browser.

## Configuração externa

Continuam necessárias as configurações existentes de Resend/domínio remetente, VAPID, HTTPS e o scheduler de `process_notifications`. Nenhum serviço novo foi introduzido. Para encerrar a validação, é necessário um PostgreSQL com permissão de criar o banco de testes e um navegador disponível para inspeção visual.
