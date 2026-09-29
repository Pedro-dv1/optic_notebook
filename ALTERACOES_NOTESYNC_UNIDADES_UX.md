# Alterações do NoteSync: unidades e experiência do cliente

Pacote implementado sobre a estrutura existente: Django/DRF, React/TypeScript, estilos compartilhados, react-icons/lu, favoritos, unidades e calendário já presentes. Nenhuma dependência nova. Alterações anteriores do workspace foram preservadas. Nenhum commit ou push.

## Unidades, models e APIs

- Reutilizados `Service.units`, `Professional.units`, `WorkSchedule.unit` e `Appointment.unit`. Não foi criado outro catálogo ou relacionamento equivalente.
- Recursos sem unidades deixam de ser globais. Com uma única unidade ativa, novos cadastros podem assumir essa unidade; com várias, a API exige escolha explícita. Criar uma filial não copia recursos. Vínculos múltiplos existentes ou escolhidos explicitamente permanecem compatíveis.
- Os serializers validam tenant, unidades e compatibilidade entre serviço e profissional. Recursos de unidades distintas não aparecem no catálogo selecionado e não podem ser usados em disponibilidade ou agendamento daquela unidade. IDs de outro tenant são rejeitados no servidor.
- Nomes iguais podem existir em unidades diferentes. A duplicidade na mesma unidade é validada durante as transações que já bloqueiam a empresa.
- Endpoints administrativos de serviços, profissionais, jornadas e agendamentos aceitam `?unit=`. Endpoints públicos e profissionais aplicam o mesmo escopo aos catálogos. Agendamento público, manual e disponibilidade validam o conjunto empresa/unidade/serviço/profissional.
- Agendamentos futuros impedem remover vínculos de catálogo utilizados. Jornadas impedem desvincular o profissional da unidade. Histórico e vínculos impedem exclusão física de unidades.
- A busca combina serviço, cidade e estado na mesma unidade ativa, evitando resultados obtidos pela mistura de filiais.

## Migrations

1. `backend/services/migrations/0005_remove_service_unique_service_name_per_company.py`: vincula serviços legados sem unidade à principal e às unidades comprovadas por agendamentos ou profissionais vinculados; preserva associações explícitas e remove unicidade de nome por empresa.
2. `backend/professionals/migrations/0006_remove_professional_unique_professional_name_per_company.py`: remove unicidade de nome por empresa para permitir cadastros independentes em unidades diferentes.

Antes de executar a aplicação atualizada, aplicar `python manage.py migrate`. O banco local foi inspecionado somente por leitura: uma empresa, dois serviços sem unidade e nenhum profissional sem unidade. Não foram aplicadas migrations nem alterados esses dados locais. A suíte usa PostgreSQL isolado, sem mudar `.env`. Se for necessário reverter as constraints após criar nomes repetidos em filiais diferentes, resolver previamente as duplicatas por empresa; o backfill não apaga vínculos na reversão.

## Cliente, procura e favoritos

- Header do cliente conserva Meus agendamentos e conta, removendo Como funciona apenas da navegação autenticada.
- Agenda e Calendário são modos da mesma página, usando o calendário existente. O seletor único fica à direita de Agendar horário, tem estado ativo azul, transição e `aria-pressed`.
- Favoritos fica nas configurações da conta, com listagem e remoção pelos endpoints existentes. Favoritar estabelecimentos continua disponível nos cards.
- `public/companies/` reconhece autenticação e aceita `ordering=recommended|name|-name`. Recomendados é o padrão: um `Exists` dos favoritos do próprio cliente ordena os favoritos antes dos demais resultados e antes da paginação. Os outros resultados continuam disponíveis. Sem favoritos ou sem login, a ordenação normal por nome é mantida; A-Z e Z-A explícitos continuam disponíveis nos filtros.
- Coração e ajuda usam ícones existentes, próximos ao nome da empresa, fundo transparente e alvo interativo de 44 px. Favorito ativo usa azul. O tooltip escuro possui seta, posicionamento limitado à viewport, texto rolável quando necessário e abertura por hover, foco e toque; fecha por Escape ou interação externa.
- A barra de procura tem pesquisa seguida imediatamente por Filtros com `LuSlidersHorizontal`. O botão A-Z foi removido da barra; ordenação e demais filtros permanecem no painel.

## Responsividade e acessibilidade

