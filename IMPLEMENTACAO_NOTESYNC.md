# NoteSync — auditoria, plano e acompanhamento

## Estado inicial e preservação

Auditoria realizada em 26/09/2026 antes de editar código. Há alterações locais extensas em backend, frontend, branding, testes, notificações e permissões. Nenhum commit/push/reset será feito. A implementação parte dos arquivos atuais; migrations já presentes não serão reescritas.

## Arquitetura encontrada

- Backend Django/DRF, PostgreSQL obrigatório; apps accounts, companies, customers, professionals, services, bookings e platform_core. Rotas em `backend/config/urls.py`, prefixo `/api/v1/`.
- `accounts.User` UUID é também o cliente global (`customers/models.py` não possui tabela). Avatar com caminho UUID, validação Pillow, 2 MB, dimensões limitadas e remoção após commit. Perfil e segurança do cliente em customers/views e accounts/serializers/account_security.
- Empresa: `companies.Company`, proprietário OneToOne PROTECT, endereço/cidade/UF diretamente no model; sem coordenadas ou CEP. `CompanyBookingSettings` contém tolerância, antecedência e mensagens de WhatsApp.
- Profissional: `Professional`, empresa FK, serviços M2M, usuário opcional PROTECT, convites; `WorkSchedule` por profissional/dia/intervalo; indisponibilidades globais por profissional. Serviços pertencem à empresa; duração e intervalo pertencem ao serviço.
- Agendamento: `Appointment`, FKs PROTECT para empresa/serviço/profissional; cliente SET_NULL; snapshots de contato. Status reais: WAITING_CONFIRMATION, CONFIRMED, CANCELLED. Resultados separados: COMPLETED, NO_SHOW. Criação/reagendamento usam bookings/operations, lock de profissional e constraint PostgreSQL contra sobreposição global.
- APIs públicas: configuração/suporte, busca paginada server-side unaccent, empresa, serviços, profissionais, disponibilidade, criação/cancelamento/reagendamento com credencial hash e push/avaliações. APIs privadas são delimitadas por cliente, empresa ou profissional.
- Auth: acesso JWT em memória, refresh HttpOnly rotativo/blacklist, CSRF em login/refresh/logout/cadastros, `auth_version` e permissões por papel. Nenhuma dessas proteções será removida.
- Exclusão ainda inexistente. Relações sensíveis: ownership, profissional.user, autores de resultado/eventos/convites/indisponibilidade/chaves, snapshots, avaliações, push, aceitações legais, OTPs, autorizações e tokens. Política não destrutiva: recusar self-delete de proprietário/plataforma; apagar clientes/profissionais, anonimizar seus snapshots e desvincular autores mantendo histórico empresarial.
- Notificações persistidas/idempotentes e comando `process_notifications` já existente, previsto a cada minuto. Será reutilizado para expiração e terá comando dedicado opcional.
- Frontend React/TS/Vite/Tailwind, React Query (cache/query keys/invalidation), rotas já lazy em App.tsx. AuthProvider limpa cache/sessão; api/client centraliza erros/CSRF/refresh/timeouts.
- Landing HomePage atualmente só apresenta dois cards (/comercio e /cliente/login); Header em PublicLayout; Footer compartilhado com logo grande, telefone/Instagram e autoria OpticACS existente. Sem URL ManageOne configurada: preservar crédito real, reorganizando-o.
- Busca em CustomerHubPage já tem debounce 300 ms, filtros em drawer, paginação, cache 60 s; falta cancelamento da request obsoleta e remoção do botão Pesquisar.
- Agendamento público em PublicBookingPage; etapas serviço/profissional/data/dados/revisão/confirmação. AdminManualBooking e ProfessionalPage também criam agendamentos. CustomerAccountPage possui cards, detalhes, cancelamento/reagendamento/avaliação, mas só a primeira página; não existe calendário de cliente/favoritos.
- Reuso: Button/Field/SelectField/Dialog/Notice/LoadingState, AccountModalShell (portal/foco/teclado), AccountMenu/ProfilePanel/SecuritySettings, ProfileAvatar, StatusBadge, CityAutocomplete, formatação e safeImageUrl. Agenda admin possui dias; não há calendário mensal reutilizável.
- CSS já contém transições e reduced-motion; GSAP é usado pela introdução de marca local. Não adicionar biblioteca de animação. VLibras está em App.tsx, componente próprio e CSS.
- Testes: Django TestCase/APITestCase/TransactionTestCase em platform_core/tests; Vitest/Testing Library em frontend/src/test. Scripts test/typecheck/lint/build existentes. Check Django inicial PASS; testes backend inicialmente bloqueados por CREATEDB. Baseline frontend em execução.

