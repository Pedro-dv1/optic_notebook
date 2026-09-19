# OpticNoteBook — revisão de segurança

Data: 18/09/2026

Escopo: Django/DRF, React/Vite, autenticação, autorização multi-tenant, agendamentos públicos e autenticados, uploads, configuração de produção e dependências diretas.

## Resumo executivo

Não foi encontrado SQL manual, `RawSQL`, `.raw()`, `dangerouslySetInnerHTML`, `csrf_exempt`, CORS global ou segredo real versionado. Os viewsets administrativos derivam a empresa do usuário autenticado, e os agendamentos do cliente são filtrados pelo próprio usuário. Os serializers usam listas explícitas de campos e não aceitam tenant, papel ou status do cliente como fonte de autorização.

Uma dependência vulnerável foi corrigida. Também foram endurecidos os limites de entrada, upload, cookies e consultas públicas. A validação completa da suíte Django permanece condicionada à permissão `CREATEDB` do papel PostgreSQL de teste.

## Achados corrigidos

### CRÍTICO

- Nenhum achado crítico confirmado no código revisado.

### ALTO

- **Pillow 11.3.0 com vulnerabilidades conhecidas em uma fronteira de upload.** Risco: processamento de imagens especialmente construídas poderia atingir falhas publicadas para a versão. Local: `backend/requirements.txt`. Correção: atualização controlada para Pillow 12.3.0, compatível com Python 3.12, seguida de `pip-audit`, que passou sem vulnerabilidades conhecidas.

### MÉDIO

- **Dimensões de imagem sem teto próprio da aplicação.** Risco: uma imagem compactada pequena poderia consumir memória/CPU desproporcional ao ser decodificada. Local: `backend/platform_core/validators.py`. Correção: limite de 2 MB mantido e teto adicional de 4096 × 4096 e 16 milhões de pixels, com validação real pelo Pillow.
- **UUID público de filtro de profissional sem validação explícita.** Risco: entradas malformadas podiam alcançar a conversão do ORM e gerar erro interno/ruído operacional. Local: `backend/professionals/views.py`. Correção: query serializer com `UUIDField`, retornando 400 seguro.
- **Pillow antigo em uma fronteira de upload.** Além da atualização da dependência, os testes de upload foram ampliados para dimensões excessivas.

### BAIXO

- **Pesquisas administrativas sem limite uniforme.** Risco: strings muito grandes aumentavam custo de consulta e log. Locais: `backend/bookings/views.py` e `backend/companies/views.py`. Correção: limite de 150 caracteres com 400 previsível.
- **Opções de sessão implícitas.** Risco: futuras mudanças de defaults poderiam enfraquecer cookies de sessão. Local: `backend/config/settings.py`. Correção: `HttpOnly`, `SameSite=Lax`, duração e COOP explicitados; cookies `Secure`, HSTS e HTTPS permanecem obrigatórios em produção.
- **N+1 na foto do cliente em listas de agendamento da empresa.** Risco primário de disponibilidade/performance. Local: `backend/bookings/views.py`. Correção: `select_related("customer")`.

### INFORMATIVO

- `bandit` encontrou dois B310 em chamadas `urlopen` para endpoints HTTPS constantes do Resend e Cloudflare. Não há URL controlada pelo usuário; são falsos positivos revisados. Os sete B105 restantes são textos em português contendo a palavra “senha/token”, não credenciais hardcoded.
- O scan de segredos encontrou apenas nomes de variáveis e valores fictícios em `.env.example`; `.env` está ignorado.
- Tokens de acesso permanecem apenas em memória; refresh fica em cookie HttpOnly com rotação e blacklist. O único `localStorage` é um identificador anônimo de métrica, sem credencial.
- React escapa nomes, observações e mensagens por padrão; não existe renderização HTML arbitrária.
- Os testes existentes e ampliados cobrem IDOR entre empresas para serviços, profissionais, escalas e agendamentos, além de isolamento entre clientes e mass assignment.

## Riscos residuais

### MÉDIO

- **Rate limiting geral usa o cache padrão do Django/DRF.** Em uma implantação com múltiplos processos ou réplicas, os buckets públicos e globais precisam de cache compartilhado (Redis/Memcached) e limite complementar no proxy/CDN. Os fluxos de OTP já usam buckets PostgreSQL por usuário e IP. Esta mudança depende da infraestrutura de produção e não foi simulada com um cache local que daria falsa segurança.
- **CSP depende da hospedagem do frontend.** O repositório não contém a configuração do servidor/CDN que entrega o build Vite. `frontend/README.md` documenta as origens mínimas para API, IBGE, Turnstile e VLibras. A política deve ser aplicada como header e validada no domínio real antes da produção.

### BAIXO

- O campo global legado `CompanyBookingSettings.slot_interval` foi preservado para compatibilidade/migração, mas não é exposto nem usado. Pode ser removido em uma futura janela de migração depois de confirmar que nenhuma integração externa antiga o consome.

## Verificações executadas

- `npm audit --json`: 0 vulnerabilidades em 299 dependências.
- `pip-audit --local`: 0 vulnerabilidades conhecidas após Pillow 12.3.0.
- `bandit`: 0 alto; 2 médios revisados como URLs HTTPS constantes; 7 baixos falsos positivos de texto.
- Busca estática: nenhum SQL manual, HTML perigoso, `csrf_exempt`, CORS irrestrito ou segredo versionado encontrado.
- `manage.py check`: sem problemas.
- `manage.py check --deploy` com configuração de produção simulada: sem problemas.
- `manage.py check --deploy` com `.env` de desenvolvimento: cinco avisos esperados (`DEBUG`/HTTPS/HSTS/cookies Secure), que são ativados ou exigidos pelo ramo de produção.