Revisão de código dos layouts públicos, cliente, empresa, profissionais, administração, plataforma, configurações, formulários e componentes compartilhados. Corrigidos mínimos de largura de flex/grid, quebra de textos, grids progressivos, reorganização de headers e ações, largura de campos e status longos. Tabelas responsivas passam a apresentar linhas com rótulos em larguras menores; tabelas extensas mantêm rolagem local apropriada no container. Foram removidas regras gerais que ocultavam overflow horizontal do layout. Sidebar e modais reutilizam a estrutura adaptativa existente; favoritos no modal usam um breakpoint compatível com o espaço disponível. Calendário mantém a apresentação existente de contagens no celular e prévias em telas maiores, com status que pode quebrar linha.

Botões de ícone possuem nomes acessíveis, controles usam foco visível compartilhado e o tooltip não depende exclusivamente de hover. A preferência por movimento reduzido continua respeitada.

Não foi possível validar visualmente em navegador real: a automação e o lançamento do navegador foram bloqueados pelas permissões do ambiente. A revisão estrutural e os testes DOM não substituem a conferência final em dispositivos/viewports reais.

## Arquivos deste pacote

Os caminhos abaixo identificam somente alterações feitas neste pacote, sem atribuir a ele outros arquivos já modificados no workspace.

| Arquivo | Alteração |
| --- | --- |
| `backend/README.md` | Contratos de unidades, recomendações e instruções de migration. |
| `backend/bookings/operations.py` | Validação central de catálogo e disponibilidade por unidade/tenant. |
| `backend/bookings/views.py` | Filtro administrativo e serviços do profissional por unidade. |
| `backend/companies/serializers.py` | Validação compartilhada de vínculos e ordenação recomendada. |
| `backend/companies/views.py` | Busca por unidade, prioridade por favoritos e proteção da exclusão de unidades. |
| `backend/professionals/models.py` | Defaults somente com uma unidade e nomes independentes. |
| `backend/professionals/serializers.py` | Compatibilidade de vínculos e serviços públicos por unidade. |
| `backend/professionals/views.py` | Catálogo público e filtros administrativos por unidade. |
| `backend/services/models.py` | Remove conceito de serviço global e unicidade por empresa. |
| `backend/services/serializers.py` | Vínculos explícitos e proteção de agendamentos futuros. |
| `backend/services/views.py` | Catálogos públicos e administrativos com escopo de unidade. |
| `backend/services/migrations/0005_remove_service_unique_service_name_per_company.py` | Migração dos vínculos legados e constraint de serviço. |
| `backend/professionals/migrations/0006_remove_professional_unique_professional_name_per_company.py` | Constraint de profissional. |
| `backend/platform_core/tests/test_notesync_package.py` | Ajusta cenário existente para associação explícita. |
| `backend/platform_core/tests/test_unit_catalog.py` | Testa isolamento, APIs, agendamento, migração e recomendações. |
| `frontend/src/components/CompanyObservationPopover.tsx` | Tooltip escuro acessível e posicionado na viewport. |
| `frontend/src/components/CityAutocomplete.tsx` | Estado usa o campo de seleção compartilhado, preservando validação e autocomplete. |
| `frontend/src/components/CustomerCalendar.tsx` | Semanas completas, dia atual em Brasília, dias vizinhos utilizáveis e setas discretas. |
| `frontend/src/components/CustomerFavorites.tsx` | Grid adequado ao modal de configurações. |
| `frontend/src/components/FavoriteButton.tsx` | Ícone discreto e atualização das recomendações após mudança. |
| `frontend/src/components/PublicLayout.tsx` | Header autenticado e reorganização em telas menores. |
| `frontend/src/components/StatusBadge.tsx` | Texto longo pode quebrar sem exceder o container. |
| `frontend/src/components/UnitFields.tsx` | Seleção explícita e controlada de unidades do catálogo. |
| `frontend/src/components/ui.tsx` | Seletores padronizados com ícone existente, foco e suporte nativo a teclado/touch. |
| `frontend/src/components/account/AccountMenu.tsx` | Seção Favoritos dentro das configurações. |
| `frontend/src/components/account/SettingsDialog.tsx` | Entrada para gestão de favoritos. |
| `frontend/src/pages/CustomerAccountPage.tsx` | Segmented control Agenda/Calendário e ações responsivas. |
| `frontend/src/pages/CustomerHubPage.tsx` | Procura, filtros, ordenação, recomendações e ícones junto ao nome. |
| `frontend/src/pages/ProfessionalPage.tsx` | Cadastro manual consulta serviços da unidade e reinicia seleção. |
| `frontend/src/pages/PublicBookingPage.tsx` | Controles junto ao nome e ajuste do layout público. |
| `frontend/src/pages/admin/AdminPages.tsx` | Catálogos/filtros por unidade e ajustes responsivos de páginas administrativas. |
| `frontend/src/pages/admin/AdminExtraPages.tsx` | Headers, ações, rankings e grids responsivos. |
| `frontend/src/pages/admin/AdminManualBooking.tsx` | Catálogo solicitado por unidade e limpeza das seleções ao trocar. |
| `frontend/src/styles/index.css` | Regras estruturais responsivas, tabelas, ícones, seletor e tooltip. |
| `frontend/src/test/app-flows.test.tsx` | Adapta expectativas de filtros, status e consultas existentes. |
| `frontend/src/test/unit-catalog-ux.test.tsx` | Testa seletor, favoritos nas configurações, filtros, unidade manual e tooltip. |
| `ALTERACOES_NOTESYNC_UNIDADES_UX.md` | Relatório deste pacote. |