## Decisões e etapas

1. Estrutura: CompanyUnit com endereço/cidade/UF, ativa/principal; backfill aditivo de empresa/jornadas/agendamentos/profissionais, sem apagar colunas antigas. Sincronizar endereço legado com principal para clientes/API antigos. Principal única por constraint, transações e lock da empresa; exclusão protegida por histórico.
2. Profissionais M2M unidades; jornadas por unidade, com sobreposição proibida entre locais. Serviços globais quando associação vazia, restringíveis por M2M. Mesma regra de validação aplicada à disponibilidade, criação pública/manual e reagendamento. Disponibilidade ocupada globalmente por profissional.
3. Favoritos únicos usuário/empresa e recusa de sugestão persistida. Sugestão após >=3 CONFIRMED, sem NO_SHOW; inclui COMPLETED e confirmados futuros, exclui WAITING_CONFIRMATION/CANCELLED. Uma recusa suprime permanentemente a sugestão para aquela empresa (favorito manual continua possível).
4. Expiração somente WAITING_CONFIRMATION com starts_at <= agora, outcome nulo, transação/lock e registro de motivo/notificação. Cron existente funciona sem UI; leitura normaliza escopo e confirmação usa lock para evitar corrida. CONFIRMED e resultados preservados.
5. Calendário consulta intervalo mensal limitado/paginado por cliente, abre detalhes existentes. Paginar lista existente para não esconder histórico ou futuros.
6. Exclusão autenticada self-only, CSRF explícito, senha atual e texto EXCLUIR; transação, anonimização de snapshots vinculados, revogação de credenciais/push/tokens e arquivo após commit. Recusar ownership/plataforma, sem cascata de empresas. Autores históricos nullable, sem apagar eventos.
7. Avatar: câmera sobreposta, escolher arquivo/câmera nativa mobile e captura getUserMedia em dispositivos compatíveis, cancelar/parar tracks/revogar URLs. Backend valida conteúdo e normaliza imagem para remover metadados/dados anexados.
8. Frontend funcional: seleção de unidade automática quando uma, CRUD admin, associações serviço/profissional/jornada, favorito/sugestão/lista, calendário, carrossel mensal/dias e períodos filtrando slots reais; propagar unidade aos detalhes/reagendamento/manual/profissional.
9. Institucional: landing original com apresentação/benefícios/fluxo/cards abaixo; suporte só com configuração real; logos menores; footer reorganizado; VLibras removido. CSS leve, teclado, foco, contraste e reduced-motion.
10. Performance: medir bundle antes/depois; manter lazy routes; queries relacionadas prefetch/select_related; calendário mensal paginado; busca AbortController; índices apenas para expiração/localização. Evitar hooks/dependências novas sem necessidade.
11. Validação: testes específicos e suites completas, migrations forward/reverse/backfill, check/makemigrations --check, typecheck/lint/build; inspeção visual desktop/tablet/mobile e revisão de segurança/diff contra estado inicial.

## Checklist integral (atualizada durante a execução)

