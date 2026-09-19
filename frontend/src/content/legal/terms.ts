import type { LegalDocument } from './types'

// Termos de Uso do OpticNoteBook.
// O conteúdo deve permanecer alinhado às funcionalidades
// efetivamente disponibilizadas pela plataforma.

export const termsDocument: LegalDocument = {
  kind: 'terms',

  title: 'Termos de Uso',

  introduction: [
    'Estes Termos de Uso regulam o acesso e a utilização do OpticNoteBook, plataforma digital de agendamentos multiempresa desenvolvida sob a marca OpticACS.',
    'O OpticNoteBook disponibiliza infraestrutura tecnológica para que empresas apresentem seus serviços, profissionais, horários e disponibilidade, bem como para que clientes localizem empresas e realizem solicitações de agendamento.',
    'Estes Termos aplicam-se aos visitantes da plataforma, clientes com ou sem conta, empreendedores, administradores de empresas e demais usuários que utilizem qualquer funcionalidade disponibilizada pelo OpticNoteBook.',
    'Ao criar uma conta, cadastrar uma empresa, realizar um agendamento ou utilizar funcionalidades que exijam a aceitação destes Termos, o usuário declara ter lido e concordado com as condições aqui estabelecidas.',
    'A utilização do OpticNoteBook também está sujeita à Política de Privacidade da plataforma, que descreve como os dados pessoais são tratados.',
  ],

  sections: [
    {
      id: 'responsavel-plataforma',
      title: '1. Identificação do responsável pela plataforma',
      paragraphs: [
        'O OpticNoteBook é operado pelo responsável legal pela plataforma e pela marca OpticACS.',
        'Operado por: [NOME OU RAZÃO SOCIAL DO RESPONSÁVEL LEGAL].',
        'CPF/CNPJ: [SE APLICÁVEL].',
        'E-mail de contato: [PREENCHER].',
        'E-mail de privacidade: [PREENCHER].',
        'As informações de identificação e contato deverão permanecer atualizadas enquanto a plataforma estiver em operação.',
      ],
    },

    {
      id: 'objeto',
      title: '2. Objeto do OpticNoteBook',
      paragraphs: [
        'O OpticNoteBook é uma plataforma de tecnologia destinada à organização e intermediação digital de agendamentos entre clientes e empresas cadastradas.',
        'A plataforma permite, conforme as funcionalidades disponíveis, pesquisar empresas, consultar informações públicas, visualizar serviços, procedimentos ou outros itens agendáveis, selecionar profissionais, consultar datas e horários disponíveis, solicitar agendamentos, acompanhar agendamentos futuros, consultar histórico e realizar cancelamentos ou solicitações de reagendamento.',
        'Para empresas, o OpticNoteBook disponibiliza funcionalidades administrativas destinadas à configuração de serviços, profissionais, horários, disponibilidade, agenda, clientes, agendamentos e outras configurações relacionadas à operação do estabelecimento.',
        'O OpticNoteBook não executa, por si próprio, os serviços profissionais oferecidos pelas empresas cadastradas.',
      ],
    },

    {
      id: 'aceitacao',
      title: '3. Aceitação dos Termos',
      paragraphs: [
        'A utilização das funcionalidades sujeitas a estes Termos representa a concordância do usuário com as condições aplicáveis ao uso da plataforma.',
        'Quando a interface exigir confirmação expressa, a aceitação será registrada por meio da ação disponibilizada para essa finalidade, como marcação de caixa de confirmação, botão de aceite ou mecanismo eletrônico equivalente.',
        'Caso o usuário não concorde com estes Termos ou com a Política de Privacidade, não deverá prosseguir com a criação da conta, cadastro empresarial ou utilização das funcionalidades que dependam dessa aceitação.',
        'A simples consulta a páginas públicas poderá ocorrer sem criação de conta, observadas as regras aplicáveis à navegação e à segurança da plataforma.',
      ],
    },

    {
      id: 'capacidade',
      title: '4. Capacidade para utilização da plataforma',
      paragraphs: [
        'O usuário declara possuir capacidade jurídica para praticar os atos realizados por meio da plataforma ou estar devidamente representado ou assistido quando isso for exigido pela legislação.',
        'Crianças, adolescentes e demais pessoas que não possuam capacidade plena para determinados atos deverão utilizar as funcionalidades que produzam efeitos jurídicos com a participação de seus pais, responsáveis ou representantes legais, conforme aplicável.',
        'Quando um agendamento for realizado em benefício de criança ou adolescente, o responsável deverá observar as exigências da empresa prestadora do serviço e da legislação aplicável.',
      ],
    },

    {
      id: 'modalidades-acesso',
      title: '5. Modalidades de acesso',
      paragraphs: [
        'O OpticNoteBook poderá ser utilizado de formas diferentes de acordo com o perfil do usuário.',
        'Clientes poderão acessar páginas públicas, pesquisar empresas e, quando permitido, realizar agendamentos mesmo sem possuir uma conta.',
        'Clientes também poderão criar uma conta global para facilitar o acesso às funcionalidades disponíveis e consultar informações associadas à sua utilização da plataforma.',
        'Empreendedores e administradores deverão utilizar uma conta administrativa empresarial e cumprir os requisitos definidos pelo OpticNoteBook para o cadastro de uma empresa.',
        'A existência de uma conta de cliente não concede acesso às funcionalidades administrativas destinadas às empresas.',
      ],
    },

    {
      id: 'cliente-sem-conta',
      title: '6. Utilização por clientes sem conta',
      paragraphs: [
        'O OpticNoteBook poderá permitir a realização de agendamentos sem que o cliente crie uma conta.',
        'Nesse caso, o cliente deverá fornecer as informações solicitadas para identificação e gerenciamento do agendamento, como nome, e-mail, telefone ou WhatsApp e eventual observação.',
        'O fornecimento dessas informações para determinado agendamento não cria automaticamente uma conta global de cliente.',
        'Mesmo sem conta, o cliente permanece sujeito às disposições destes Termos relacionadas ao agendamento, à utilização adequada da plataforma e às regras definidas pela empresa escolhida.',
      ],
    },

    {
      id: 'conta-cliente',
      title: '7. Conta de cliente',
      paragraphs: [
        'O cliente poderá criar uma conta global no OpticNoteBook quando essa funcionalidade estiver disponível.',
        'A conta poderá permitir o reaproveitamento de determinados dados cadastrais, acesso ao histórico de agendamentos, visualização de próximos atendimentos e outras funcionalidades disponibilizadas pela plataforma.',
        'Quando estiver autenticado, o cliente poderá utilizar seus dados previamente cadastrados em um novo agendamento ou informar dados diferentes exclusivamente para aquele agendamento, quando essa opção estiver disponível.',
        'A conta do cliente é pessoal e não deverá ser utilizada de maneira fraudulenta, abusiva ou com a finalidade de se passar por outra pessoa.',
      ],
    },

    {
      id: 'cadastro-empresa',
      title: '8. Cadastro de empresas',
      paragraphs: [
        'O cadastro de empresas no OpticNoteBook não é público e irrestrito.',
        'Para criar uma empresa, o empreendedor deverá possuir uma chave de autorização válida emitida pelo responsável pela plataforma.',
        'A chave de autorização é individual, destinada ao processo de cadastro correspondente e poderá ser configurada para utilização única.',
        'Uma chave inválida, expirada, já utilizada, revogada ou bloqueada poderá ser recusada pelo sistema.',
        'A disponibilização de uma chave não impede o OpticNoteBook de aplicar verificações adicionais de segurança ou de suspender posteriormente uma conta que viole estes Termos.',
      ],
    },

    {
      id: 'conta-administrativa',
      title: '9. Conta administrativa da empresa',
      paragraphs: [
        'A conta administrativa da empresa permite acesso às funcionalidades de gerenciamento disponibilizadas pelo OpticNoteBook.',
        'Na versão atualmente disponibilizada, a conta administrativa possui acesso amplo às funcionalidades administrativas da respectiva empresa e não deve ser compartilhada indiscriminadamente com terceiros.',
        'O administrador é responsável por proteger suas credenciais, manter sua senha em sigilo e impedir o acesso não autorizado à conta.',
        'A empresa deverá comunicar ao OpticNoteBook qualquer suspeita de comprometimento, perda, utilização indevida ou acesso não autorizado à sua conta.',
      ],
    },

    {
      id: 'informacoes-empresa',
      title: '10. Informações fornecidas pelas empresas',
      paragraphs: [
        'A empresa é responsável pelas informações que cadastrar e disponibilizar por meio do OpticNoteBook.',
        'Essas informações podem incluir nome do estabelecimento, descrição, endereço, telefone, logotipo, serviços, procedimentos, preços informativos, duração dos serviços, profissionais, horários de funcionamento e demais dados relacionados ao atendimento.',
        'A empresa deverá manter suas informações corretas, atualizadas e compatíveis com os serviços que efetivamente oferece.',
        'É proibido cadastrar informações falsas, enganosas, fraudulentas, ilícitas ou que violem direitos de terceiros.',
      ],
    },

    {
      id: 'pagina-publica',
      title: '11. Página pública da empresa',
      paragraphs: [
        'As empresas cadastradas poderão possuir uma página pública dentro do OpticNoteBook, identificada por endereço, slug ou outro identificador disponibilizado pela plataforma.',
        'Essa página poderá ser exibida nos mecanismos internos de pesquisa do OpticNoteBook e poderá apresentar informações fornecidas pela própria empresa.',
        'A empresa é responsável por verificar se as informações destinadas ao público podem efetivamente ser divulgadas.',
        'Informações administrativas, credenciais, dados privados de clientes ou outras informações que não sejam destinadas à divulgação pública não deverão ser inseridas em campos destinados à página pública.',
      ],
    },

    {
      id: 'servicos',
      title: '12. Serviços, procedimentos e itens agendáveis',
      paragraphs: [
        'Cada empresa é responsável por cadastrar e administrar os serviços, procedimentos, exames ou demais itens disponibilizados para agendamento.',
        'A empresa poderá definir nome, descrição, duração, preço informativo, profissionais relacionados e situação de disponibilidade de cada item.',
        'Somente os itens configurados pela empresa como disponíveis para o público deverão ser apresentados aos clientes para novos agendamentos.',
        'O cadastramento de determinado serviço no OpticNoteBook não representa recomendação, certificação ou garantia de qualidade emitida pela plataforma.',
      ],
    },

    {
      id: 'precos',
      title: '13. Preços apresentados na plataforma',
      paragraphs: [
        'Os valores apresentados junto aos serviços no OpticNoteBook possuem caráter informativo de acordo com os dados fornecidos pela empresa responsável.',
        'A empresa é responsável pela exatidão, atualização e clareza das informações de preço que cadastrar.',
        'Caso existam condições adicionais, variações justificáveis ou informações indispensáveis para compreensão do preço, a empresa deverá comunicá-las ao cliente de maneira adequada e em conformidade com a legislação aplicável.',
        'O OpticNoteBook não deverá alterar por iniciativa própria o preço de um serviço cadastrado pela empresa, salvo para corrigir erro técnico evidente ou cumprir determinação legal.',
      ],
    },

    {
      id: 'profissionais',
      title: '14. Profissionais',
      paragraphs: [
        'A empresa poderá cadastrar profissionais e associá-los aos serviços para os quais estão disponíveis.',
        'A empresa é responsável por possuir autorização ou outra base legítima para cadastrar e exibir informações referentes aos seus profissionais.',
        'A disponibilidade de um profissional apresentada pela plataforma dependerá das configurações de horários, serviços e agenda registradas pela empresa.',
        'O cadastro de um profissional não representa verificação automática pelo OpticNoteBook de formação, registro profissional, habilitação técnica ou qualquer outra credencial exigida para sua atividade.',
        'Cabe à empresa e, quando necessário, ao próprio cliente verificar requisitos profissionais específicos relacionados ao serviço contratado.',
      ],
    },

    {
      id: 'disponibilidade',
      title: '15. Disponibilidade de horários',
      paragraphs: [
        'Os horários apresentados ao cliente são calculados com base nas configurações mantidas pela empresa, incluindo dias e horários de funcionamento, duração do serviço, profissionais disponíveis, intervalos, tolerâncias, bloqueios e agendamentos já existentes.',
        'A disponibilidade deverá ser validada pelo sistema no momento da solicitação do agendamento.',
        'Um horário exibido anteriormente poderá deixar de estar disponível caso seja ocupado, bloqueado ou alterado antes da conclusão do agendamento.',
        'A plataforma utiliza mecanismos destinados a impedir sobreposição indevida de agendamentos, mas alterações, cancelamentos ou indisponibilidades operacionais da empresa poderão afetar horários previamente apresentados.',
      ],
    },

    {
      id: 'fluxo-agendamento',
      title: '16. Solicitação de agendamento',
      paragraphs: [
        'O fluxo de agendamento poderá permitir que o cliente escolha uma empresa, um serviço, um profissional quando aplicável, uma data, um horário e forneça os dados necessários ao atendimento.',
        'Antes do envio, o cliente deverá verificar as informações apresentadas na etapa de revisão.',
        'O envio de uma solicitação não significa necessariamente que o atendimento já tenha sido confirmado pela empresa.',
        'A solicitação será registrada de acordo com o status aplicável e poderá depender da confirmação manual da empresa.',
      ],
    },

    {
      id: 'confirmacao-agendamento',
      title: '17. Confirmação dos agendamentos',
      paragraphs: [
        'Na modalidade atualmente utilizada pelo OpticNoteBook, a confirmação do agendamento é realizada manualmente pela empresa responsável.',
        'O cliente deverá observar o status apresentado pela plataforma e eventuais comunicações relacionadas ao agendamento.',
        'Enquanto o agendamento estiver aguardando confirmação, ele não deverá ser interpretado como garantia definitiva de que o atendimento será realizado.',
        'Após a confirmação pela empresa, o atendimento continuará sujeito às regras legítimas aplicáveis ao estabelecimento e ao serviço contratado.',
      ],
    },

    {
      id: 'cancelamento-reagendamento',
      title: '18. Cancelamento e reagendamento',
      paragraphs: [
        'As empresas poderão definir um prazo mínimo para que clientes realizem cancelamentos ou reagendamentos por meio do OpticNoteBook.',
        'Quando o pedido estiver dentro do prazo configurado, a plataforma poderá permitir que o cliente realize a operação diretamente pelas funcionalidades disponíveis.',
        'Quando o prazo configurado já tiver sido ultrapassado, a opção poderá ficar indisponível na plataforma e o cliente poderá precisar entrar em contato diretamente com a empresa.',
        'As regras configuradas pela empresa não poderão afastar direitos assegurados por legislação obrigatória aplicável ao caso concreto.',
        'Alterações realizadas pela própria empresa poderão modificar o status, horário ou disponibilidade do atendimento, devendo a empresa comunicar adequadamente o cliente quando necessário.',
      ],
    },

    {
      id: 'pagamentos',
      title: '19. Pagamentos',
      paragraphs: [
        'O OpticNoteBook não possui, atualmente, sistema próprio de pagamento online para os serviços agendados.',
        'A forma de pagamento, cobrança, emissão de documentos fiscais, descontos, reembolsos e demais condições financeiras relativas ao serviço são definidas diretamente pela empresa responsável pelo atendimento, observada a legislação aplicável.',
        'O usuário não deverá inserir números completos de cartão, códigos de segurança, senhas bancárias ou outras credenciais financeiras nos campos livres do OpticNoteBook.',
        'Caso funcionalidades de pagamento sejam implementadas futuramente, estes Termos e a Política de Privacidade deverão ser atualizados conforme necessário.',
      ],
    },

    {
      id: 'relacao-cliente-empresa',
      title: '20. Relação entre cliente e empresa',
      paragraphs: [
        'A contratação e execução do serviço agendado ocorrem entre o cliente e a empresa ou profissional responsável pelo atendimento.',
        'O OpticNoteBook fornece a infraestrutura tecnológica utilizada para localizar empresas, consultar disponibilidade e organizar agendamentos.',
        'A empresa permanece responsável pelos serviços que oferece, pela qualidade e segurança do atendimento, pela atuação de seus profissionais, pelas informações comerciais que divulga e pelo cumprimento das obrigações legais aplicáveis à sua atividade.',
        'Essa separação de responsabilidades não exclui eventual responsabilidade do OpticNoteBook por atos, omissões, defeitos ou falhas que sejam legalmente atribuíveis à própria plataforma.',
      ],
    },

    {
      id: 'obrigacoes-cliente',
      title: '21. Obrigações do cliente',
      paragraphs: [
        'Ao utilizar o OpticNoteBook, o cliente compromete-se a fornecer informações verdadeiras e suficientemente atualizadas para permitir a utilização das funcionalidades solicitadas.',
        'O cliente deverá revisar corretamente empresa, serviço, profissional, data, horário e demais informações antes de enviar um agendamento.',
        'O cliente é responsável por comparecer ao atendimento conforme combinado com a empresa ou realizar cancelamento ou reagendamento quando não puder comparecer, observadas as regras aplicáveis.',
        'O cliente não deverá realizar agendamentos falsos, utilizar dados de terceiros sem legitimidade, criar solicitações com objetivo de prejudicar uma empresa ou utilizar a plataforma para fins fraudulentos.',
      ],
    },

    {
      id: 'obrigacoes-empresa',
      title: '22. Obrigações da empresa',
      paragraphs: [
        'A empresa deverá utilizar o OpticNoteBook de forma compatível com sua atividade e com a legislação aplicável.',
        'A empresa é responsável por manter serviços, preços informativos, profissionais, horários, disponibilidade, endereço, contatos e demais informações relevantes atualizados.',
        'Também é responsável por analisar e administrar solicitações de agendamento em prazo razoável e por não apresentar como disponível aquilo que sabe não poder oferecer.',
        'A empresa deverá respeitar os direitos de seus clientes, inclusive aqueles previstos na legislação de defesa do consumidor e de proteção de dados quando aplicáveis.',
        'A empresa não poderá utilizar os dados obtidos por meio do OpticNoteBook para práticas ilícitas, abusivas ou incompatíveis com as finalidades legítimas do relacionamento com seus clientes.',
      ],
    },

    {
      id: 'uso-proibido',
      title: '23. Usos proibidos',
      paragraphs: [
        'É proibido utilizar o OpticNoteBook para praticar fraude, falsidade, assédio, ameaça, discriminação ilícita ou qualquer atividade contrária à legislação brasileira.',
        'Também é proibido tentar acessar contas, empresas, bancos de dados, áreas administrativas ou recursos para os quais o usuário não possua autorização.',
        'Não é permitido explorar vulnerabilidades, contornar mecanismos de autenticação ou segurança, sobrecarregar propositalmente a infraestrutura, distribuir código malicioso ou interferir intencionalmente no funcionamento da plataforma.',
        'É proibida a coleta automatizada abusiva de dados, especialmente quando destinada à obtenção de dados pessoais, violação de direitos, sobrecarga da plataforma ou finalidade incompatível com estes Termos.',
        'Também não é permitida a utilização do OpticNoteBook para cadastrar conteúdo ilícito ou violador de direitos de terceiros.',
      ],
    },

    {
      id: 'credenciais',
      title: '24. Segurança das credenciais',
      paragraphs: [
        'Cada usuário é responsável por manter sob sua guarda as credenciais associadas à sua conta.',
        'Senhas não devem ser compartilhadas publicamente ou fornecidas a terceiros não autorizados.',
        'O usuário deverá comunicar ao OpticNoteBook quando possuir razões para acreditar que sua conta foi comprometida.',
        'O OpticNoteBook poderá invalidar sessões, exigir nova autenticação ou adotar outras medidas de proteção quando identificar atividade suspeita ou risco à segurança de uma conta.',
      ],
    },

    {
      id: 'seguranca-plataforma',
      title: '25. Segurança da plataforma',
      paragraphs: [
        'O OpticNoteBook poderá utilizar mecanismos de segurança como validações no servidor, proteção de sessões, controles de acesso, limitação de requisições, proteção contra automação abusiva, mecanismos antiabuso e outras medidas adequadas às funcionalidades oferecidas.',
        'O usuário não deverá tentar impedir, burlar ou desativar esses mecanismos.',
        'Medidas adicionais de verificação poderão ser exigidas em operações consideradas sensíveis, como login, cadastro, recuperação de acesso ou criação de determinados registros.',
      ],
    },

    {
      id: 'suspensao-clientes',
      title: '26. Restrição ou suspensão de contas de usuários',
      paragraphs: [
        'O OpticNoteBook poderá restringir temporariamente funcionalidades ou suspender uma conta quando houver indícios razoáveis de fraude, abuso, comprometimento de segurança, violação destes Termos ou utilização ilícita da plataforma.',
        'Quando for razoavelmente possível e não houver risco imediato à plataforma, aos usuários ou a terceiros, poderão ser disponibilizadas informações sobre o motivo da restrição e meios para regularização.',
        'Medidas urgentes poderão ser adotadas sem aviso prévio quando necessárias à proteção da plataforma, cumprimento de obrigação legal, atendimento de determinação de autoridade competente ou prevenção de dano relevante.',
      ],
    },

    {
      id: 'suspensao-empresas',
      title: '27. Ativação, suspensão e reativação de empresas',
      paragraphs: [
        'As empresas cadastradas poderão possuir estados de acesso e operação controlados pelo OpticNoteBook, incluindo situações de empresa ativa ou suspensa.',
        'Uma empresa suspensa poderá ter seu acesso administrativo, página pública, recebimento de novos agendamentos ou outras funcionalidades limitadas enquanto durar a suspensão.',
        'A suspensão poderá ocorrer em razão de solicitação da própria empresa, violação destes Termos, risco de segurança, indícios de fraude, utilização indevida, exigência legal ou outra razão legítima relacionada à operação da plataforma.',
        'Quando a situação que motivou a suspensão for resolvida e a reativação for admitida, o responsável pela plataforma poderá restabelecer o acesso da empresa.',
      ],
    },

    {
      id: 'super-admin',
      title: '28. Administração da plataforma',
      paragraphs: [
        'O OpticNoteBook possui mecanismos administrativos destinados à gestão da própria plataforma.',
        'Esses mecanismos podem permitir ao responsável pela plataforma gerenciar empresas cadastradas, emitir chaves de autorização, consultar informações necessárias à administração do serviço e suspender ou reativar empresas.',
        'O acesso a essas funcionalidades administrativas deverá ser restrito a pessoas autorizadas e utilizado somente para finalidades legítimas de operação, segurança, suporte e cumprimento de obrigações legais.',
      ],
    },

    {
      id: 'privacidade',
      title: '29. Privacidade e proteção de dados',
      paragraphs: [
        'O tratamento de dados pessoais realizado por meio do OpticNoteBook observará a Política de Privacidade disponibilizada pela plataforma e a legislação aplicável.',
        'Dependendo da operação realizada, o OpticNoteBook poderá atuar como controlador de determinados dados ou como operador em nome de uma empresa cadastrada.',
        'As empresas deverão tratar os dados de seus clientes de forma compatível com as finalidades do atendimento e com as normas aplicáveis.',
        'A aceitação destes Termos não constitui autorização genérica para utilização irrestrita de dados pessoais.',
      ],
    },

    {
      id: 'conteudo-empresa',
      title: '30. Conteúdo fornecido pelas empresas',
      paragraphs: [
        'A empresa permanece responsável pelo conteúdo que inserir no OpticNoteBook, incluindo textos, logotipos, imagens, nomes comerciais, descrições, informações de serviços e demais materiais.',
        'Ao disponibilizar conteúdo destinado à exibição por meio da plataforma, a empresa declara possuir os direitos ou autorizações necessários para sua utilização.',
        'A empresa autoriza o OpticNoteBook, durante sua permanência na plataforma, a armazenar, processar e exibir esse conteúdo na medida necessária ao funcionamento das funcionalidades contratadas ou solicitadas.',
        'Essa autorização não transfere ao OpticNoteBook a titularidade das marcas, imagens ou demais conteúdos pertencentes à empresa ou a terceiros.',
      ],
    },

    {
      id: 'propriedade-intelectual',
      title: '31. Propriedade intelectual do OpticNoteBook',
      paragraphs: [
        'O software, a identidade visual, a estrutura da plataforma, os elementos gráficos próprios, códigos, componentes, textos institucionais, marcas e demais conteúdos pertencentes ao OpticNoteBook ou à OpticACS permanecem protegidos pela legislação aplicável.',
        'A utilização da plataforma não transfere ao usuário direitos de propriedade intelectual sobre o OpticNoteBook.',
        'Não é permitido reproduzir, distribuir, comercializar ou utilizar elementos protegidos da plataforma fora das hipóteses permitidas por lei ou sem autorização do respectivo titular.',
        'Esta cláusula não restringe direitos que a legislação obrigatoriamente conceda ao usuário.',
      ],
    },

    {
      id: 'terceiros',
      title: '32. Serviços e infraestrutura de terceiros',
      paragraphs: [
        'O funcionamento do OpticNoteBook poderá depender de serviços fornecidos por terceiros, como hospedagem, banco de dados, envio de e-mails, infraestrutura, proteção contra abusos e outros recursos tecnológicos.',
        'Falhas em serviços externos poderão afetar temporariamente determinadas funcionalidades da plataforma.',
        'O OpticNoteBook buscará adotar prestadores adequados e medidas razoáveis de continuidade e segurança de acordo com sua estrutura e os riscos envolvidos.',
        'Quando um terceiro tratar dados pessoais em nome do OpticNoteBook, também deverão ser observadas as regras descritas na Política de Privacidade e na legislação aplicável.',
      ],
    },

    {
      id: 'disponibilidade-plataforma',
      title: '33. Disponibilidade e manutenção',
      paragraphs: [
        'O OpticNoteBook busca manter suas funcionalidades disponíveis e operacionais, mas não garante funcionamento ininterrupto ou absolutamente livre de falhas.',
        'A plataforma poderá passar por manutenções, atualizações, correções de segurança, alterações de infraestrutura ou intervenções necessárias à continuidade do serviço.',
        'Quando possível e relevante, interrupções programadas de maior impacto poderão ser comunicadas aos usuários.',
        'A existência desta cláusula não exclui responsabilidades que não possam ser afastadas pela legislação aplicável.',
      ],
    },

    {
      id: 'falhas-agendamento',
      title: '34. Falhas e divergências em agendamentos',
      paragraphs: [
        'Caso o usuário identifique divergência no status, data, horário, profissional ou outra informação relacionada a um agendamento, deverá verificar as informações apresentadas na plataforma e, quando necessário, entrar em contato com a empresa responsável pelo atendimento.',
        'Se a divergência decorrer de falha técnica atribuível ao OpticNoteBook, a plataforma poderá analisar registros disponíveis e adotar medidas razoáveis para corrigir o problema.',
        'Se a divergência decorrer de informação incorreta inserida ou alterada pela empresa, caberá à empresa prestar os esclarecimentos necessários e corrigir os dados sob sua responsabilidade.',
      ],
    },

    {
      id: 'responsabilidade',
      title: '35. Responsabilidades',
      paragraphs: [
        'Cada parte será responsável por seus próprios atos e omissões na medida prevista pela legislação aplicável.',
        'O OpticNoteBook é responsável pelas funcionalidades tecnológicas que disponibiliza dentro dos limites de sua atuação e das obrigações estabelecidas pela legislação.',
        'As empresas são responsáveis pelos serviços que anunciam ou executam, pelas informações que cadastram, pela atuação de seus profissionais e pelo cumprimento das obrigações legais relacionadas à sua atividade.',
        'Os clientes são responsáveis pela veracidade das informações que fornecem e pela utilização adequada da plataforma.',
        'Nenhuma disposição destes Termos deverá ser interpretada como exclusão ou limitação de responsabilidade quando a legislação brasileira proibir essa exclusão ou limitação.',
      ],
    },

    {
      id: 'direitos-consumidor',
      title: '36. Direitos do consumidor',
      paragraphs: [
        'Quando uma relação estabelecida por meio do OpticNoteBook estiver sujeita ao Código de Defesa do Consumidor ou a outra norma de proteção obrigatória, os direitos assegurados ao consumidor permanecerão preservados.',
        'As disposições destes Termos não têm como objetivo afastar garantias legais, impedir reembolso quando legalmente devido, transferir de maneira ilícita responsabilidades ou impor renúncia antecipada a direitos indisponíveis.',
        'Eventuais conflitos deverão ser analisados de acordo com a participação e responsabilidade de cada envolvido no caso concreto.',
      ],
    },

    {
      id: 'alteracoes-funcionalidades',
      title: '37. Alterações na plataforma',
      paragraphs: [
        'O OpticNoteBook poderá desenvolver, substituir, aperfeiçoar, reorganizar ou remover funcionalidades ao longo do tempo.',
        'Alterações poderão ser realizadas para melhorar a experiência de uso, corrigir falhas, reforçar segurança, adaptar o sistema a alterações legais ou evoluir o produto.',
        'Quando uma alteração afetar substancialmente uma obrigação contratual já assumida ou exigir nova concordância do usuário, serão adotadas as medidas de informação ou aceite necessárias.',
      ],
    },

    {
      id: 'novas-funcionalidades',
      title: '38. Funcionalidades futuras',
      paragraphs: [
        'O fato de determinada funcionalidade ser mencionada como possibilidade futura não representa obrigação de que ela seja implementada.',
        'Recursos como pagamentos online, novas integrações, novos métodos de autenticação, funcionalidades de comunicação ou outros módulos poderão exigir regras adicionais ou atualização destes Termos.',
        'O usuário estará sujeito apenas às condições aplicáveis às funcionalidades efetivamente disponibilizadas e utilizadas.',
      ],
    },

    {
      id: 'alteracao-termos',
      title: '39. Alterações destes Termos',
      paragraphs: [
        'Estes Termos poderão ser atualizados para refletir alterações na plataforma, na legislação ou nas condições de utilização do serviço.',
        'A data da versão mais recente será indicada no início do documento.',
        'Alterações relevantes poderão ser comunicadas por aviso dentro da plataforma, e-mail ou outro meio adequado.',
        'Quando uma alteração exigir nova manifestação de concordância, o OpticNoteBook poderá solicitar novo aceite antes de permitir a continuidade da utilização das funcionalidades afetadas.',
      ],
    },

    {
      id: 'encerramento-conta',
      title: '40. Encerramento da conta',
      paragraphs: [
        'O usuário poderá solicitar o encerramento de sua conta quando essa opção estiver disponível, sem prejuízo de informações que devam ser mantidas em razão de obrigação legal, segurança, exercício regular de direitos ou outra base jurídica aplicável.',
        'O encerramento da conta de cliente não necessariamente cancela, por si só, obrigações ou relações já constituídas diretamente com empresas por meio de atendimentos anteriores.',
        'As consequências relacionadas aos dados pessoais após o encerramento da conta são tratadas também na Política de Privacidade.',
      ],
    },

    {
      id: 'encerramento-empresa',
      title: '41. Encerramento da utilização pela empresa',
      paragraphs: [
        'A empresa poderá deixar de utilizar o OpticNoteBook de acordo com os procedimentos disponibilizados ou mediante contato com o responsável pela plataforma.',
        'O encerramento não elimina obrigações já existentes nem autoriza a destruição imediata de informações cuja manutenção seja exigida ou permitida pela legislação.',
        'Quando houver contratos comerciais específicos entre o OpticNoteBook e uma empresa, condições adicionais de encerramento poderão ser estabelecidas nesses instrumentos, desde que não contrariem estes Termos ou a legislação aplicável.',
      ],
    },

    {
      id: 'comunicacoes',
      title: '42. Comunicações',
      paragraphs: [
        'O OpticNoteBook poderá utilizar os meios de contato fornecidos pelos usuários para comunicações necessárias ao funcionamento da plataforma.',
        'Essas comunicações poderão incluir verificação de conta, códigos de segurança, recuperação ou alteração de senha, informações relacionadas a agendamentos, alertas de segurança, mudanças relevantes nestes Termos e avisos administrativos.',
        'O usuário é responsável por manter seus dados de contato suficientemente atualizados para receber comunicações relacionadas à sua conta.',
      ],
    },

    {
      id: 'legislacao',
      title: '43. Legislação aplicável',
      paragraphs: [
        'Estes Termos são regidos pela legislação da República Federativa do Brasil.',
        'Sua interpretação deverá observar, conforme aplicável ao caso concreto, o Código Civil, o Código de Defesa do Consumidor, o Marco Civil da Internet, a Lei Geral de Proteção de Dados Pessoais e demais normas brasileiras aplicáveis.',
      ],
    },

    {
      id: 'solucao-conflitos',
      title: '44. Solução de conflitos',
      paragraphs: [
        'Em caso de dúvida, divergência ou conflito relacionado à utilização do OpticNoteBook, recomenda-se inicialmente a utilização dos canais de contato da plataforma ou, quando a questão estiver relacionada diretamente ao atendimento, dos canais da empresa responsável.',
        'Nada nesta cláusula impede o usuário de recorrer aos órgãos administrativos ou judiciais competentes quando desejar ou quando a tentativa de solução direta não for adequada.',
        'Quando aplicável a legislação de defesa do consumidor, será preservado o direito do consumidor de buscar solução perante o foro e os órgãos competentes previstos em lei.',
      ],
    },

    {
      id: 'nulidade-parcial',
      title: '45. Nulidade parcial',
      paragraphs: [
        'Caso alguma disposição destes Termos seja considerada inválida, ilegal ou inexequível por autoridade competente, as demais disposições permanecerão válidas na medida permitida pela legislação.',
        'A disposição afetada deverá ser interpretada ou ajustada, quando juridicamente possível, de forma compatível com a legislação e com a finalidade legítima originalmente pretendida.',
      ],
    },

    {
      id: 'nao-renuncia',
      title: '46. Não renúncia',
      paragraphs: [
        'A eventual ausência de exercício imediato de um direito previsto nestes Termos ou na legislação não significa renúncia definitiva a esse direito.',
        'A tolerância eventual em relação a determinado descumprimento não implica autorização para repetição ou continuidade da conduta.',
      ],
    },

    {
      id: 'integracao-politica',
      title: '47. Relação com a Política de Privacidade',
      paragraphs: [
        'Estes Termos de Uso e a Política de Privacidade são documentos complementares.',
        'Os Termos regulam principalmente as condições de utilização da plataforma, enquanto a Política de Privacidade descreve as práticas relacionadas ao tratamento de dados pessoais.',
        'Em questões relacionadas à coleta, utilização, armazenamento, compartilhamento, retenção ou exercício de direitos relacionados a dados pessoais, também deverá ser consultada a Política de Privacidade.',
      ],
    },

    {
      id: 'contato',
      title: '48. Contato',
      paragraphs: [
        'Dúvidas relacionadas a estes Termos ou à utilização do OpticNoteBook poderão ser encaminhadas pelos canais oficiais da plataforma.',
        'OpticNoteBook — Atendimento.',
        'Operado por: Pedro Cauê de Oliveira Carrega.',
        'E-mail: optic.acs.service@gmail.com.',
        'Para questões relacionadas diretamente ao serviço contratado, ao atendimento realizado, ao preço cobrado ou à atuação de um profissional, o cliente também deverá utilizar os canais da empresa responsável pelo respectivo atendimento.',
      ],
    },
  ],
}