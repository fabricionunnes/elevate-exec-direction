// Contrato do UNV Mastermind Alpha gerado no checkout do site (24/11/2026).
// Mesmo modelo do gerador de contratos do Nexus (src/components/contract-generator/generateContractPDF.ts):
// faixas navy e vermelha, logo em marca d'água, cláusulas 1ª a 9ª. Os textos das cláusulas 2ª a 5ª são os de
// src/data/alphaContrato.ts e src/data/productDetails.ts ("mastermind-alpha"): se mudar lá, mude aqui.
import { jsPDF } from "npm:jspdf@2.5.2";

export const EMPRESA_UNV = {
  name: "UNIVERSIDADE NACIONAL DE VENDAS LTDA",
  cnpj: "51.356.237/0001-40",
  address: "Rua Araguaia, 130, Alphaville Lagoa dos Ingleses, Nova Lima, MG, CEP 34.018-150",
  email: "fabricio@universidadevendas.com.br",
  representative: "FABRÍCIO AUGUSTO NUNES OLIVEIRA",
  cpf: "078.102.716-01",
  rg: "MG 14.314.694",
  role: "CEO",
};

export type DadosContrato = {
  razao: string; cnpj: string; email: string; endereco: string;
  representante: string; estadoCivil: string; rg: string; cpf: string;
  valor: number; diaVencimento: number; data: Date;
};

export type Clausula = { id: string; title: string; content: string; isDynamic?: boolean };

const ENTREGAVEIS = [
  "12 encontros presenciais mensais aos sábados, das 14h às 20h, em local informado pela CONTRATADA, conforme o calendário da turma",
  "12 encontros online mensais de prestação de contas",
  "2 GPs de kart no ano, em dia inteiro com almoço, no lugar de 2 encontros presenciais",
  "3 conselhos individuais de 45 minutos com Fabrício Nunes, nos meses 1, 6 e 11",
  "Acesso ao sistema UNV Nexus Alpha durante a vigência",
  "Mesa de negócios: células, rodada de pedidos, um a um mensal, Vitrine Alpha e placar de negócios",
  "Grupo de WhatsApp da turma",
  "Kit de boas-vindas e cartão de membro",
  "Acesso ao CRM e ao ERP Financeiro da UNV durante a vigência (bônus, sem cobrança à parte)",
  "Alpha IA: 3 processos de inteligência artificial implantados e 1 colaborador treinado como Operador Alpha IA (bônus com valor de referência de R$ 15.000, sem cobrança à parte), nas condições da Cláusula 3ª",
  "Capital do Próximo Salto, nas condições da Cláusula 3ª",
];

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formato(): string {
  return [
    "I. O UNV Mastermind Alpha é um programa em turma fechada de até 60 (sessenta) empresários, com duração de 12 (doze) meses, conduzido por Fabrício Nunes, com foco no crescimento do lucro líquido da empresa da CONTRATANTE.",
    "II. Encontros presenciais: 1 (um) encontro por mês, aos sábados, das 14h às 20h, em local informado pela CONTRATADA, conforme o calendário anual da turma divulgado pela CONTRATADA. Em 2 (dois) meses do ano o encontro presencial é substituído por um GP de kart, em dia inteiro, com almoço.",
    "III. Encontros online: 1 (um) encontro por mês de prestação de contas, por videoconferência, cerca de 15 (quinze) dias depois de cada encontro presencial.",
    "IV. Também integram o programa: 3 (três) conselhos individuais de 45 (quarenta e cinco) minutos com Fabrício Nunes, nos meses 1, 6 e 11; acesso ao sistema UNV Nexus Alpha durante a vigência; a mesa de negócios (células, rodada de pedidos, um a um mensal, Vitrine Alpha e placar de negócios); o grupo de WhatsApp da turma; e o kit de boas-vindas com o cartão de membro.",
    "V. Alpha IA: bônus com valor de referência de R$ 15.000,00 (quinze mil reais), entregue sem cobrança à parte. Ao longo da vigência, a CONTRATADA desenha e implanta 3 (três) processos de inteligência artificial na empresa da CONTRATANTE, definidos em conjunto a partir do diagnóstico, e treina 1 (um) colaborador indicado pela CONTRATANTE como Operador Alpha IA, responsável por executar e manter esses processos no dia a dia. Assinaturas, ferramentas e consumo de serviços de terceiros usados nos processos ficam por conta da CONTRATANTE. O bônus acompanha o contrato: encerrado o contrato, encerra-se a implantação ainda não concluída.",
    "VI. A CONTRATADA poderá alterar a data ou o local de um encontro por motivo relevante, comunicando a CONTRATANTE com antecedência mínima de 15 (quinze) dias, salvo caso fortuito ou força maior.",
    "VII. A participação é pessoal e intransferível do representante da CONTRATANTE que assina este contrato. A ausência em encontros não gera reposição, desconto ou abatimento nas mensalidades.",
    // No checkout ninguém tem exclusividade marcada: quando o Fabrício concede, o contrato sai pelo gerador do Nexus.
    "VIII. Exclusividade de segmento: este contrato NÃO inclui exclusividade de segmento. Outras empresas do mesmo segmento da CONTRATANTE podem participar da turma.",
    "IX. As informações compartilhadas pelos membros nos encontros, no grupo e no sistema são confidenciais e não podem ser divulgadas a terceiros, durante e após a vigência deste contrato.",
    `X. Capital do Próximo Salto: ao final dos 12 (doze) meses, a CONTRATADA fará um aporte de R$ 6.000,00 (seis mil reais), por PIX, na conta da empresa da CONTRATANTE, desde que a CONTRATANTE cumpra, cumulativamente, os 3 (três) critérios abaixo:
(a) as 12 (doze) mensalidades pagas, todas em dia;
(b) presença em pelo menos 10 (dez) dos 12 (doze) encontros presenciais;
(c) o sistema UNV Nexus Alpha alimentado todos os meses, com o fechamento do mês feito até o dia 10 (dez) do mês seguinte.`,
    "XI. O Capital do Próximo Salto só é devido com os 3 (três) critérios cumpridos por inteiro. Se o contrato for cancelado ou rescindido antes do fim dos 12 (doze) meses, por qualquer motivo, ou se qualquer critério deixar de ser cumprido, a CONTRATANTE não terá direito a nenhum valor do Capital, nem integral nem proporcional, e nenhuma quantia já paga será restituída a esse título.",
    "XII. O aporte será feito em até 30 (trinta) dias após o último encontro da turma, e deve ser aplicado pela CONTRATANTE no primeiro passo do ciclo seguinte, como a contratação de um vendedor, investimento em tráfego ou um agente de inteligência artificial.",
    "XIII. Natureza da obrigação: a CONTRATADA se obriga a entregar o programa descrito neste contrato (encontros, conselhos, sistema e metodologia), e não a um resultado financeiro. A meta de crescimento de 15% (quinze por cento) do faturamento e as metas de lucro são referências de planejamento, não garantia de resultado. O resultado da empresa da CONTRATANTE depende da sua própria execução, do mercado e de fatores fora do controle da CONTRATADA. O não atingimento de qualquer meta não dá à CONTRATANTE direito a devolução, abatimento, multa, indenização ou rescisão sem o aviso prévio previsto neste contrato. Materiais comerciais e de divulgação (site, apresentações, documentos e mensagens) não alteram o disposto neste item.",
  ].join("\n\n");
}

