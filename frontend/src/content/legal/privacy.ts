import type { LegalDocument } from './types'

// Política de Privacidade do OpticNoteBook

export const privacyDocument: LegalDocument = {
  kind: 'privacy',

  title: 'Política de Privacidade',

  introduction: [
    'Esta Política de Privacidade explica como o OpticNoteBook, plataforma de agendamentos multiempresa desenvolvida sob a marca OpticACS, coleta, utiliza, armazena, compartilha e protege dados pessoais relacionados ao uso de seus sites, páginas públicas, contas, painéis administrativos e demais funcionalidades da plataforma.',
    'O OpticNoteBook tem como objetivo conectar clientes a empresas e profissionais, permitindo a consulta de empresas, serviços, profissionais e horários disponíveis, bem como a realização, o gerenciamento, o cancelamento e o reagendamento de agendamentos.',
    'Esta Política aplica-se aos visitantes da plataforma, clientes com ou sem conta, responsáveis legais, empreendedores, administradores de empresas, profissionais cadastrados, representantes das empresas e demais pessoas naturais cujos dados sejam tratados por meio do OpticNoteBook.',
    'O tratamento de dados pessoais é realizado em conformidade com a legislação brasileira aplicável, especialmente a Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais (LGPD) —, a Lei nº 12.965/2014 — Marco Civil da Internet — e, quando aplicável, as normas destinadas à proteção de crianças e adolescentes.',
  ],

  sections: [
    {
      id: 'responsavel-opticnotebook',
      title: '1. Quem é responsável pelo OpticNoteBook',
      paragraphs: [
        'O OpticNoteBook é operado pelo responsável legal pela plataforma e pela marca OpticACS.',
        'Responsável legal ou razão social: [PREENCHER].',
        'Nome fantasia: OpticACS / OpticNoteBook.',
        'CPF ou CNPJ: [PREENCHER].',
        'Endereço: [PREENCHER].',
        'E-mail de privacidade: [PREENCHER].',
        'E-mail de suporte: [PREENCHER].',
        'As informações acima deverão permanecer atualizadas e constituirão o principal canal de contato para assuntos relacionados à privacidade e à proteção de dados pessoais.',
      ],
    },

    {
      id: 'papeis-controlador-operador',
      title: '2. Papéis do OpticNoteBook e das empresas',
      paragraphs: [
        'Por funcionar como uma plataforma multiempresa, o papel desempenhado pelo OpticNoteBook pode variar conforme a operação de tratamento de dados realizada.',
        'O OpticNoteBook poderá atuar como controlador quando definir as finalidades e os meios essenciais do tratamento relacionado à própria plataforma.',
        'Isso pode ocorrer, por exemplo, no tratamento necessário para criação e manutenção de uma conta global de cliente, autenticação, recuperação ou alteração de senha, segurança da plataforma, prevenção a fraudes e abusos, administração técnica, atendimento de suporte, gestão das empresas cadastradas, cumprimento de obrigações legais e exercício regular de direitos.',
        'Quando um cliente realiza um agendamento com determinada empresa por meio do OpticNoteBook, essa empresa normalmente atua como controladora dos dados relacionados ao atendimento, pois determina os serviços oferecidos, os profissionais disponíveis, seus horários, suas regras de atendimento e a forma de utilização dos dados necessários à prestação de seus serviços.',
        'Cada empresa cadastrada é responsável por tratar os dados de seus clientes de forma lícita, transparente e compatível com a LGPD e com outras normas aplicáveis à sua atividade.',
        'Nos tratamentos realizados em nome de uma empresa cadastrada, especialmente quanto ao armazenamento, organização e disponibilização dos dados de clientes e agendamentos, o OpticNoteBook poderá atuar como operador, tratando os dados de acordo com as finalidades determinadas pela empresa controladora e dentro dos limites necessários ao fornecimento da plataforma.',
        'Quando uma solicitação relacionada aos dados de determinado agendamento depender de decisão da empresa controladora, o OpticNoteBook poderá encaminhar a solicitação à empresa responsável.',
      ],
    },

    {
      id: 'isolamento-empresas',
      title: '3. Isolamento entre empresas',
      paragraphs: [
        'O OpticNoteBook é uma plataforma multiempresa. Os dados administrativos e operacionais de cada empresa são mantidos de maneira logicamente separada dos dados pertencentes às demais empresas.',
        'Uma empresa não deve possuir acesso aos clientes, agendamentos, agenda, configurações, informações administrativas ou demais dados privados pertencentes a outra empresa cadastrada.',
        'O OpticNoteBook adota controles técnicos e de autorização destinados a preservar essa separação.',
      ],
    },

    {
      id: 'dados-visitantes',
      title: '4. Dados de visitantes',
      paragraphs: [
        'Ao acessar o OpticNoteBook, poderão ser tratados dados técnicos necessários ao funcionamento, segurança e registro de acesso da aplicação.',
        'Esses dados podem incluir endereço IP, data e horário de acesso, informações básicas sobre navegador e dispositivo, páginas acessadas, identificadores técnicos de sessão, eventos de segurança, erros e informações relacionadas à utilização da aplicação.',
        'Esses dados não deverão ser utilizados para identificar desnecessariamente o visitante.',
      ],
    },

    {
      id: 'dados-clientes-conta',
      title: '5. Dados de clientes com conta',
      paragraphs: [
        'Quando o cliente cria uma conta no OpticNoteBook, poderão ser tratados dados como nome, endereço de e-mail, telefone ou WhatsApp, credenciais de autenticação protegidas por mecanismos de segurança, informações relacionadas à verificação da conta, sessões autenticadas, histórico de agendamentos associado à conta e informações necessárias à segurança e recuperação de acesso.',
        'Caso a plataforma futuramente permita foto de perfil ou outra informação adicional, esses dados também poderão ser tratados quando fornecidos pelo usuário.',
        'As senhas não devem ser armazenadas em texto legível, sendo protegidas por mecanismos criptográficos apropriados para armazenamento de credenciais.',
      ],
    },

    {
      id: 'dados-clientes-sem-conta',
      title: '6. Dados de clientes sem conta',
      paragraphs: [
        'Não é obrigatório possuir uma conta global no OpticNoteBook para realizar um agendamento quando essa modalidade estiver disponível.',
        'Nesses casos, poderão ser solicitados apenas os dados necessários para identificar o agendamento e permitir a comunicação com o cliente, como nome, endereço de e-mail, telefone ou WhatsApp e eventual observação fornecida voluntariamente.',
        'A realização de um agendamento sem autenticação não implica a criação automática de uma conta global de cliente no OpticNoteBook.',
      ],
    },

    {
      id: 'dados-agendamentos',
      title: '7. Dados relacionados aos agendamentos',
      paragraphs: [
        'Um agendamento poderá conter informações como empresa escolhida, serviço, procedimento ou item agendável selecionado, profissional escolhido, data, horário, duração, status do agendamento, dados de contato do cliente, observações fornecidas pelo cliente e histórico de ações relacionadas à marcação, confirmação, cancelamento ou reagendamento.',
        'Essas informações poderão ser disponibilizadas à empresa responsável pelo atendimento e aos usuários autorizados por ela conforme necessário para organizar e executar o serviço solicitado.',
      ],
    },

    {
      id: 'dados-empreendedores',
      title: '8. Dados de empreendedores e administradores',
      paragraphs: [
        'Para cadastrar ou administrar uma empresa no OpticNoteBook, poderão ser tratados dados do responsável, como nome, endereço de e-mail, telefone ou WhatsApp, credenciais de autenticação e informações administrativas relacionadas à conta.',
        'Também poderão ser tratados dados referentes ao negócio, incluindo nome empresarial ou nome público, CNPJ quando fornecido, telefone comercial, endereço, segmento ou nicho de atuação, tipo de negócio, identificador público ou slug utilizado na plataforma, logotipo, descrição, serviços, profissionais, horários de funcionamento e demais informações configuradas pelo administrador.',
        'Informações relativas exclusivamente a pessoas jurídicas não são, por si só, dados pessoais. Contudo, serão tratadas como dados pessoais quando permitirem identificar ou estiverem relacionadas a uma pessoa natural identificada ou identificável.',
      ],
    },

    {
      id: 'dados-profissionais',
      title: '9. Dados de profissionais',
      paragraphs: [
        'As empresas podem cadastrar profissionais vinculados aos serviços oferecidos.',
        'Dependendo das informações cadastradas, poderão ser tratados nome do profissional, serviços associados, horários de atendimento, disponibilidade e outras informações necessárias à gestão dos agendamentos.',
        'A empresa responsável pelo cadastro deverá possuir fundamento jurídico adequado para realizar esse tratamento e será responsável pela exatidão e legitimidade das informações fornecidas.',
      ],
    },

    {
      id: 'autenticacao-seguranca',
      title: '10. Dados de autenticação e segurança',
      paragraphs: [
        'O OpticNoteBook poderá tratar registros relacionados a tentativas de autenticação, criação e alteração de senha, códigos temporários de confirmação ou recuperação, data e horário das operações, endereço IP, sessões, bloqueios, limitações de requisição e outros eventos necessários à prevenção de fraude, abuso e acesso não autorizado.',
        'Códigos temporários e outras informações de autenticação terão utilização limitada à finalidade para a qual foram criados e deverão possuir proteção compatível com sua natureza.',
      ],
    },

    {
      id: 'dados-sensiveis',
      title: '11. Dados pessoais sensíveis',
      paragraphs: [
        'Algumas empresas cadastradas no OpticNoteBook podem atuar em setores como saúde, bem-estar ou outros segmentos nos quais determinadas informações podem ser consideradas dados pessoais sensíveis nos termos da LGPD.',
        'Dependendo do contexto, o próprio nome de um serviço, exame, procedimento ou atendimento escolhido poderá revelar informações sensíveis sobre uma pessoa.',
        'Além disso, campos de observações relacionados ao agendamento poderão eventualmente conter informações sobre saúde ou outras categorias de dados pessoais sensíveis.',
        'Os usuários devem evitar inserir informações sensíveis que não sejam estritamente necessárias para a realização do agendamento ou atendimento.',
        'Quando determinada empresa estabelecer a necessidade de tratamento de dados pessoais sensíveis, será responsável por verificar a existência de hipótese legal adequada e cumprir as obrigações adicionais previstas na legislação.',
        'Quando atuar como operador, o OpticNoteBook tratará esses dados dentro das instruções e finalidades determinadas pela empresa controladora e dos limites necessários à prestação do serviço.',
        'Dados pessoais sensíveis provenientes de agendamentos não serão utilizados pelo OpticNoteBook para criação de perfis publicitários ou comercialização de informações pessoais.',
      ],
    },

    {
      id: 'dados-nao-solicitados',
      title: '12. Dados que não solicitamos',
      paragraphs: [
        'O OpticNoteBook não possui, atualmente, sistema próprio de pagamentos online e não necessita que clientes forneçam números completos de cartão de crédito, códigos de segurança de cartão ou senhas bancárias para realizar um agendamento.',
        'Essas informações não devem ser inseridas em campos de observação ou outros campos livres da plataforma.',
        'Os usuários também devem evitar fornecer documentos, informações médicas detalhadas, dados financeiros, senhas ou outros dados excessivos quando essas informações não forem necessárias à finalidade do serviço.',
      ],
    },

    {
      id: 'obtencao-dados',
      title: '13. Como os dados são obtidos',
      paragraphs: [
        'Os dados podem ser fornecidos diretamente pelo titular durante a criação de uma conta, preenchimento de cadastro, realização de agendamento, atualização de perfil, contato com suporte ou utilização de outras funcionalidades da plataforma.',
        'Os dados também podem ser fornecidos por uma empresa cadastrada quando ela registra um cliente, profissional ou agendamento em seu painel administrativo.',
        'Determinados dados técnicos são gerados automaticamente durante a utilização da plataforma, como registros de acesso, informações de sessão, endereço IP e eventos relacionados à segurança.',
        'Caso uma pessoa forneça dados pessoais de terceiros, ela deverá possuir autorização, fundamento jurídico ou outra legitimidade adequada para realizar esse fornecimento.',
      ],
    },

    {
      id: 'finalidades-tratamento',
      title: '14. Finalidades do tratamento dos dados',
      paragraphs: [
        'Os dados pessoais poderão ser tratados para disponibilizar e operar o OpticNoteBook; permitir a criação e administração de contas; autenticar usuários; permitir a busca de empresas; apresentar serviços, profissionais, datas e horários disponíveis; criar e administrar agendamentos; permitir cancelamentos e reagendamentos; disponibilizar históricos; permitir que empresas gerenciem seus clientes e agendas; realizar comunicações relacionadas ao funcionamento da conta ou do serviço; verificar endereços de e-mail; recuperar ou alterar senhas; fornecer suporte; prevenir fraudes, ataques, spam, abuso e acessos indevidos; solucionar falhas técnicas; manter registros necessários à segurança e auditoria; cumprir obrigações legais ou regulatórias; responder a autoridades competentes; proteger direitos do OpticNoteBook, dos usuários ou de terceiros; e exercer direitos em processos administrativos, judiciais ou arbitrais.',
        'O OpticNoteBook não comercializa listas de contatos contendo dados pessoais de seus usuários.',
        'O OpticNoteBook também não utiliza dados de agendamentos para criar perfis comerciais destinados à venda a terceiros.',
      ],
    },

    {
      id: 'bases-legais',
      title: '15. Bases legais utilizadas',
      paragraphs: [
        'O tratamento de dados pessoais não depende necessariamente de consentimento em todas as situações.',
        'Conforme a finalidade específica, o OpticNoteBook ou a empresa controladora poderá tratar dados pessoais com fundamento em uma ou mais hipóteses previstas na LGPD.',
        'Essas hipóteses podem incluir execução de contrato ou de procedimentos preliminares relacionados a contrato; cumprimento de obrigação legal ou regulatória; exercício regular de direitos; legítimo interesse, quando legalmente permitido e observados os direitos e expectativas do titular; prevenção à fraude e segurança em processos de identificação e autenticação; proteção da vida ou da integridade física; tutela da saúde nos casos autorizados pela legislação; ou consentimento, quando essa for a base adequada.',
        'Quando o tratamento estiver baseado em consentimento, ele deverá estar relacionado a uma finalidade determinada e poderá ser revogado nos termos da legislação, sem prejudicar os tratamentos realizados de maneira válida anteriormente.',
        'Dados pessoais sensíveis não serão tratados com base genérica em legítimo interesse, devendo ser observadas as hipóteses específicas previstas na legislação.',
      ],
    },

    {
      id: 'conta-global',
      title: '16. Conta global do cliente e empresas escolhidas',
      paragraphs: [
        'Uma conta de cliente no OpticNoteBook poderá ser utilizada para acessar diferentes empresas disponíveis na plataforma.',
        'A existência de uma conta global não significa que todas as empresas cadastradas possuam acesso aos dados ou ao histórico completo do cliente.',
        'Quando o cliente realiza um agendamento, os dados necessários àquele atendimento poderão ser disponibilizados para a empresa escolhida e para os usuários autorizados por ela.',
        'O acesso de cada empresa deverá permanecer limitado aos dados relacionados à sua própria operação e aos respectivos atendimentos.',
      ],
    },

    {
      id: 'compartilhamento-dados',
      title: '17. Compartilhamento de dados pessoais',
      paragraphs: [
        'O OpticNoteBook poderá compartilhar ou permitir o acesso a dados pessoais somente quando isso for necessário para as finalidades descritas nesta Política ou permitido pela legislação.',
        'Dados relacionados a um agendamento poderão ser disponibilizados à empresa com a qual o cliente decidiu agendar e aos profissionais ou usuários autorizados daquela empresa, de acordo com as necessidades operacionais do atendimento.',
        'Também poderão existir prestadores de serviços tecnológicos responsáveis por hospedagem, banco de dados, armazenamento, envio de e-mails, infraestrutura, mecanismos de proteção contra abusos, segurança, monitoramento técnico, backup ou outros serviços indispensáveis à operação da plataforma.',
        'Esses fornecedores deverão receber somente os dados necessários para executar suas respectivas funções, observadas as exigências legais e contratuais aplicáveis.',
        'Dados poderão ser fornecidos a autoridades públicas quando houver obrigação legal ou regulatória, ordem judicial ou requisição válida emitida por autoridade competente.',
        'O compartilhamento também poderá ocorrer quando necessário para exercer ou defender direitos em processos judiciais, administrativos ou arbitrais ou para investigar atividades potencialmente fraudulentas ou ilícitas.',
        'Em caso de reorganização societária, aquisição, incorporação, fusão ou transferência legítima de ativos relacionados ao OpticNoteBook, dados pessoais poderão integrar a operação, observada a legislação aplicável e preservados os direitos dos titulares.',
        'O OpticNoteBook não vende bancos de dados ou listas contendo dados pessoais de usuários.',
      ],
    },

    {
      id: 'prestadores-servicos',
      title: '18. Prestadores de serviços',
      paragraphs: [
        'O funcionamento do OpticNoteBook poderá depender de empresas especializadas em infraestrutura tecnológica.',
        'Entre as categorias de fornecedores que podem participar do tratamento estão serviços de hospedagem, infraestrutura em nuvem, banco de dados, armazenamento de arquivos, envio de e-mails transacionais, segurança, prevenção contra abuso, registro de erros, monitoramento e outros serviços técnicos necessários à disponibilidade da plataforma.',
        'O serviço de envio de e-mails da plataforma poderá utilizar a infraestrutura da Resend enquanto esse for o provedor configurado no ambiente de produção.',
        'Os demais fornecedores efetivamente utilizados em produção deverão ser avaliados pelo responsável pelo OpticNoteBook e, quando aplicável, submetidos a obrigações de confidencialidade, segurança e proteção de dados.',
      ],
    },

    {
      id: 'transferencia-internacional',
      title: '19. Transferência internacional de dados',
      paragraphs: [
        'Alguns prestadores tecnológicos utilizados pelo OpticNoteBook poderão manter servidores, equipes ou infraestrutura fora do Brasil.',
        'Nessas situações, dados pessoais poderão estar sujeitos a transferência internacional ou a tratamento realizado em outros países.',
        'Quando caracterizada transferência internacional de dados pessoais nos termos da LGPD, serão observadas as hipóteses, requisitos e salvaguardas previstos na legislação e na regulamentação da Autoridade Nacional de Proteção de Dados.',
        'Isso poderá incluir, quando aplicável, decisões de adequação, cláusulas-padrão contratuais, cláusulas específicas aprovadas ou outros mecanismos legalmente permitidos.',
        'A utilização de prestadores estrangeiros não elimina os direitos assegurados ao titular pela legislação brasileira aplicável.',
      ],
    },

    {
      id: 'cookies',
      title: '20. Cookies e tecnologias semelhantes',
      paragraphs: [
        'O OpticNoteBook poderá utilizar cookies ou tecnologias equivalentes estritamente necessárias ao funcionamento da plataforma, especialmente para manter sessões autenticadas, preservar a segurança, prevenir ataques, proteger formulários e manter funcionalidades essenciais.',
        'Cookies estritamente necessários poderão ser utilizados independentemente de consentimento específico quando indispensáveis à prestação do serviço solicitado ou à segurança da aplicação, observada a legislação aplicável.',
        'Caso futuramente sejam introduzidos cookies de publicidade, rastreamento comportamental, análise não essencial ou tecnologias semelhantes, sua utilização deverá ser previamente avaliada e, quando exigido, submetida a mecanismo adequado de escolha ou consentimento.',
        'Esta Política deverá ser atualizada antes da utilização de novas tecnologias que alterem materialmente as finalidades ou formas de tratamento aqui descritas.',
      ],
    },

    {
      id: 'comunicacoes-email',
      title: '21. Comunicações por e-mail',
      paragraphs: [
        'O OpticNoteBook poderá enviar mensagens necessárias à prestação do serviço, incluindo confirmação ou verificação de conta, códigos de segurança, recuperação ou alteração de senha, alertas importantes relacionados à conta ou segurança e comunicações administrativas indispensáveis.',
        'Essas comunicações são consideradas relacionadas à operação da plataforma e não constituem necessariamente mensagens de marketing.',
        'Caso o OpticNoteBook futuramente envie comunicações promocionais que dependam de consentimento ou de outro fundamento jurídico específico, serão observadas as regras aplicáveis e disponibilizados mecanismos adequados de oposição ou cancelamento.',
      ],
    },

    {
      id: 'retencao-dados',
      title: '22. Armazenamento e período de retenção',
      paragraphs: [
        'Os dados pessoais serão mantidos apenas pelo período necessário para cumprir as finalidades para as quais foram tratados, respeitando obrigações legais, regulatórias, contratuais e necessidades legítimas de exercício de direitos.',
        'Dados associados a uma conta poderão ser mantidos enquanto ela permanecer ativa e, após seu encerramento, somente durante os períodos necessários para cumprimento de obrigações legais, prevenção contra fraudes, segurança, resolução de disputas ou exercício regular de direitos.',
        'Dados relacionados a agendamentos poderão permanecer armazenados de acordo com as necessidades da empresa controladora, a natureza do serviço prestado e os prazos legais aplicáveis.',
        'A exclusão de uma conta do cliente não significa necessariamente a eliminação automática de todos os registros de agendamentos mantidos pelas empresas com as quais ele realizou atendimentos, pois cada empresa controladora poderá possuir obrigação ou fundamento jurídico próprio para conservar determinadas informações.',
        'Registros de acesso à aplicação poderão ser mantidos durante o período exigido pela legislação brasileira quando a obrigação prevista no Marco Civil da Internet for aplicável.',
        'Ordens judiciais, determinações de autoridades competentes ou outras obrigações legais poderão exigir a preservação de determinadas informações por prazo superior.',
        'Quando os dados deixarem de ser necessários e não houver fundamento jurídico para sua conservação, eles serão eliminados, anonimizados ou submetidos a outra forma de tratamento legalmente admitida.',
        'Cópias de segurança poderão manter dados por período técnico adicional limitado, permanecendo submetidas a controles de acesso e aos ciclos de substituição e eliminação aplicáveis à infraestrutura utilizada.',
      ],
    },

    {
      id: 'seguranca-informacao',
      title: '23. Segurança da informação',
      paragraphs: [
        'O OpticNoteBook adota medidas técnicas e administrativas destinadas a proteger dados pessoais contra acessos não autorizados e situações acidentais ou ilícitas de destruição, perda, alteração, divulgação ou tratamento inadequado.',
        'De acordo com a funcionalidade e o ambiente tecnológico utilizado, essas medidas poderão incluir controles de autenticação e autorização, proteção de credenciais, comunicação por HTTPS em produção, cookies de sessão protegidos, mecanismos contra falsificação de requisições, restrições de acesso entre empresas, validações realizadas no servidor, mecanismos contra abuso e excesso de requisições, registros de segurança, isolamento lógico de dados, backups, restrição de acesso administrativo e práticas de desenvolvimento seguro.',
        'O acesso administrativo à plataforma deverá ser limitado a pessoas autorizadas e de acordo com a necessidade de suas funções.',
        'Embora medidas de segurança sejam adotadas, nenhum sistema conectado à internet é capaz de garantir risco absolutamente inexistente.',
        'Por esse motivo, as medidas de segurança poderão ser avaliadas e aprimoradas conforme os riscos identificados, a evolução tecnológica e as características da plataforma.',
      ],
    },

    {
      id: 'incidentes-seguranca',
      title: '24. Incidentes de segurança',
      paragraphs: [
        'Caso seja identificado incidente de segurança envolvendo dados pessoais, o OpticNoteBook adotará medidas razoáveis para investigar, conter e mitigar seus efeitos.',
        'Quando o OpticNoteBook atuar como operador, fornecerá, dentro de suas responsabilidades, informações ao controlador afetado para permitir o cumprimento das obrigações legais aplicáveis.',
        'Quando o OpticNoteBook atuar como controlador e o incidente puder acarretar risco ou dano relevante aos titulares, serão realizadas as comunicações à Autoridade Nacional de Proteção de Dados e aos titulares afetados quando exigidas pela legislação e regulamentação aplicáveis.',
      ],
    },

    {
      id: 'direitos-titulares',
      title: '25. Direitos dos titulares',
      paragraphs: [
        'Nos termos da LGPD, o titular poderá exercer, conforme aplicável a cada situação, direitos relacionados aos seus dados pessoais.',
        'Esses direitos podem incluir confirmação da existência de tratamento; acesso aos dados; correção de informações incompletas, inexatas ou desatualizadas; anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a legislação; portabilidade quando regulamentada e aplicável; eliminação de dados tratados com consentimento nas hipóteses previstas em lei; informação sobre entidades com as quais ocorreu uso compartilhado; informação sobre as consequências da negativa de consentimento; revogação do consentimento; oposição a tratamentos realizados em desconformidade com a legislação; e revisão de decisões tomadas unicamente com base em tratamento automatizado quando aplicável.',
        'O exercício de determinados direitos poderá depender da verificação da identidade do solicitante, como medida destinada a impedir que terceiros obtenham ou modifiquem indevidamente seus dados.',
        'Uma solicitação poderá não resultar na eliminação imediata de determinados dados quando sua conservação for necessária ou permitida por obrigação legal ou regulatória, exercício regular de direitos ou outra hipótese admitida pela legislação.',
      ],
    },

    {
      id: 'exercicio-direitos',
      title: '26. Como exercer seus direitos',
      paragraphs: [
        'Solicitações relacionadas aos tratamentos realizados diretamente pelo OpticNoteBook poderão ser enviadas para o canal de privacidade informado nesta Política.',
        'E-mail de privacidade: [PREENCHER].',
        'Para proteger o titular, poderão ser solicitadas informações razoavelmente necessárias para confirmar sua identidade antes da realização de determinadas operações.',
        'Quando a solicitação disser respeito aos dados de um agendamento tratado sob controle de uma empresa específica, o OpticNoteBook poderá orientar o titular a entrar em contato diretamente com a empresa ou encaminhar a solicitação ao controlador responsável.',
        'O exercício dos direitos previstos na LGPD será realizado gratuitamente nos termos da legislação aplicável.',
        'O titular também poderá apresentar petição perante a Autoridade Nacional de Proteção de Dados nos casos e procedimentos previstos na legislação.',
      ],
    },

    {
      id: 'exclusao-conta',
      title: '27. Exclusão da conta',
      paragraphs: [
        'Quando disponibilizada pela plataforma, a exclusão de uma conta de cliente encerrará o acesso às funcionalidades vinculadas àquela conta.',
        'A exclusão da conta não implica necessariamente o apagamento imediato de todos os dados existentes em sistemas de backup, registros obrigatórios de segurança ou bases mantidas por empresas com as quais o usuário tenha realizado agendamentos.',
        'Quando houver fundamento jurídico para a manutenção de determinadas informações, elas poderão ser conservadas exclusivamente pelo período necessário à respectiva finalidade.',
        'Caso não exista fundamento jurídico para sua conservação, os dados deverão ser eliminados ou anonimizados conforme os limites técnicos e legais aplicáveis.',
      ],
    },

    {
      id: 'suspensao-empresas',
      title: '28. Cancelamento ou suspensão de empresas',
      paragraphs: [
        'Quando uma empresa for suspensa do OpticNoteBook, seus dados não precisam ser imediatamente eliminados.',
        'A suspensão poderá impedir novos acessos ou operações enquanto determinados dados permanecem armazenados para permitir regularização, eventual reativação da conta, cumprimento de obrigações legais, investigação de irregularidades, segurança ou exercício regular de direitos.',
        'O encerramento definitivo da relação com a empresa ficará submetido às regras de retenção previstas nesta Política, à legislação aplicável e aos instrumentos relacionados à relação entre o OpticNoteBook e a empresa.',
      ],
    },

    {
      id: 'paginas-publicas',
      title: '29. Páginas públicas das empresas',
      paragraphs: [
        'As empresas cadastradas poderão possuir páginas públicas dentro do OpticNoteBook destinadas a apresentar informações sobre seus serviços.',
        'Essas páginas poderão apresentar nome do estabelecimento, logotipo, descrição, endereço comercial, telefone comercial, serviços, profissionais, horários e outras informações escolhidas para divulgação pública.',
        'Os administradores das empresas são responsáveis por não publicar nessas áreas informações pessoais que não devam ser tornadas públicas.',
        'Dados administrativos internos, credenciais, informações privadas de clientes e informações que não sejam necessárias à página pública não deverão ser expostos publicamente.',
      ],
    },

    {
      id: 'criancas-adolescentes',
      title: '30. Crianças e adolescentes',
      paragraphs: [
        'O OpticNoteBook não é desenvolvido especificamente como uma plataforma destinada ao público infantil. Entretanto, determinadas empresas cadastradas poderão oferecer serviços utilizados por crianças e adolescentes.',
        'O tratamento de dados de crianças e adolescentes deverá observar seu melhor interesse, sua proteção integral e a legislação brasileira aplicável.',
        'Quando o atendimento envolver uma criança, o agendamento deverá ser realizado ou autorizado por pai, mãe ou responsável legal quando isso for necessário nos termos da legislação.',
        'O tratamento de dados pessoais de crianças que dependa de consentimento deverá utilizar consentimento específico e destacado fornecido por pelo menos um dos pais ou pelo responsável legal, observadas as exceções previstas na legislação.',
        'Dados de crianças e adolescentes não serão utilizados pelo OpticNoteBook para criação de perfis comportamentais destinados à publicidade direcionada.',
        'Empresas que utilizem o OpticNoteBook para prestar serviços destinados ou provavelmente acessados por crianças ou adolescentes também são responsáveis pelo cumprimento das obrigações especiais aplicáveis às suas atividades.',
        'Quando o OpticNoteBook identificar a necessidade de tratamento direcionado especificamente a esse público, deverão ser adotadas medidas adicionais de privacidade, segurança e proteção adequadas à idade, à finalidade e aos riscos envolvidos.',
      ],
    },

    {
      id: 'campos-livres',
      title: '31. Dados inseridos em campos livres',
      paragraphs: [
        'Algumas funcionalidades podem permitir a inserção de textos livres, como observações relacionadas ao agendamento.',
        'O usuário deverá fornecer somente informações verdadeiras, pertinentes e necessárias à finalidade do campo.',
        'Não deverão ser incluídos dados pessoais excessivos de terceiros, senhas, informações bancárias, números de cartão, documentos desnecessários ou informações sensíveis sem necessidade.',
        'As empresas também deverão orientar seus administradores e profissionais a evitar o registro de informações excessivas ou incompatíveis com a finalidade do atendimento.',
      ],
    },

    {
      id: 'dados-incorretos',
      title: '32. Dados incorretos fornecidos pelo usuário',
      paragraphs: [
        'O usuário é responsável pela exatidão das informações fornecidas diretamente por ele.',
        'Caso sejam identificados dados incorretos ou desatualizados, o titular poderá utilizar as ferramentas disponíveis na plataforma ou solicitar sua correção pelos canais indicados nesta Política.',
      ],
    },

    {
      id: 'servicos-terceiros',
      title: '33. Links e serviços de terceiros',
      paragraphs: [
        'O OpticNoteBook poderá apresentar links ou permitir integrações com serviços externos.',
        'Esta Política não necessariamente rege o tratamento de dados realizado de forma independente por sites, aplicativos ou serviços de terceiros.',
        'Ao acessar serviço externo, o usuário deverá verificar também as respectivas políticas de privacidade e condições aplicáveis.',
      ],
    },

    {
      id: 'novas-funcionalidades',
      title: '34. Alterações futuras na plataforma',
      paragraphs: [
        'Novas funcionalidades poderão resultar em novas operações de tratamento de dados pessoais.',
        'Antes da introdução de funcionalidades que alterem materialmente as informações descritas nesta Política, o OpticNoteBook deverá avaliar seus impactos de privacidade e realizar as atualizações necessárias neste documento e nos mecanismos de informação ou consentimento aplicáveis.',
        'Isso inclui, por exemplo, eventual implementação futura de pagamentos online, integrações de comunicação, novas formas de login, ferramentas analíticas, inteligência artificial, publicidade, novas categorias de dados ou integrações com outros serviços.',
      ],
    },

    {
      id: 'alteracoes-politica',
      title: '35. Alterações desta Política',
      paragraphs: [
        'Esta Política poderá ser atualizada para refletir mudanças na plataforma, na infraestrutura utilizada, nas práticas de tratamento de dados ou na legislação aplicável.',
        'A data da atualização mais recente será informada no início deste documento.',
        'Quando houver alteração relevante que afete substancialmente os direitos ou a forma de tratamento dos dados pessoais, poderão ser utilizados avisos na plataforma, comunicações por e-mail ou outros mecanismos adequados para informar os usuários.',
        'Quando determinada alteração depender de novo consentimento, ele será solicitado antes da realização do tratamento correspondente.',
      ],
    },

    {
      id: 'responsabilidade-empresas',
      title: '36. Responsabilidades das empresas cadastradas',
      paragraphs: [
        'As empresas que utilizam o OpticNoteBook deverão utilizar os dados pessoais acessíveis em seus painéis somente para finalidades legítimas e relacionadas aos serviços prestados.',
        'As empresas são responsáveis por controlar o acesso de seus administradores e demais pessoas autorizadas, preservar a confidencialidade das informações, não utilizar dados para finalidades incompatíveis, respeitar solicitações de titulares quando atuarem como controladoras e observar as normas aplicáveis ao seu setor.',
        'O OpticNoteBook poderá adotar medidas de segurança ou limitar acessos quando identificar indícios de uso indevido, tentativa de acesso não autorizado ou risco à segurança dos dados e da plataforma.',
      ],
    },

    {
      id: 'cooperacao-agentes',
      title: '37. Responsabilidade e cooperação entre os agentes',
      paragraphs: [
        'Quando houver tratamento no qual uma empresa seja controladora e o OpticNoteBook atue como operador, ambas as partes deverão cooperar, dentro de suas respectivas responsabilidades, para a proteção dos titulares e o cumprimento da legislação.',
        'O OpticNoteBook não utilizará sua condição de operador para realizar, por iniciativa própria, tratamentos incompatíveis com as instruções legítimas do controlador ou com as finalidades necessárias à prestação do serviço.',
        'Da mesma forma, uma empresa cadastrada não poderá instruir o OpticNoteBook a realizar tratamento manifestamente ilícito ou incompatível com a legislação brasileira de proteção de dados.',
      ],
    },

    {
      id: 'autoridades-publicas',
      title: '38. Autoridades públicas e obrigações legais',
      paragraphs: [
        'O OpticNoteBook poderá conservar ou disponibilizar determinados dados quando necessário para cumprir obrigação legal ou regulatória, ordem judicial ou requisição válida de autoridade competente.',
        'Solicitações de autoridades serão avaliadas de acordo com sua validade, competência e extensão.',
        'Quando legalmente possível, deverão ser disponibilizados somente os dados necessários ao atendimento da solicitação.',
      ],
    },

    {
      id: 'principios-lgpd',
      title: '39. Princípios de proteção de dados',
      paragraphs: [
        'O tratamento de dados realizado pelo OpticNoteBook busca observar os princípios de finalidade, adequação, necessidade, livre acesso, qualidade dos dados, transparência, segurança, prevenção, não discriminação, responsabilização e prestação de contas previstos na LGPD.',
        'Isso inclui, entre outras medidas, evitar a coleta de informações que não sejam necessárias, informar adequadamente as finalidades do tratamento, restringir o acesso aos dados e adotar medidas proporcionais aos riscos envolvidos.',
      ],
    },

    {
      id: 'encarregado-privacidade',
      title: '40. Encarregado e canal de privacidade',
      paragraphs: [
        'Quando houver encarregado pelo tratamento de dados pessoais formalmente indicado, suas informações serão disponibilizadas nesta seção.',
        'Encarregado: [PREENCHER, SE APLICÁVEL].',
        'Contato do encarregado: [PREENCHER].',
        'Caso o responsável pelo OpticNoteBook esteja legalmente dispensado da indicação formal de encarregado, permanecerá disponível um canal de comunicação destinado ao atendimento dos titulares.',
        'Canal de privacidade: [PREENCHER].',
      ],
    },

    {
      id: 'contato',
      title: '41. Dúvidas e contato',
      paragraphs: [
        'Dúvidas relacionadas a esta Política, solicitações envolvendo dados pessoais ou comunicações relacionadas à privacidade e segurança poderão ser encaminhadas ao OpticNoteBook por meio do canal de privacidade informado abaixo.',
        'OpticNoteBook — Privacidade e Proteção de Dados.',
        'Operado por: Pedro Cauê de Oliveria Carrega .',
        'CPF/CNPJ: 097.514.701-37.',
        'E-mail: optic.acs.service@gmail.com.',
        'Endereço: Av. Brasil, 1190 - Uânia SP.',
        'Para questões relacionadas especificamente ao atendimento ou agendamento realizado com uma empresa cadastrada, o titular também poderá entrar em contato diretamente com a respectiva empresa.',
      ],
    },
  ],
}