- [x] Nova landing completa
- [x] Referência usada apenas como inspiração
- [x] Cards "Como deseja acessar" movidos para baixo
- [x] Segurança nas configurações
- [x] Exclusão permanente de conta
- [x] Exclusão segura no backend
- [x] Sessão/tokens invalidados após exclusão
- [x] Botão de câmera no avatar
- [x] Captura por câmera
- [x] Importação de galeria/arquivo
- [x] Upload validado com segurança
- [x] Logo menor no Header
- [x] Logo menor no Footer
- [x] Footer com copyright + produzido por
- [x] Produto -> Plataforma
- [x] Telefone removido
- [x] Suporte adicionado
- [x] Página de suporte criada
- [x] Instagram removido
- [x] VLibras removido
- [x] Calendário do cliente
- [x] Agendamentos no calendário
- [x] Favoritar empresa
- [x] Lista de favoritos
- [x] Sugestão após 3 agendamentos
- [x] Sugestão não aparece infinitamente
- [x] Novo carrossel de datas
- [x] Seletor de mês
- [x] Novo layout de horários
- [x] Manhã / Tarde / Noite
- [x] Múltiplas unidades
- [x] Migration/backfill de unidade
- [x] CRUD de unidades no admin
- [x] Unidade integrada ao agendamento
- [x] Unidade integrada aos profissionais quando necessário
- [x] Unidade integrada à disponibilidade
- [x] Unidade integrada à busca
- [x] Compatibilidade com empresas antigas
- [x] Botão azul "Pesquisar" removido
- [x] Pesquisa por input/debounce/Enter funcionando
- [x] Botões secundários transparentes + borda azul
- [x] Pending expirado vira CANCELLED
- [x] Confirmed expirado NÃO vira cancelled
- [x] Expiração acontece no backend
- [x] Mais microtransições
- [x] prefers-reduced-motion
- [x] Otimização frontend
- [x] Otimização backend
- [x] Segurança revisada
- [ ] Responsividade revisada
- [ ] Acessibilidade revisada
- [x] Migrations testadas
- [x] Backend tests
- [x] Frontend tests
- [x] Typecheck
- [x] Lint
- [x] Production build
- [ ] Regressão dos fluxos existentes

## Evidências e relatório


## 1. Implementação por feature

O pacote funcional está incorporado ao código e ao banco local. A entrega permanece com validação manual pendente; não foi declarada integralmente concluída.