function investimento(valor: number, dia: number): string {
  return [
    `I. O valor do presente contrato será de ${brl(valor)} mensais, em 12 (doze) mensalidades, totalizando ${brl(valor * 12)}.`,
    "II. A 1ª (primeira) mensalidade é paga via PIX no ato da contratação. As 11 (onze) mensalidades seguintes são debitadas por PIX Automático, autorizado pela CONTRATANTE no ato da contratação, na data de vencimento de cada mês.",
    `Vencimento: todo dia ${dia} de cada mês.`,
    "III. Em caso de atraso no pagamento, incidirão multa moratória de 2% (dois por cento) e juros de mora de 1% (um por cento) ao mês sobre o valor em atraso.",
    "IV. Este contrato caracteriza-se como prestação de serviço com pagamento recorrente. O não uso dos serviços não isenta a CONTRATANTE do pagamento dos valores acordados.",
    "V. A rescisão poderá ser feita com aviso prévio de 30 (trinta) dias do vencimento da próxima parcela.",
  ].join("\n\n");
}

const RESCISAO = `I. O CONTRATANTE que desejar rescindir o presente contrato deverá comunicar a CONTRATADA, por escrito, com antecedência mínima de 30 (trinta) dias do próximo vencimento, ficando obrigado ao pagamento integral da parcela referente ao período de aviso prévio.

II. A ausência de comunicação formal ou o não pagamento da parcela de aviso prévio na data de vencimento implicará na manutenção automática do contrato em pleno vigor, gerando regularmente as parcelas subsequentes, as quais serão devidas e exigíveis nos termos deste instrumento.

III. As parcelas vencidas e não pagas ficarão sujeitas a:
(a) multa moratória de 2% (dois por cento) sobre o valor do débito;
(b) juros de mora de 1% (um por cento) ao mês, calculados pro rata die;
(c) correção monetária pelo IGP-M/FGV ou índice que venha a substituí-lo;
(d) honorários advocatícios de 20% (vinte por cento) sobre o valor atualizado do débito, em caso de cobrança judicial ou extrajudicial, sem prejuízo das demais despesas processuais e custas judiciais.

IV. A rescisão contratual somente produzirá efeitos após o cumprimento integral do aviso prévio e a quitação de todos os valores devidos até a data efetiva do encerramento.`;

