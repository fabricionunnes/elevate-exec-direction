/**
 * Template de cláusulas contratuais padrão
 */

export interface ContractClause {
  title: string;
  content: string;
}

export const contractClauses: ContractClause[] = [
  {
    title: "CLÁUSULA PRIMEIRA - DO OBJETO",
    content: "O presente contrato tem por objeto a prestação dos serviços descritos no item 3 deste instrumento, conforme especificações e entregáveis detalhados."
  },
  {
    title: "CLÁUSULA SEGUNDA - DAS OBRIGAÇÕES DA CONTRATADA",
    content: `A CONTRATADA obriga-se a:
a) Prestar os serviços contratados com zelo, diligência e boa técnica profissional;
b) Cumprir os prazos estabelecidos para a entrega dos serviços;
c) Manter sigilo sobre todas as informações da CONTRATANTE às quais tiver acesso;
d) Disponibilizar equipe técnica capacitada para a execução dos serviços;
e) Comunicar à CONTRATANTE qualquer impedimento ou dificuldade na execução dos serviços.`
  },
  {
    title: "CLÁUSULA TERCEIRA - DAS OBRIGAÇÕES DA CONTRATANTE",
    content: `A CONTRATANTE obriga-se a:
a) Efetuar os pagamentos nas datas e condições acordadas;
b) Fornecer as informações e materiais necessários à execução dos serviços;
c) Designar um responsável para acompanhamento e aprovação dos trabalhos;
d) Comunicar por escrito qualquer irregularidade verificada na prestação dos serviços;
e) Não divulgar metodologias e materiais fornecidos pela CONTRATADA.`
  },
  {
    title: "CLÁUSULA QUARTA - DO PRAZO",
    content: "O presente contrato terá vigência conforme especificado nas condições comerciais, podendo ser prorrogado mediante acordo entre as partes, formalizado por escrito."
  },
  {
    title: "CLÁUSULA QUINTA - DA CONFIDENCIALIDADE",
    content: "As partes comprometem-se a manter em sigilo todas as informações confidenciais que venham a ter conhecimento em razão deste contrato, não podendo divulgá-las a terceiros sem autorização prévia e expressa da outra parte, sob pena de responder por perdas e danos."
  },
  {
    title: "CLÁUSULA SEXTA - DA RESCISÃO",
    content: `Este contrato poderá ser rescindido:
a) Por acordo mútuo entre as partes, formalizado por escrito;
b) Por inadimplemento de qualquer das cláusulas contratuais, mediante notificação prévia de 15 (quinze) dias;
c) Por iniciativa de qualquer das partes, mediante aviso prévio de 30 (trinta) dias.
Em caso de rescisão antecipada pela CONTRATANTE, os valores já pagos não serão restituídos, exceto em caso de descumprimento contratual comprovado por parte da CONTRATADA.`
  },
  {
    title: "CLÁUSULA SÉTIMA - DO FORO",
    content: "Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer questões oriundas deste contrato, com renúncia expressa de qualquer outro, por mais privilegiado que seja."
  }
];

export const companyInfo = {
  name: "UNV CONSULTORIA EM GESTÃO EMPRESARIAL LTDA",
  cnpj: "00.000.000/0001-00", // Placeholder - substituir pelo CNPJ real
  address: "São Paulo - SP",
  email: "contato@unv.com.br",
  representative: "Representante Legal",
  role: "Diretor"
};
