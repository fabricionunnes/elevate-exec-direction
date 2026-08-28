// Emissão de NFS-e direto no Emissor Nacional (gov.br), sem intermediário.
// Fluxo: monta a DPS em XML (layout 1.00 do fisco) -> assina com o certificado
// da empresa -> compacta em gzip -> envia via ponte -> guarda a nota.
// A ponte existe porque o servidor do gov pede o certificado por renegociação
// TLS, que o runtime das edge functions não faz.
import { createClient } from "@supabase/supabase-js";
import forge from "https://esm.sh/node-forge@1.3.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytesToB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const so = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const esc = (v: unknown) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const dec2 = (n: number) => (Math.round(Number(n || 0) * 100) / 100).toFixed(2);

async function decifrar(guardado: string) {
  const raw = Deno.env.get("CERT_ENCRYPTION_KEY")!;
  const key = await crypto.subtle.importKey("raw", b64ToBytes(raw), "AES-GCM", false, ["decrypt"]);
  const [iv, dados] = guardado.split(":");
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(iv) }, key, b64ToBytes(dados));
  return new TextDecoder().decode(buf);
}

function abrirPfx(pfxB64: string, senha: string) {
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.decode64(pfxB64)), senha);
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const keyBags = (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [])
    .concat(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []);
  return {
    cert: certBags[0].cert!,
    key: keyBags[0].key!,
    certPem: certBags.map((b: any) => forge.pki.certificateToPem(b.cert)).join("\n"),
    keyPem: forge.pki.privateKeyToPem(keyBags[0].key!),
  };
}

/** Id da DPS: 'DPS' + cód. município(7) + tipo inscrição(1) + inscrição(14) + série(5) + número(15) */
function montarIdDps(codMun: string, cnpj: string, serie: string, numero: number) {
  return "DPS" + codMun.padStart(7, "0") + "2" + so(cnpj).padStart(14, "0") +
    String(serie).padStart(5, "0") + String(numero).padStart(15, "0");
}