export function clausulasAlpha(valor: number, dia: number): Clausula[] {
  return [
    { id: "objeto", title: "CLÁUSULA 1ª - OBJETO", content: "O presente contrato tem por objeto a prestação dos serviços descritos neste instrumento, conforme especificações e entregáveis detalhados na Cláusula 2ª." },
    { id: "entrega", title: "CLÁUSULA 2ª - ENTREGA DOS SERVIÇOS", content: "Durante a vigência do contrato, a CONTRATADA se compromete a entregar os serviços do plano contratado, conforme descrito abaixo:", isDynamic: true },
    { id: "formato", title: "CLÁUSULA 3ª - FORMATO DO PROGRAMA", content: formato() },
    { id: "vigencia", title: "CLÁUSULA 4ª - VIGÊNCIA", content: "O presente contrato terá vigência de 12 (doze) meses, contados a partir da assinatura, abrangendo os 12 (doze) encontros do calendário da turma. A renovação depende de novo acordo entre as partes." },
    { id: "investimento", title: "CLÁUSULA 5ª - INVESTIMENTO E CONDIÇÕES DE PAGAMENTO", content: investimento(valor, dia) },
    { id: "rescisao", title: "CLÁUSULA 6ª - SOBRE RESCISÃO DE CONTRATO", content: RESCISAO },
    { id: "confidencialidade", title: "CLÁUSULA 7ª - CONFIDENCIALIDADE E DIREITOS AUTORAIS", content: "I. Todo material, identidade visual, roteiros e estratégias desenvolvidas são de propriedade intelectual da CONTRATADA.\n\nII. É vedada a reprodução, comercialização ou uso indevido do material fora do escopo do contrato.\n\nIII. A CONTRATADA compromete-se a manter em sigilo todas as informações fornecidas pela CONTRATANTE." },
    { id: "conduta", title: "CLÁUSULA 8ª - CONDUTA E ÉTICA", content: "I. Ambas as partes comprometem-se com uma relação ética e respeitosa.\n\nII. Fica proibida a tentativa de contratação direta de membros da equipe da CONTRATADA por até 180 dias após o encerramento deste contrato, sob pena de multa de 50% do valor total contratado." },
    { id: "disposicoes", title: "CLÁUSULA 9ª - DISPOSIÇÕES GERAIS", content: "I. A CONTRATANTE declara ter lido e entendido os termos do contrato, estando de acordo com todas as cláusulas.\n\nII. O foro eleito para dirimir qualquer questão será o da Comarca de Nova Lima/MG." },
  ];
}

const NAVY = [10, 34, 64] as const;
const RED = [220, 38, 38] as const;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