## Validação

- Backend: `python manage.py test --keepdb --noinput` — 149 testes aprovados na execução completa.
- Backend após o último ajuste dos cenários: `python manage.py test platform_core.tests.test_unit_catalog --keepdb --noinput` — os 9 testes focados aprovados, incluindo localização combinada na mesma unidade e migração de serviços vinculados a profissionais sem histórico.
- `python manage.py check` — sem problemas.
- `python manage.py makemigrations --check --dry-run` — nenhuma migration pendente de criação.
- Frontend: `npm.cmd test -- --reporter=dot` — 80 testes aprovados em 9 arquivos.
- `npm.cmd run typecheck`, `npm.cmd run lint` e `npm.cmd run build` — aprovados.
- Falhas encontradas durante a implementação foram corrigidas; o aviso esperado do teste de Web Push sem VAPID não representa falha da suíte.
- Conferência do diff para erros de whitespace e caracteres inválidos; sem commit ou push.

O servidor de desenvolvimento e o PostgreSQL temporário foram encerrados. A política automática do ambiente rejeitou a exclusão recursiva das pastas `.tmp-notesync-before`, `.tmp-notesync-browser` e `.tmp-notesync-pg`; elas permanecem no workspace como arquivos auxiliares de validação, fora da implementação.

## Refinamento dos controles do cliente

- `CustomerAccountPage.tsx` e `index.css`: o fundo azul de Agenda/Calendário desliza entre as opções via `transform`, respeitando movimento reduzido. Agendar horário e Ver detalhes recebem estilo local mais fino e arredondado, inclusive no mobile; extensões transparentes preservam alvos de toque de 44 px sem aumentar a altura visual.
- `CustomerHubPage.tsx` e `index.css`: o link do estabelecimento cobre a superfície completa do card, mantendo os controles de favorito e observações acima dele e independentes da navegação. O foco por teclado destaca todo o card.
- `index.css`: removido o fundo de hover/focus dos ícones de favorito e ajuda, preservando mudança de cor e foco visível.
- `unit-catalog-ux.test.tsx`: cenário adicional verifica que favorito e observações funcionam sem navegar, e que o link do card abre o estabelecimento.

## Calendário, seletores e layout mobile

- `CustomerCalendar.tsx`: semanas completas com datas adjacentes; destaque azul e `aria-current="date"` para hoje pelo horário de Brasília. Cálculo civil das células em UTC evita deslocamento de datas por fuso do navegador. Clicar em um dia vizinho troca o mês e consulta os eventos daquele dia. A consulta mensal continua limitada ao próprio mês, respeitando o contrato de até 31 dias.
- `PublicLayout.tsx`: menu compacto à esquerda do botão da conta. Removido o `z-index` do conteúdo principal que confinava o modal à mesma camada do footer; o modal existente passa a ficar acima do footer e do header ao selecionar um dia, inclusive com a página rolada até o fim.
- `ui.tsx`, `CityAutocomplete.tsx`, `AdminPages.tsx` e `index.css`: todos os selects passam pelo componente existente, com borda, raio, foco e seta `LuChevronDown` coerentes com o sistema. Seleção nativa foi mantida para teclado e mobile, preservando validação, valores e formulários.
- `index.css`: corrigida a precedência do estilo local de Ver detalhes e retirada a regra touch que aumentava a altura visual dos controles do cliente. Setas do calendário mantêm somente o ícone, sem borda ou fundo de hover.
- `unit-catalog-ux.test.tsx`: regressões para ordem do menu compacto, estado do seletor, semanas preenchidas, hoje em Brasília, fevereiro bissexto, passagem de dezembro para janeiro, consulta diária e foco/fechamento do modal.

Validação final desta revisão: 84 testes de frontend aprovados em 9 arquivos, TypeScript, lint, build de produção e conferência de whitespace aprovados. Nenhuma alteração adicional de backend ou migration. A limitação de conferência visual em navegador real indicada acima permanece.