/** assinatura XMLDSig (enveloped, RSA-SHA1 + C14N) — padrão dos documentos fiscais */
function assinar(xmlInfDps: string, idDps: string, cert: any, key: any) {
  // O digest é calculado sobre o trecho JÁ canonicalizado (C14N): nele o
  // elemento assinado carrega o namespace herdado do pai. Sem isso o gov
  // recusa com "erro na assinatura" (E0714).
  const canon = xmlInfDps.replace(
    "<infDPS ",
    `<infDPS xmlns="http://www.sped.fazenda.gov.br/nfse" `,
  );
  const digest = forge.md.sha256.create();
  digest.update(canon, "utf8");
  const digestValue = forge.util.encode64(digest.digest().getBytes());

  // C14N expande tags autofechadas (<X/> vira <X></X>): o SignedInfo precisa
  // já nascer na forma canônica, senão os bytes assinados diferem dos conferidos
  const signedInfo =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></SignatureMethod>` +
    `<Reference URI="#${idDps}">` +
    `<Transforms>` +
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></DigestMethod>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference></SignedInfo>`;

  const md = forge.md.sha256.create();
  md.update(signedInfo, "utf8");
  const signatureValue = forge.util.encode64(key.sign(md));
  const certB64 = forge.util.encode64(
    forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(),
  );

  return `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}` +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${certB64}</X509Certificate></X509Data></KeyInfo>` +
    `</Signature>`;
}

/** pessoa (tomador): CNPJ ou CPF, nome e endereço quando houver */
function blocoPessoa(tag: string, p: any) {
  const doc = so(p.documento);
  const ident = doc.length === 14 ? `<CNPJ>${doc}</CNPJ>` : doc.length === 11 ? `<CPF>${doc}</CPF>` : "";
  const end = p.cep && p.municipio
    ? `<end><endNac><cMun>${so(p.municipio)}</cMun><CEP>${so(p.cep)}</CEP></endNac>` +
      `<xLgr>${esc(p.logradouro || "Nao informado")}</xLgr><nro>${esc(p.numero || "S/N")}</nro>` +
      (p.complemento ? `<xCpl>${esc(p.complemento)}</xCpl>` : "") +
      `<xBairro>${esc(p.bairro || "Centro")}</xBairro></end>`
    : "";
  return `<${tag}>${ident}${p.nome ? `<xNome>${esc(p.nome)}</xNome>` : ""}${end}` +
    (p.email ? `<email>${esc(p.email)}</email>` : "") + `</${tag}>`;
}

function montarDps(cfg: any, dados: any, numero: number, semIM = false) {
  const idDps = montarIdDps(cfg.codigo_municipio, cfg.cnpj, cfg.serie, numero);
  // o layout exige data-hora com fuso (-03:00); "Z" é recusado pelo schema
  const br = new Date(Date.now() - 3 * 3600000).toISOString();
  const agora = `${br.slice(0, 19)}-03:00`;
  const compet = br.slice(0, 10);

  const infDps =
    `<infDPS Id="${idDps}">` +
    `<tpAmb>${cfg.ambiente}</tpAmb>` +
    `<dhEmi>${agora}</dhEmi>` +
    `<verAplic>UNV-Nexus-1.0</verAplic>` +
    `<serie>${esc(cfg.serie)}</serie>` +
    `<nDPS>${numero}</nDPS>` +
    `<dCompet>${compet}</dCompet>` +
    `<tpEmit>1</tpEmit>` +
    `<cLocEmi>${so(cfg.codigo_municipio)}</cLocEmi>` +
    `<prest><CNPJ>${so(cfg.cnpj)}</CNPJ>` +
      (!semIM && cfg.inscricao_municipal ? `<IM>${esc(cfg.inscricao_municipal)}</IM>` : "") +
      `<regTrib><opSimpNac>${cfg.op_simples_nacional}</opSimpNac>` +
      (cfg.op_simples_nacional === "3" ? `<regApTribSN>${cfg.regime_apuracao_sn || "1"}</regApTribSN>` : "") +
      `<regEspTrib>${cfg.regime_especial}</regEspTrib></regTrib>` +
    `</prest>` +
    blocoPessoa("toma", dados.tomador) +
    `<serv><locPrest><cLocPrestacao>${so(dados.municipio_servico || cfg.codigo_municipio)}</cLocPrestacao></locPrest>` +
      `<cServ><cTribNac>${esc(dados.codigo_servico || cfg.codigo_servico)}</cTribNac>` +
      `<xDescServ>${esc(dados.descricao)}</xDescServ>` +
      ((dados.codigo_nbs || cfg.codigo_nbs) ? `<cNBS>${esc(dados.codigo_nbs || cfg.codigo_nbs)}</cNBS>` : "") +
      `</cServ></serv>` +
    `<valores><vServPrest><vServ>${dec2(dados.valor)}</vServ></vServPrest>` +
      `<trib><tribMun><tribISSQN>1</tribISSQN>` +
      `<tpRetISSQN>${cfg.tipo_retencao_iss}</tpRetISSQN></tribMun>` +
      (cfg.op_simples_nacional === "3"
        ? `<totTrib><pTotTribSN>${dec2(cfg.percentual_trib_sn || 0)}</pTotTribSN></totTrib>`
        : `<totTrib><indTotTrib>0</indTotTrib></totTrib>`) +
      `</trib></valores>` +
    `</infDPS>`;

  return { idDps, infDps };
}

async function gzipB64(texto: string) {
  const cs = new CompressionStream("gzip");
  const stream = new Blob([new TextEncoder().encode(texto)]).stream().pipeThrough(cs);
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  return btoa(bin);
}

async function pontoGov(path: string, metodo: string, corpo: string | undefined, certPem: string, keyPem: string, ambiente = "1") {
  const url = Deno.env.get("NFSE_BRIDGE_URL"), token = Deno.env.get("NFSE_BRIDGE_TOKEN");
  if (!url || !token) throw new Error("Ponte de NFS-e não configurada");
  const r = await fetch(`${url}/gov`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bridge-token": token },
    body: JSON.stringify({
      // ambiente 2 (teste) tem endereço próprio; mandar teste pra produção é recusado
      host: ambiente === "2" ? "sefin.producaorestrita.nfse.gov.br" : "sefin.nfse.gov.br",
      path, metodo, corpo,
      headers: corpo ? { "Content-Type": "application/json" } : undefined,
      cert_pem: certPem, key_pem: keyPem,
    }),
  });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error || `ponte respondeu ${r.status}`);
  return d as { status: number; corpo: string; corpo_base64?: string };
}


async function gunzipB64(b64: string) {
  const ds = new DecompressionStream("gzip");
  const stream = new Blob([b64ToBytes(b64)]).stream().pipeThrough(ds);
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

/** espelho da NFS-e gerado do XML — usado quando o serviço de PDF do gov cai
 *  (instabilidade crônica conhecida). O documento legal é o XML. */
async function gerarEspelho(xml: string, chave: string): Promise<Uint8Array> {
  const { jsPDF } = await import("https://esm.sh/jspdf@2.5.2");
  const pega = (tag: string) => (xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`)) || [])[1] || "";
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const NAVY: [number, number, number] = [13, 43, 94];
  doc.setFillColor(...NAVY); doc.rect(0, 0, 210, 26, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont("helvetica", "bold");
  doc.text("NFS-e — Nota Fiscal de Serviço Eletrônica", 12, 11);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("Espelho gerado pelo UNV Nexus a partir do XML oficial (Emissor Nacional)", 12, 18);
  doc.setTextColor(30, 30, 30);
  let y = 38;
  const linha = (rot: string, val: string) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(rot, 12, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    const quebra = doc.splitTextToSize(val || "-", 180);
    doc.text(quebra, 12, y + 5);
    y += 7 + quebra.length * 5;
  };
  linha("NÚMERO DA NFS-e", pega("nNFSe"));
  linha("CHAVE DE ACESSO", chave);
  linha("EMITIDA EM", pega("dhProc"));
  linha("PRESTADOR", `${pega("xNome")} — CNPJ ${(xml.match(/<CNPJ>(\d+)<\/CNPJ>/) || [])[1] || ""}`);
  const tomaTrecho = (xml.match(/<toma>[\s\S]*?<\/toma>/) || [""])[0];
  linha("TOMADOR", `${(tomaTrecho.match(/<xNome>([^<]+)</) || [])[1] || ""} — ${(tomaTrecho.match(/<CNPJ>(\d+)</) || tomaTrecho.match(/<CPF>(\d+)</) || [])[1] || ""}`);
  linha("DESCRIÇÃO DO SERVIÇO", pega("xDescServ"));
  linha("VALOR DO SERVIÇO", `R$ ${pega("vServ")}`);
  linha("VALOR LÍQUIDO", `R$ ${pega("vLiq")}`);
  doc.setFontSize(8); doc.setTextColor(120, 120, 120);
  doc.text("Documento fiscal legalmente representado pelo XML assinado. Consulte pela chave de acesso em www.nfse.gov.br.", 12, 285);
  return new Uint8Array(doc.output("arraybuffer"));
}