type Logo = { dataUrl: string; width: number; height: number };
async function carregarLogo(): Promise<Logo | null> {
  try {
    const r = await fetch("https://unvholdings.com.br/images/unv-logo-contract.png", { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const b = new Uint8Array(await r.arrayBuffer());
    // dimensões no cabeçalho IHDR do PNG
    const dv = new DataView(b.buffer);
    const width = dv.getUint32(16), height = dv.getUint32(20);
    let bin = "";
    for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
    return { dataUrl: "data:image/png;base64," + btoa(bin), width, height };
  } catch { return null; }
}
const caber = (w: number, h: number, mw: number, mh: number) => {
  let width = mw, height = mw / (w / h);
  if (height > mh) { height = mh; width = height * (w / h); }
  return { width, height };
};

export async function gerarPdfAlpha(d: DadosContrato, clausulas: Clausula[]): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
  const margin = 25, cw = pw - margin - 20;
  let y = margin;
  const logo = await carregarLogo();

  const decorar = () => {
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]); doc.rect(0, 0, 6, ph, "F");
    doc.setFillColor(RED[0], RED[1], RED[2]); doc.rect(6, 0, 2, ph, "F");
    if (logo) {
      try {
        // deno-lint-ignore no-explicit-any
        const D = doc as any;
        D.setGState(new D.GState({ opacity: 0.06 }));
        const { width, height } = caber(logo.width, logo.height, 120, 120);
        doc.addImage(logo.dataUrl, "PNG", (pw - width) / 2, (ph - height) / 2, width, height);
        D.setGState(new D.GState({ opacity: 1 }));
      } catch { /* sem marca d'água */ }
    }
  };
  const quebra = (esp: number) => { if (y + esp > ph - 30) { doc.addPage(); decorar(); y = margin; } };
  const texto = (t: string, size: number, o: { bold?: boolean; color?: readonly [number, number, number]; align?: "left" | "center"; lh?: number } = {}) => {
    const { bold = false, color = [0, 0, 0] as const, align = "left", lh = size * 0.5 } = o;
    doc.setFontSize(size); doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setTextColor(color[0], color[1], color[2]);
    for (const linha of doc.splitTextToSize(t, cw) as string[]) {
      quebra(8);
      doc.text(linha, align === "center" ? pw / 2 : margin, y, { align });
      y += lh;
    }
  };
  const corpo = (t: string) => {
    doc.setFontSize(10);
    for (const linha of doc.splitTextToSize(t, cw) as string[]) {
      quebra(6); doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0);
      doc.text(linha, margin, y); y += 5;
    }
    y += 3;
  };
  const secao = (t: string) => { quebra(15); y += 6; texto(t, 11, { bold: true, color: NAVY }); y += 3; };

  decorar();
  if (logo) {
    const { width, height } = caber(logo.width, logo.height, 60, 50);
    doc.addImage(logo.dataUrl, "PNG", pw / 2 - width / 2, y, width, height);
    y += height + 8;
  } else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text("UNIVERSIDADE NACIONAL DE VENDAS", pw / 2, y + 10, { align: "center" }); y += 20;
  }
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]); doc.setFontSize(14); doc.setFont("helvetica", "bold");
  doc.text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS – UNV MASTERMIND ALPHA", pw / 2, y, { align: "center" });
  y += 12;

  secao("IDENTIFICAÇÃO DAS PARTES");
  texto("As partes abaixo identificadas têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas seguintes e pelas condições de preço, forma e termo de pagamento descritas no presente neste contrato.", 10);
  y += 5;
  texto("CONTRATADA:", 10, { bold: true });
  const u = EMPRESA_UNV;
  texto(`${u.name}, inscrita no CNPJ sob o nº ${u.cnpj}, com sede na ${u.address}, e-mail: ${u.email}, neste ato representada por seu ${u.role}, ${u.representative}, CPF ${u.cpf} e RG ${u.rg}.`, 10);
  y += 5;
  texto("CONTRATANTE:", 10, { bold: true });
  texto(`${d.razao}, sociedade empresária inscrita no CNPJ sob o nº ${d.cnpj}, com sede na ${d.endereco}, e endereço eletrônico ${d.email}, neste ato representada por ${d.representante}, brasileiro(a), ${d.estadoCivil}, empresário(a), portador(a) da Cédula de Identidade RG nº ${d.rg}, inscrito(a) no CPF sob o nº ${d.cpf}.`, 10);
  y += 8;

  for (const c of clausulas) {
    quebra(25);
    secao(c.title);
    if (c.isDynamic && c.id === "entrega") {
      texto(c.content, 10); y += 3;
      for (const item of ENTREGAVEIS) { quebra(8); texto(`• ${item}`, 10); }
      y += 3;
    } else corpo(c.content);
  }

  quebra(70);
  y += 15;
  texto(`Nova Lima, MG ${String(d.data.getDate()).padStart(2, "0")} de ${MESES[d.data.getMonth()]} de ${d.data.getFullYear()}`, 11, { align: "center", bold: true });
  y += 25;
  const sw = 70, gap = 20, lx = (pw - (sw * 2 + gap)) / 2, rx = lx + sw + gap;
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
  for (const [x, nome, papel] of [[lx, u.representative, "CONTRATADA"], [rx, d.representante.toUpperCase(), "CONTRATANTE"]] as const) {
    doc.line(x, y, x + sw, y);
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(nome, x + sw / 2, y + 6, { align: "center" });
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0);
    doc.text(papel, x + sw / 2, y + 12, { align: "center" });
  }
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(128, 128, 128);
    doc.text(`Página ${i} de ${total}`, pw / 2, ph - 10, { align: "center" });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