- Landing original com hero, apresentação real do painel, benefícios, configuração/serviços/equipe/horários, fluxo em três passos e os dois cards de acesso abaixo da apresentação. A [referência solicitada](https://www.minhaagendavirtual.com.br/) foi consultada somente para hierarquia de informação; textos, componentes e assets não foram copiados.
- Segurança nas configurações: exclusão permanente com senha atual e texto EXCLUIR, operação transacional, revogação de acesso/refresh/cookie/sessão, anonimização de histórico e retorno público. Ações de cliente, profissional e proprietário recebem tratamento coerente com seus vínculos.
- Avatar: câmera sobreposta, captura getUserMedia com prévia e cancelamento, fallback de câmera do dispositivo e galeria/arquivos. Tracks e URLs temporárias são liberados. Prévia local funciona sem ampliar os protocolos aceitos para URLs de avatar vindas da API.
- Branding e footer: dimensões menores, Plataforma, suporte, telefone/Instagram removidos e copyright/autoria na mesma linha em desktop. Preservada a atribuição OpticACS realmente existente no projeto. Derivados de marca otimizados mantêm os arquivos originais.
- Suporte público em /suporte com perguntas frequentes, links úteis e somente o e-mail fornecido por /public/platform/. Estado sem configuração não inventa contato.
- VLibras removido: componente, inclusão e regras diretamente relacionadas, sem remoção de proteções de acessibilidade.
- Cliente: navegação Agendamentos/Calendário/Favoritos; calendário mensal privado, contagens e prévias, consulta paginada por dia e abertura dos detalhes existentes; listagem antiga agora possui paginação real.
- Favoritos: persistência, unicidade, adicionar/remover, estados na busca/página da empresa, lista para novo agendamento e sugestão server-side após três agendamentos válidos. Agora não suprime a sugestão daquela empresa persistentemente.
- Data/horário: carrossel de dias do mês com disponibilidade real, navegação mensal, scroll/setas/teclado, seleção distinguível e períodos Manhã/Tarde/Noite sobre os slots retornados pelo backend.
- Unidades: CRUD administrativo completo, principal única e ativa, ativação/desativação, histórico protegido, profissionais em várias unidades, serviços globais ou associados, jornadas por unidade, busca por localização de filial, seleção pública/manual/profissional e informação nos agendamentos. Uma única unidade ativa é escolhida automaticamente.
- Busca: input com debounce/Enter, cancelamento de requests obsoletas, filtros e paginação preservados; botão Pesquisar removido.
- Botões e UX: variantes secundárias transparentes com borda azul, estados hover/active/selected/disabled/focus; microtransições CSS, reduced-motion, foco visível e contraste ajustado. Calendário mobile, cabeçalhos e cartões de unidades receberam limites de espaço/quebra de conteúdo.
- Expiração: solicitações vencidas tornam-se CANCELLED no banco com motivo, processamento independente da tela, idempotência e notificações. Confirmação revalida o próprio agendamento mesmo com backlog do worker. CONFIRMED, COMPLETED e NO_SHOW não são cancelados pela rotina.

## 2. Arquivos principais e finalidade

| Caminho | Finalidade |
|---|---|
| backend/companies/models.py, serializers.py, views.py | CompanyUnit, principal, CRUD e busca por unidades |
| backend/professionals/models.py, serializers.py, views.py | Associações, jornadas por unidade, autorização e autoria histórica |
| backend/services/models.py, serializers.py, views.py | Serviços globais/por unidade e validação do tenant |
| backend/bookings/models.py, operations.py, serializers.py, views.py | Unidade do atendimento, disponibilidade, criação/reagendamento, período/calendário e leitura integrada |
| backend/bookings/expiration.py e management/commands | Expiração limitada, idempotente e integração com job existente |
| backend/customers/models.py, serializers.py, views.py | Favoritos, recusa persistente e regra dos três agendamentos |
| backend/accounts/deletion.py, serializers.py, views.py | Exclusão segura da própria conta e invalidação de acesso |
| backend/platform_core/validators.py | Validação/normalização real de imagem |
| backend/config/urls.py, settings.py | Rotas e limite de tentativas da exclusão |
| backend/platform_core/tests/test_notesync_package.py | 26 testes adicionais de integração, concorrência, autorização, dados e migrations |
| frontend/src/components/BookingDatePicker.tsx, TimeSlots.tsx | Seleção reutilizável de datas e períodos |
| frontend/src/components/CustomerCalendar.tsx, CustomerFavorites.tsx, FavoriteButton.tsx | Calendário, favoritos e sugestão |
| frontend/src/components/UnitFields.tsx, pages/admin/AdminUnitsPage.tsx | Associações reutilizáveis e CRUD administrativo |
| frontend/src/pages/PublicBookingPage.tsx, CustomerAccountPage.tsx, CustomerHubPage.tsx | Integração dos fluxos públicos e do cliente |
| frontend/src/pages/admin/AdminPages.tsx, AdminManualBooking.tsx, AdminRoutes.tsx e pages/ProfessionalPage.tsx | Integração administrativa/profissional e seleção de unidade |
| frontend/src/components/account/AccountDeletion.tsx, ProfileDialog.tsx, AccountMenu.tsx, SettingsDialog.tsx | Exclusão, configurações e captura/upload de avatar |
| frontend/src/pages/HomePage.tsx, SupportPage.tsx e components/PublicLayout.tsx, Footer.tsx | Landing, suporte e branding |
| frontend/src/components/ui.tsx, styles/index.css | Estados visuais, modais, foco, transições e reduced-motion |
| frontend/src/api/client.ts, types/api.ts, lib/format.ts | AbortSignal, contratos adicionais e fuso de Brasília |
| frontend/src/app/App.tsx, components/AppShell.tsx, index.html e assets/branding | Rotas, menu, remoção de VLibras e assets otimizados |
| frontend/src/test/package-features.test.tsx e testes existentes adaptados | Integração de componentes, câmera, suporte, favoritos, calendário, unidades e regressões |
| backend/README.md | Migrations, contratos e operação do job periódico |

Alterações preexistentes foram preservadas, incluindo branding original, introdução GSAP, notificações, permissões e migrations locais. A revisão comparou os arquivos com a cópia inicial em diretório temporário, em vez de atribuir todo o git diff a esta tarefa. Nenhum commit, push, reset ou checkout de arquivos do usuário foi feito.

## 3. Banco e migrations

| Migration nova | Alteração |
|---|---|
| companies/0008_companyunit.py | CompanyUnit, unicidade de nome/principal por empresa, principal ativa e índice de localização |
| professionals/0004_professional_units_workschedule_unit.py | Professional.units M2M e WorkSchedule.unit nullable/PROTECT |
| services/0004_service_units.py | Service.units M2M; vazio preserva serviço global |
| bookings/0003_appointment_cancellation_reason_appointment_unit_and_more.py | Appointment.unit nullable/PROTECT, cancellation_reason e índice parcial de pendentes vencidos |
| bookings/0004_alter_appointmentoutcomeevent_actor.py | Autoria histórica de resultados SET_NULL |
| companies/0009_backfill_units.py | Endereço original vira unidade Principal; vínculo de profissionais, jornadas e agendamentos antigos |
| customers/0001_initial.py | CompanyFavorite e FavoriteSuggestionDismissal, únicos por cliente/empresa |
| professionals/0005_alter_professionalaccessinvite_created_by_and_more.py | Autoria de convites/indisponibilidades SET_NULL, preservando registros após exclusão |

As oito migrations foram aplicadas em desenvolvimento e exercitadas no PostgreSQL de testes. Check de migrations sem alterações pendentes. O teste migra o schema antigo para o novo e reverte, verificando endereço e agendamento originais. A reversão do backfill não apaga endereços legados; rollback das tabelas novas naturalmente não preserva novos favoritos/filiais. Reverter autores para NOT NULL após excluir suas contas exige tratar previamente os registros sem autor; não é possível recriar identidades apagadas.

Verificação do banco local após backfill: uma empresa, nenhuma sem principal, nenhum agendamento/jornada/profissional legado sem unidade. Campos antigos de endereço permanecem sincronizados com a principal.

## 4. APIs criadas/alteradas

Todos os caminhos abaixo têm prefixo /api/v1/.

| Endpoint | Método | Finalidade |
|---|---|---|
| auth/account/delete/ | POST | Excluir somente a própria conta com senha, EXCLUIR e CSRF |
| company/units/ e company/units/{id}/ | GET/POST/PUT/PATCH/DELETE | CRUD restrito ao tenant; principal e histórico protegidos |
| customers/favorites/ | GET/POST | Listagem paginada e criação idempotente |
| customers/favorites/{id}/ | DELETE | Remover somente favorito do próprio cliente |
| customers/favorites/status/ | GET | Estado de uma empresa ou lote de até 48 IDs |
| customers/favorites/suggestions/ | GET | Até três empresas elegíveis, com contagem real |
| customers/favorites/dismiss-suggestion/ | POST | Persistir recusa para o cliente/empresa |
| customers/appointments/calendar/ | GET | Contagens diárias e até três prévias/dia, intervalo máximo 31 dias |
| customers/appointments/ | GET | Filtro start_date/end_date, máximo 63 dias, paginação e escopo próprio |
| public/companies/{slug}/availability/days/ | GET | Dias disponíveis do período, máximo 31 dias, por serviço/profissional/unidade |
| public/companies/{slug}/availability/ | GET | Slots reais com validação de unit |
| public/companies/ e public/companies/{slug}/ | GET | ID público/filiais ativas e localização por unidade |
| public/companies/{slug}/services/ e professionals/ | GET | Filtro por unit e associações |
| company/services/ e company/professionals/ | GET/POST/PUT/PATCH | unit_ids validados e alterações de catálogo coordenadas por lock da empresa |
| company/work-schedules/ e week/ | CRUD / POST | Jornada com unidade, membro correto e sem sobreposição entre locais |
| public/companies/{slug}/appointments/ | POST | Salvar unidade validada; única ativa automática |
| company/appointments/manual/ e professional/appointments/manual/ | POST | Mesmo domínio/validação de unidade no cadastro manual |
| professional/appointments/units/ | GET | Somente unidades ativas do profissional autenticado |
| professional/appointments/services/ | GET | Associações de unidades dos serviços próprios |
| Agendamentos, dashboard e relatórios existentes | GET/ações | Unidade/motivo nas respostas e normalização de pendentes vencidos |
| customers/profile/me/ e company/profile/ | PATCH | Upload normalizado e validado no backend |

## 5. Decisões arquiteturais

Unidades têm model próprio e endereço/cidade/UF, exatamente os dados existentes; não foram inventados CEP ou coordenadas. A unidade principal é única/ativa por constraints e operações transacionais. Profissionais não são duplicados: atuam em várias unidades, com jornadas próprias e ocupação global. Serviços continuam globais por padrão. Agendamentos históricos mantêm unidade e referências protegidas.

Cliente continua sendo accounts.User global. Favorito e recusa são relações próprias, com constraint de unicidade. Três vezes significa pelo menos três CONFIRMED com outcome vazio ou COMPLETED; WAITING_CONFIRMATION, CANCELLED e NO_SHOW não contam. Recusa permanente por empresa evita repetição entre dispositivos, sem impedir favorito manual.

Expiração usa starts_at timezone-aware em America/Sao_Paulo e atinge somente WAITING_CONFIRMATION sem outcome. Reutiliza process_notifications, já previsto no projeto para execução a cada minuto; comando dedicado permite separação operacional. Lotes com skip_locked evitam disputa entre workers. Leituras normalizam o próprio escopo e confirmação verifica o alvo sob lock mesmo com backlog. Locks da empresa usam FOR NO KEY UPDATE: serializam mudanças de catálogo sem bloquear referências por FK e provocar ciclo com o lock do profissional. Teste com duas conexões reais disputa criação de agendamento e indisponibilidade, rejeitando corretamente a reserva sem deadlock.

Exclusão não apaga empresas nem registros profissionais. Proprietário/plataforma deve resolver titularidade antes de excluir; o backend recusa a ação. Para clientes/profissionais elegíveis, o User é apagado, agendamentos futuros vinculados como cliente são cancelados e snapshots desses vínculos são anonimizados. Contatos de agendamentos anônimos/manual sem FK para esse usuário não são removidos por simples coincidência de e-mail: isso poderia modificar dados de terceiros. Autoria histórica é desvinculada e a empresa mantém o registro profissional sem acesso.

Não foi criada biblioteca de calendário, animação ou câmera. Foram reutilizados React Query, componentes atuais e capacidades nativas do browser. A ordem planejada foi mantida; ajustes de autoria/migrations surgiram na revisão final de integridade, antes da nova suíte completa.

## 6. Segurança

IDs de unidade, serviço/profissional e objetos CRUD são resolvidos dentro da empresa autenticada ou da empresa pública do slug. Calendário/favoritos usam o usuário autenticado; parâmetros não podem selecionar outra pessoa. Testes incluem unit estrangeira, cliente/profissional sem permissão e objetos de outra empresa. Principal e unicidade também têm proteção de banco.

Exclusão exige autenticação, CSRF explícito, senha atual, confirmação e limite persistente de tentativas. Rejeita identificador extra de usuário. Locks coordenam exclusão/criação de agendamentos; credenciais de gerenciamento/avaliação e push são removidas. Refresh é blacklisted e a exclusão do usuário invalida JWTs de acesso; cookie e sessão são limpos. Ownership e dados de outras empresas permanecem protegidos.

Upload valida tamanho até 2 MB, assinatura/conteúdo, formato permitido PNG/JPEG/WebP, MIME coerente, dimensões/pixels e decodificação completa. Reescrita remove metadados/conteúdo anexado e armazenamento usa UUID/extensão confiável. Avatar é reduzido a 512 pixels; o limite original de entrada de 4096 pixels foi preservado. Logos existentes largos continuam aceitos dentro do limite de pixels seguro.

Auth/refresh/CSRF/rotas por papel, validações públicas, conflitos PostgreSQL e notificações existentes foram preservados. Revisão orientada aos controles de [OWASP ASVS](https://github.com/OWASP/ASVS/tree/v5.0.0/5.0/en), sem alegar certificação. Bandit dos módulos relevantes não encontrou ocorrências. Resultados das auditorias de dependências constam abaixo.

## 7. Performance medida

Baseline de produção: JavaScript inicial 360,15 KB, gzip 118,82 KB. Após as features/otimizações: 340,45 KB, gzip 112,07 KB; redução de 5,5% em bytes e 5,7% comprimido, apesar das features novas. Landing passou de 2,92 KB para 7,43 KB por incorporar conteúdo real; suporte e unidades têm chunks próprios e carregam sob demanda. Último build: 2,60 s.

As três imagens de marca servidas tinham 5.366.517 + 1.737.805 + 749.900 bytes. Derivados com identidade preservada têm 40.392 + 11.052 + 7.430 bytes: 7,85 MB para 58,87 KB, redução de aproximadamente 99,25%. Arquivos originais foram mantidos. Hero reutiliza imagem do projeto, prioridade apropriada e dimensões reais para evitar mudança de layout.

Busca recebe AbortSignal e mantém debounce 300 ms; busca manual de cliente também tem debounce/cancelamento. Estados de favorito são consultados em lote na busca, evitando uma request por card; mudanças do lote atualizam também o cache individual do coração, cobertas por teste. Calendário só monta ao abrir a aba; mês carrega no máximo 93 prévias e o restante por dia paginado. Unidades do cadastro manual são buscadas somente ao abrir; cache compartilhado de 30 segundos evita repetição no admin.

Backend usa select_related/prefetch_related para unidades, cliente, serviço, profissional, configurações e avaliações. Disponibilidade mensal reutiliza jornadas/ocupação do período, sem consulta por dia. Sugestões contam apenas agendamentos elegíveis do usuário antes de agregar. Teste compara queries da listagem com um e seis agendamentos e limita crescimento a no máximo uma query, evitando N+1 no serializer. Índice parcial de pendentes e índice de localização correspondem a consultas reais; não foi criado cache global nem Redis.

## 8. Comandos e resultados

Comandos executados no backend usam .venv/Scripts/python.exe; os npm foram executados em frontend. As suítes completas e verificações foram repetidas após integração/correções/otimização.

| Comando | Resultado final |
|---|---|
| python manage.py migrate --noinput | PASS, oito migrations novas aplicadas no banco local |
| python manage.py makemigrations professionals | PASS, gerou migration 0005 de autoria histórica |
| python manage.py makemigrations --check --dry-run | PASS, No changes detected |
| python manage.py check | PASS, zero problemas |
| python manage.py test --noinput | PASS, 141 testes, PostgreSQL isolado; última execução 141,677 s |
| npm.cmd test -- src/test/package-features.test.tsx --reporter=verbose | PASS, testes do pacote; execução intermediária com 11 testes |
| npm.cmd test -- --run --reporter=dot | PASS, 76 testes em oito arquivos, última execução 68,56 s |
| npm.cmd run typecheck | PASS |
| npm.cmd run lint | PASS, ESLint |
| npm.cmd run build | PASS, produção |
| python -m bandit -r accounts/deletion.py bookings/expiration.py bookings/operations.py companies/views.py companies/serializers.py customers/views.py platform_core/validators.py professionals/views.py services/views.py -q | PASS, zero ocorrências |
| npm.cmd audit --json | PASS, zero vulnerabilidades reportadas |
| python -m pip_audit --local --cache-dir ./.tmp-pip-audit-cache | PASS, No known vulnerabilities found |
| python manage.py test platform_core.tests.test_notesync_package.UnitMigrationTests.test_booking_and_unavailability_do_not_deadlock_on_company_foreign_key --noinput | PASS, duas conexões PostgreSQL, 3,094 s |
| git diff --check | PASS; somente avisos de conversão LF/CRLF |

Backend tests utilizaram DB_NAME=notesync_test, DB_USER=notesync_test, DB_HOST=127.0.0.1, DB_PORT=55439 em uma instância PostgreSQL 17 isolada. A primeira tentativa com o role da configuração local falhou por ausência de CREATEDB, problema preexistente de ambiente; não foram alteradas permissões do banco do usuário.

Após as verificações, o PostgreSQL temporário e seus arquivos foram encerrados/removidos. O banco local do projeto permanece migrado. Servidores de revisão estão disponíveis em http://127.0.0.1:3000 (Vite) e http://127.0.0.1:8000 (Django). Smoke HTTP real com Invoke-WebRequest: /public/platform/ e busca pública retornaram 200; unidades, favoritos e calendário privados retornaram 401 sem autenticação, conforme esperado. Não foi utilizado cadastro real nem exclusão de conta real nessa checagem.

O proxy Vite também retornou 200 para /api/v1/public/platform/; rotas /suporte, /admin/unidades e /cliente responderam com o shell da SPA. Isso verifica disponibilidade HTTP e proxy, sem substituir inspeção da interface/renderização. A orientação de senha na página de suporte segue o fluxo existente de contato com suporte, sem anunciar redefinição automática inexistente.

Falhas intermediárias não foram ocultadas: fixtures/contratos antigos foram atualizados para unidades/novos nomes acessíveis, o limite original do avatar foi restaurado e a prévia local de foto foi corrigida. Um teste preexistente de avaliação duplicada expôs IntegrityError tratado sem savepoint; corrigido com transação aninhada. A suíte no sandbox apresentou atrasos/timeouts ao importar rotas; a repetição fora do sandbox passou integralmente. Suporte teve timeout de carregamento a frio no teste, ajustado para 5 segundos; em produção mantém o fluxo normal. O teste preexistente de VAPID ausente imprime aviso esperado, mas passa; isso não foi marcado como falha de build.

Ruff não está instalado e não há configuração de lint Python do projeto; não foi alegado PASS para Ruff. Check Django, testes e Bandit foram executados. A primeira auditoria pip foi bloqueada pelo proxy do sandbox e foi repetida com acesso externo autorizado.

Regressões automatizadas incluem login, cadastro, refresh/CSRF, busca, página pública, catálogo, disponibilidade, criação, cancelamento, reagendamento, confirmação, resultados, admin/cliente/profissional, perfil/segurança, notificações e páginas públicas. Novos testes backend cobrem relações de exclusão/tokens, favoritos/duplicidade/recusa, unidades/principal/IDOR/busca/profissional, calendário/fuso, status de expiração, uploads e migrations forward/reverse. Frontend testa filtros reais de slots/dias, calendário sob demanda/detalhes, exclusão, câmera/cancelamento/galeria, suporte, favorito/recusa, cadastro de unidade e debounce.

## 9. Checklist final

A checklist integral acima foi atualizada item por item. Responsividade, acessibilidade e regressão manual permanecem desmarcadas porque falta inspeção real no navegador, apesar da implementação e das verificações automatizadas terem passado.

## 10. Pendências e operação

1. Validação visual/manual em desktop, tablet e mobile: o conector informa apps=[] e browsers=[]; o browser in-app não está disponível e a integração nativa não conecta ao pipe. Foi solicitada disponibilização de navegador. Faltam revisar layout/overflow, teclado/foco, modais, câmera real, calendários/carrosséis, unidades e percorrer fluxos reais. Vite está disponível em http://127.0.0.1:3000. Não foram inventadas capturas nem declarado PASS visual.
2. Infraestrutura de produção: manter process_notifications a cada minuto, como já exigido para notificações. A integração e o comando de expiração estão testados sem tela aberta; não houve acesso ao scheduler de produção para verificar sua ativação. Nenhuma credencial de produção foi pedida ou exposta.

Não há feature substituída por mock, placeholder ou TODO. As três pendências da checklist são de validação manual externa. A implementação não é declarada integralmente concluída enquanto essa verificação estiver faltando.