async function enviarDocEvolution(supabase: any, phone: string, fileName: string, caption: string, pdf: Uint8Array) {
  const { data: cfgW } = await supabase.from("whatsapp_default_config")
    .select("setting_value").eq("setting_key", "default_instance").maybeSingle();
  const instanceName = cfgW?.setting_value;
  if (!instanceName) throw new Error("Instância de WhatsApp do financeiro não configurada");
  const { data: inst } = await supabase.from("whatsapp_instances")
    .select("api_url, api_key, instance_name").eq("instance_name", instanceName).maybeSingle();
  if (!inst?.api_url) throw new Error("Instância de WhatsApp não encontrada");
  const baseUrl = inst.api_url.replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
  const tel = phone.replace(/\D/g, "");
  const numero = tel.startsWith("55") ? tel : `55${tel}`;
  let b64 = "";
  for (let i = 0; i < pdf.length; i += 8192) b64 += String.fromCharCode(...pdf.subarray(i, i + 8192));
  b64 = btoa(b64);
  const r = await fetch(`${baseUrl}/message/sendMedia/${inst.instance_name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: inst.api_key },
    body: JSON.stringify({
      number: numero, mediatype: "document", mimetype: "application/pdf",
      media: b64, caption, fileName,
    }),
  });
  if (!r.ok) throw new Error(`WhatsApp recusou (${r.status}): ${(await r.text()).slice(0, 200)}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));

    // só staff logado emite
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await supabase.auth.getUser(token);
    let staff: any = null;
    if (user) {
      const { data } = await supabase.from("onboarding_staff")
        .select("id, role, is_active").eq("user_id", user.id).maybeSingle();
      staff = data;
    }
    const ehServidor = (() => {
      try { return JSON.parse(atob(token.split(".")[1] || "")).role === "service_role"; } catch { return false; }
    })();
    if (!ehServidor && (!staff?.is_active || !["master", "admin"].includes(staff.role))) {
      return json({ error: "Sem permissão para emitir nota." }, 403);
    }

    // consulta de nota já emitida (recuperação e conferência)
    if (body.action === "consultar") {
      const { data: cfgC } = await supabase.from("nfse_emitter_config").select("*").limit(1).maybeSingle();
      const { data: certC } = await supabase.from("fiscal_certificates")
        .select("file_path, senha_cifrada").eq("ativo", true).maybeSingle();
      if (!cfgC || !certC) return json({ error: "configuração ou certificado ausente" }, 400);
      const { data: arqC } = await supabase.storage.from("certificados").download(certC.file_path);
      const senhaC = await decifrar(certC.senha_cifrada);
      const abertoC = abrirPfx(bytesToB64(new Uint8Array(await arqC!.arrayBuffer())), senhaC);
      const amb = String(body.ambiente || cfgC.ambiente);
      let chave = body.chave_acesso as string | undefined;
      if (!chave && body.dps_numero) {
        const idDps = montarIdDps(cfgC.codigo_municipio, cfgC.cnpj, cfgC.serie, Number(body.dps_numero));
        const rD = await pontoGov(`/SefinNacional/dps/${idDps}`, "GET", undefined, abertoC.certPem, abertoC.keyPem, amb);
        let dD: any = {}; try { dD = JSON.parse(rD.corpo); } catch { /* segue */ }
        chave = dD.chaveAcesso;
        if (!chave) return json({ error: `DPS não encontrada no gov (HTTP ${rD.status})`, detalhe: rD.corpo.slice(0, 300) }, 404);
      }
      if (!chave) return json({ error: "informe chave_acesso ou dps_numero" }, 400);
      const rN = await pontoGov(`/SefinNacional/nfse/${chave}`, "GET", undefined, abertoC.certPem, abertoC.keyPem, amb);
      let dN: any = {}; try { dN = JSON.parse(rN.corpo); } catch { dN = { bruto: rN.corpo.slice(0, 400) }; }
      return json({ ok: rN.status < 300, status: rN.status, chave_acesso: chave, nota: dN });
    }

    // DANFSe: o PDF oficial da nota, direto do gov
    if (body.action === "danfse") {
      if (!body.chave_acesso) return json({ error: "informe chave_acesso" }, 400);
      const { data: cfgD } = await supabase.from("nfse_emitter_config").select("*").limit(1).maybeSingle();
      const { data: certD } = await supabase.from("fiscal_certificates")
        .select("file_path, senha_cifrada").eq("ativo", true).maybeSingle();
      if (!cfgD || !certD) return json({ error: "configuração ou certificado ausente" }, 400);
      const { data: arqD } = await supabase.storage.from("certificados").download(certD.file_path);
      const senhaD = await decifrar(certD.senha_cifrada);
      const abertoD = abrirPfx(bytesToB64(new Uint8Array(await arqD!.arrayBuffer())), senhaD);
      const amb = String(body.ambiente || cfgD.ambiente);
      const hostAdn = amb === "2" ? "adn.producaorestrita.nfse.gov.br" : "adn.nfse.gov.br";
      const url = Deno.env.get("NFSE_BRIDGE_URL"), token = Deno.env.get("NFSE_BRIDGE_TOKEN");
      let pdfB64: string | null = null;
      for (let tent = 0; tent < 2 && !pdfB64; tent++) {
        try {
          const r = await fetch(`${url}/gov`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-bridge-token": token! },
            body: JSON.stringify({ host: hostAdn, path: `/danfse/${body.chave_acesso}`, metodo: "GET",
              cert_pem: abertoD.certPem, key_pem: abertoD.keyPem }),
          });
          const d = await r.json();
          if (d?.status < 300 && d?.corpo_base64) pdfB64 = d.corpo_base64;
        } catch { /* tenta de novo */ }
      }
      if (pdfB64) return json({ ok: true, pdf_base64: pdfB64, fonte: "gov" });

      // gov fora do ar: espelho a partir do XML guardado (o XML é o documento legal)
      const { data: reg } = await supabase.from("nfse_records")
        .select("xml_nfse").eq("chave_acesso", body.chave_acesso).maybeSingle();
      if (!reg?.xml_nfse) return json({ error: "O serviço de PDF do gov está fora do ar e não tenho o XML desta nota guardado. Tente mais tarde." }, 503);
      const xml = await gunzipB64(reg.xml_nfse);
      const pdf = await gerarEspelho(xml, body.chave_acesso);
      let b64 = "";
      for (let i = 0; i < pdf.length; i += 8192) b64 += String.fromCharCode(...pdf.subarray(i, i + 8192));
      return json({ ok: true, pdf_base64: btoa(b64), fonte: "espelho" });
    }

    // envia a nota por WhatsApp pro cliente (PDF oficial; espelho se o gov cair)
    if (body.action === "enviar-whatsapp") {
      const { chave_acesso, phone, tomador_nome, numero_nota } = body;
      if (!chave_acesso || !phone) return json({ error: "informe chave_acesso e phone" }, 400);
      const respPdf = await (await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/nfse-emitir`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ action: "danfse", chave_acesso, ambiente: body.ambiente }),
      })).json();
      if (!respPdf?.pdf_base64) return json({ error: respPdf?.error || "não consegui obter o PDF" }, 502);
      const pdf = b64ToBytes(respPdf.pdf_base64);
      const legenda = `📄 *Nota Fiscal de Serviço*\n\nOlá ${tomador_nome || "cliente"}, segue sua NFS-e${numero_nota ? ` nº ${numero_nota}` : ""} em anexo.`;
      await enviarDocEvolution(supabase, phone, `NFS-e${numero_nota ? `-${numero_nota}` : ""}.pdf`, legenda, pdf);
      return json({ ok: true, fonte: respPdf.fonte });
    }

    const { data: cfg } = await supabase.from("nfse_emitter_config").select("*").limit(1).maybeSingle();
    if (!cfg) return json({ error: "Configure os dados fiscais da empresa antes de emitir." }, 400);
    if (!cfg.codigo_servico && !body.codigo_servico) {
      return json({ error: "Informe o código do serviço (item da lista) na configuração." }, 400);
    }

    const { data: cert } = await supabase.from("fiscal_certificates")
      .select("file_path, senha_cifrada").eq("ativo", true).maybeSingle();
    if (!cert) return json({ error: "Nenhum certificado digital enviado." }, 400);
    const { data: arq } = await supabase.storage.from("certificados").download(cert.file_path);
    if (!arq) return json({ error: "Não achei o arquivo do certificado." }, 400);
    const senha = await decifrar(cert.senha_cifrada);
    const { cert: certObj, key, certPem, keyPem } = abrirPfx(bytesToB64(new Uint8Array(await arq.arrayBuffer())), senha);

    const ambiente = body.ambiente || cfg.ambiente;   // teste pode forçar homologação
    cfg.ambiente = ambiente;
    const numero = body.numero || cfg.proximo_numero;

    const montarEnviar = async (semIM: boolean) => {
      const { idDps, infDps } = montarDps(cfg, body, numero, semIM);
      const assinatura = assinar(infDps, idDps, certObj, key);
      const xml = `<?xml version="1.0" encoding="UTF-8"?><DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">${infDps}${assinatura}</DPS>`;
      if (body.dry_run) return { dry: { idDps, xml } };
      const resp = await pontoGov("/SefinNacional/nfse", "POST",
        JSON.stringify({ dpsXmlGZipB64: await gzipB64(xml) }), certPem, keyPem, String(cfg.ambiente));
      let retorno: any = {};
      try { retorno = JSON.parse(resp.corpo); } catch { retorno = { bruto: resp.corpo.slice(0, 800) }; }
      return { resp, retorno, idDps };
    };

    let r = await montarEnviar(false);
    if ((r as any).dry) {
      const { idDps, xml } = (r as any).dry;
      return json({ ok: true, dry_run: true, idDps, xml_tamanho: xml.length, xml: body.mostrar_xml ? xml : undefined });
    }
    // E0120: o município não usa inscrição municipal no cadastro nacional —
    // reenvia sem o campo em vez de devolver o erro pro usuário
    let { resp, retorno, idDps } = r as any;
    const codigos = (retorno?.erros || []).map((e: any) => e.Codigo || e.codigo);
    if (resp.status >= 400 && codigos.includes("E0120")) {
      ({ resp, retorno, idDps } = await montarEnviar(true) as any);
    }

    if (resp.status < 200 || resp.status >= 300) {
      return json({
        error: (Array.isArray(retorno?.erros) && retorno.erros.length
            ? retorno.erros.map((e: any) => [e.Codigo || e.codigo, e.Descricao || e.descricao || e.mensagem].filter(Boolean).join(" - ")).join(" | ")
            : null) || retorno?.mensagem || retorno?.message ||
          (Array.isArray(retorno?.erros) ? retorno.erros.map((e: any) => e.Descricao || e.descricao || JSON.stringify(e)).join(" | ") : null) ||
          `O gov recusou (HTTP ${resp.status}).`,
        detalhe: retorno, idDps,
      }, 400);
    }

    // sucesso: guarda a nota e avança o numerador (não pode falhar em silêncio:
    // foi assim que uma nota real emitida sumiu da tela)
    if (!body.numero) {
      await supabase.from("nfse_emitter_config").update({ proximo_numero: numero + 1 }).eq("id", cfg.id);
    }
    const { data: salvo, error: insErr } = await supabase.from("nfse_records").insert({
      company_id: body.company_id ?? null,
      invoice_id: body.invoice_id ?? null,
      service_description: body.descricao,
      amount_cents: Math.round(Number(body.valor) * 100),
      tomador_name: body.tomador?.nome ?? null,
      tomador_document: so(body.tomador?.documento) || null,
      tomador_email: body.tomador?.email ?? null,
      status: "issued",
      environment: String(cfg.ambiente),
      number: String(numero),
      chave_acesso: retorno.chaveAcesso ?? null,
      dps_numero: numero,
      xml_nfse: retorno.nfseXmlGZipB64 ?? null,
      origem: "gov",
      issued_at: new Date().toISOString(),
    }).select("id").maybeSingle();
    if (insErr) {
      console.error("[nfse-emitir] nota emitida mas nao gravada:", insErr.message);
      return json({
        ok: true, chave_acesso: retorno.chaveAcesso, idDps, ambiente: cfg.ambiente,
        aviso: "A nota foi emitida no gov, mas não consegui gravar no sistema: " + insErr.message,
      });
    }
    return json({ ok: true, chave_acesso: retorno.chaveAcesso, idDps, registro_id: salvo?.id, ambiente: cfg.ambiente });
  } catch (e) {
    console.error("[nfse-emitir]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
