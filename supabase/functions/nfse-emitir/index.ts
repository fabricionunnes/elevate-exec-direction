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

// Espelho da NFS-e (DANFSe simplificado) gerado do XML do Emissor Nacional, no padrão visual do Nexus.
// 04/11/2026, Fabrício: "sobre a nota fiscal no menu financeiro, consegue melhorar o design? Está muito ruim".
const LOGO_UNV_B64 = "iVBORw0KGgoAAAANSUhEUgAAAyAAAAMgCAIAAABUEpE/AAAACXBIWXMAAA7EAAAOxAGVKw4bAAABZGlDQ1BJQ0NCYXNlZChSR0IsR29vZ2xlL1NraWEvN0M1RkEyMTUxMzk3NDc0QTA0ODZCQkNDODM3MzNENTkpAAB4nH2QvUrDYBSGH2tBFMVBhw4OGRxc1P5of8ClrVhcW4VWpzRNi9ifkKboBejm4OomLt6A6GUoCA7i4CWIoLNvGiQFqefw5nt485Iv50Akhioah07Xc8ulglGtHRhT70yoh2VafYfxpdT3S5B9Xv0nN66mG3bf0vkhea4u1ycb4sVWwKc+1wO+8PnEczzxtc/uXrkovhOvtEa4PsKW4/r5N/FWpz2wwv9m1u7uV3RWpSVK9NQt2tisU+GYI0xRhiKb7JAnSUKUIEVO7sZQeeJ6ZklTUBfVWb3PSCm2lc75+wyu7N1A9gsmL0OvfgUP5xB7Db1lzTZ/BvePoRfu2DFdc2hFpUizCZ+3MFeDhSeYOfxd7JhZjT+zGuzSxWJNlNQ0CdI/hc1LvY60eocAANDwSURBVHic7N0FXBQJ/8fxvxfP8xxle+qp53VICNhdp7C0AoIYYICBnZgodmCLiZ1gd7fYjYiCSHfn9v+3uzAuWyw6iKff92tevhRmpxadjzOzM/8nBgAAAABW/V9lLwAAAADA5waBBQAAAMAyBBYAAAAAyxBYAAAAACxDYAEAAACwDIEFAAAAwDIEFgAAAADLEFgAAAAALENgAQAAALAMgQUAAADAMgQWAAAAAMsQWAAAAAAsQ2ABAAAAsAyBBQAAAMAyBBYAAAAAyxBYAAAAACxDYAEAAACwDIEFAAAAwDIEFgAAAADLEFgAAAAALENgAQAAALAMgQUAAADAMgQWAAAAAMsQWAAAAAAsQ2ABAAAAsAyBBQAAAMAyBBYAAAAAyxBYAAAAACxDYAEAAACwDIEFAAAAwDIEFgAAAADLEFgAAAAALENgAQAAALAMgQUAAADAMgQWAAAAAMsQWAAAAAAsQ2ABAAAAsAyBBQAAAMAyBBYAAAAAyxBYAAAAACxDYAEAAACwDIEFAAAAwDIEFgAAAADLEFgAAAAALENgAQAAALAMgQUAAADAMgQWAAAAAMsQWAAAAAAsQ2ABAAAAsAyBBQAAAMAyBBYAAAAAyxBYAAAAACxDYAEAAACwDIEFAAAAwDIEFgAAAADLEFgAAAAALENgAQAAALAMgQUAAADAMgQWAAAAAMsQWAAAAAAsQ2ABAAAAsAyBBQAAAMAyBBYAAAAAyxBYAAAAACxDYAEAAACwDIEFAAAAwDIEFgAAAADLEFgAAAAALENgAQAAALAMgQUAAADAMgQWAAAAAMsQWAAAAAAsQ2ABAAAAsAyBBQAAAMAyBBYAAAAAyxBYAAAAACxDYAEAAACwDIEFAAAAwDIEFgAAAADLEFgAAAAALENgAQAAALAMgQUAAADAMgQWAAAAAMsQWAAAAAAsQ2ABAAAAsAyBBQAAAMAyBBYAAAAAyxBYAAAAACxDYAEAAACwDIEFAAAAwDIEFgAAAADLEFgAAAAALENgAQAAALAMgQUAAADAMgQWAAAAAMsQWAAAAAAsQ2ABAAAAsAyBBQAAAMAyBBYAAAAAyxBYAAAAACxDYAEAAACwDIEFAAAAwDIEFgAAAADLEFgAAAAALENgAQAAALAMgQUAAADAMgQWAAAAAMsQWAAAAAAsQ2ABAAAAsAyBBQAAAMAyBBYAAAAAyxBYAAAAACxDYAEAAACwDIEFAAAAwDIEFgAAAADLEFgAAAAALENgAQAAALAMgQUAAADAMgQWAAAAAMsQWAAAAAAsQ2ABAAAAsAyBBQAAAMAyBBYAAAAAyxBYAAAAACxDYAEAAACwDIEFAAAAwDIEFgAAAADLEFgAAAAALENgAQAAALAMgQUAAADAMgQWAAAAAMsQWAAAAAAsQ2ABAAAAsAyBBQAAAMAyBBYAAAAAyxBYAAAAACxDYAEAAACwDIEFAAAAwDIEFgAAAADLEFgAAAAALENgAQAAALAMgQUAAADAMgQWAAAAAMsQWAAAAAAsQ2ABAAAAsAyBBQAAAMAyBBYAAAAAyxBYAAAAACxDYAEAAACwDIEFAAAAwDIEFgAAAADLEFgAAAAALENgAQAAALAMgQUAAADAMgQWAAAAAMsQWAAAAAAsQ2ABAAAAsAyBBQAAAMAyBBYAAAAAyxBYAAAAACxDYAEAAACwDIEFAAAAwDIEFgAAAADLEFgAAAAALENgAQAAALAMgQUAAADAMgQWAAAAAMsQWAAAAAAsQ2ABAAAAsAyBBQAAAMAyBBYAAAAAyxBYAAAAACxDYAEAAACwDIEFAAAAwDIEFgAAAADLEFgAAAAALENgAQAA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gGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGAEFgAAgGD/D9D/oDV+AeMtAAAAAElFTkSuQmCC";

/** espelho da NFS-e gerado do XML — usado quando o serviço de PDF do gov cai
 *  (instabilidade crônica conhecida). O documento legal é o XML. */
async function gerarEspelho(xml: string, chave: string, logoB64: string = LOGO_UNV_B64): Promise<Uint8Array> {
  const { jsPDF } = await import("https://esm.sh/jspdf@2.5.2");
  const g = (tag: string, src = xml) => (src.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`)) || [])[1]?.trim() || "";
  const bloco = (tag: string) => (xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>`)) || [""])[0];
  const emit = bloco("emit"), toma = bloco("toma"), ender = bloco("enderNac");
  const num = (v: string) => Number(String(v || "0").replace(",", ".")) || 0;
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const doc2 = (d: string) => { const s = (d || "").replace(/\D/g, ""); return s.length === 14 ? s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : s.length === 11 ? s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : d; };
  const cep = (c: string) => (c || "").replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2");
  const fone = (f: string) => { const s = (f || "").replace(/\D/g, ""); return s.length === 10 ? s.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3") : s.length === 11 ? s.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") : f; };
  const dataHora = (iso: string) => { const m = (iso || "").match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : iso; };
  const data = (iso: string) => { const m = (iso || "").match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; };
  const chaveFmt = (chave || "").replace(/(\d{4})(?=\d)/g, "$1 ");

  const nNFSe = g("nNFSe"), serie = g("serie"), nDPS = g("nDPS"), dhProc = g("dhProc"), dCompet = g("dCompet");
  const prestNome = g("xNome", emit), prestDoc = g("CNPJ", emit), prestEmail = g("email", emit), prestFone = g("fone", emit);
  const prestEnd = [g("xLgr", ender), g("nro", ender)].filter(Boolean).join(", ") + (g("xBairro", ender) ? ` · ${g("xBairro", ender)}` : "");
  const prestCidade = `${g("xLocEmi")}/${g("UF", ender)}` + (g("CEP", ender) ? ` · CEP ${cep(g("CEP", ender))}` : "");
  const tomaNome = g("xNome", toma), tomaDoc = g("CNPJ", toma) || g("CPF", toma), tomaEmail = g("email", toma);
  const descServ = g("xDescServ"), cTrib = g("cTribNac"), xTrib = g("xTribNac"), cNBS = g("cNBS"), xNBS = g("xNBS");
  const locPrest = g("xLocPrestacao") || g("xLocIncid");
  const vServ = num(g("vServ")), vLiq = num(g("vLiq")) || vServ, vDesc = num(g("vDescIncond")) + num(g("vDescCond")), vISS = num(g("vISSQN"));
  const pAliq = num(g("pAliq")), bc = num(g("vBC")) || vServ;
  const opSN = g("opSimpNac"), regime = opSN === "2" ? "Simples Nacional (MEI)" : opSN === "3" ? "Simples Nacional (ME/EPP)" : opSN === "1" ? "Não optante pelo Simples Nacional" : "";
  const retISS = g("tpRetISSQN") === "2" ? "ISS retido pelo tomador" : "ISS não retido";
  const tribISS = g("tribISSQN") === "1" ? "Operação tributável" : g("tribISSQN") === "2" ? "Imunidade" : g("tribISSQN") === "3" ? "Exportação de serviço" : g("tribISSQN") === "4" ? "Não incidência" : "";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const NAVY: [number, number, number] = [13, 43, 94], RED: [number, number, number] = [204, 27, 27];
  const CINZA: [number, number, number] = [110, 110, 110], LINHA: [number, number, number] = [215, 220, 228], FUNDO: [number, number, number] = [245, 247, 250];
  const W = 210, M = 14, CW = W - 2 * M;
  const setF = (size: number, style: "normal" | "bold" = "normal", cor: [number, number, number] = [30, 30, 30]) => { doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...cor); };

  // ── cabeçalho ──
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 34, "F");
  doc.setFillColor(...RED); doc.rect(0, 34, W, 1.2, "F");
  try { if (logoB64) doc.addImage(`data:image/png;base64,${logoB64}`, "PNG", M, 7, 20, 20); } catch (_) { /* sem logo */ }
  setF(18, "bold", [255, 255, 255]); doc.text("NFS-e", M + 25, 15);
  setF(10, "normal", [220, 228, 240]); doc.text("Nota Fiscal de Serviço Eletrônica · Padrão Nacional", M + 25, 21);
  setF(8, "normal", [180, 195, 220]); doc.text("Documento auxiliar da NFS-e. O documento fiscal é o XML assinado.", M + 25, 27);
  // caixa número/série à direita
  doc.setFillColor(255, 255, 255); doc.roundedRect(W - M - 50, 7, 50, 20, 2, 2, "F");
  setF(7, "bold", CINZA); doc.text("NÚMERO", W - M - 46, 12); doc.text("SÉRIE", W - M - 18, 12);
  setF(14, "bold", NAVY); doc.text(nNFSe || "-", W - M - 46, 19); setF(12, "bold", NAVY); doc.text(serie || "-", W - M - 18, 19);
  setF(7, "normal", CINZA); doc.text(`Emitida em ${dataHora(dhProc)}`, W - M - 46, 24.5);

  let y = 42;
  // ── chave de acesso ──
  doc.setFillColor(...FUNDO); doc.roundedRect(M, y, CW, 13, 1.5, 1.5, "F");
  setF(7, "bold", CINZA); doc.text("CHAVE DE ACESSO", M + 4, y + 4.5);
  setF(10.5, "normal", [30, 30, 30]); doc.setFont("courier", "bold"); doc.text(chaveFmt, M + 4, y + 10);
  y += 19;

  // ── prestador / tomador ──
  const colW = (CW - 6) / 2;
  // altura da caixa = o que o conteúdo precisa (mede antes de desenhar)
  const alturaDe = (linhas: [string, string][]) => { setF(8.5); return 11 + linhas.filter(([, v]) => v).reduce((a, [, v]) => a + 4.5 + doc.splitTextToSize(v, colW - 6).length * 3.8, 0); };
  const caixa = (x: number, titulo: string, linhas: [string, string][], altura: number) => {
    doc.setDrawColor(...LINHA); doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, colW, altura, 1.5, 1.5, "S");
    doc.setFillColor(...NAVY); doc.rect(x, y, colW, 6, "F"); doc.roundedRect(x, y, colW, 6, 1.5, 1.5, "F");
    setF(7.5, "bold", [255, 255, 255]); doc.text(titulo, x + 3, y + 4.2);
    let yy = y + 11;
    for (const [rot, val] of linhas) {
      if (!val) continue;
      setF(6.5, "bold", CINZA); doc.text(rot.toUpperCase(), x + 3, yy);
      setF(8.5, "normal", [30, 30, 30]);
      const q = doc.splitTextToSize(val, colW - 6);
      doc.text(q, x + 3, yy + 3.6);
      yy += 4.5 + q.length * 3.8;
    }
  };
  const prestLinhas: [string, string][] = [["Razão social", prestNome], ["CNPJ", doc2(prestDoc)], ["Endereço", prestEnd], ["Município", prestCidade], ["Contato", [prestEmail.toLowerCase(), fone(prestFone)].filter(Boolean).join(" · ")], ["Regime tributário", regime]];
  const tomaLinhas: [string, string][] = [["Nome / Razão social", tomaNome], [tomaDoc.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ", doc2(tomaDoc)], ["E-mail", tomaEmail.toLowerCase()]];
  const alturaCaixa = Math.max(alturaDe(prestLinhas), alturaDe(tomaLinhas)) + 2;
  caixa(M, "PRESTADOR DO SERVIÇO", prestLinhas, alturaCaixa);
  caixa(M + colW + 6, "TOMADOR DO SERVIÇO", tomaLinhas, alturaCaixa);
  y += alturaCaixa + 7;

  // ── serviço ──
  doc.setFillColor(...NAVY); doc.roundedRect(M, y, CW, 6, 1.5, 1.5, "F"); doc.rect(M, y + 3, CW, 3, "F");
  setF(7.5, "bold", [255, 255, 255]); doc.text("DISCRIMINAÇÃO DO SERVIÇO", M + 3, y + 4.2);
  y += 10;
  setF(10, "bold", [30, 30, 30]);
  const descQ = doc.splitTextToSize(descServ || "-", CW - 6);
  doc.text(descQ, M + 3, y); y += descQ.length * 4.6 + 2;
  const campo = (x: number, rot: string, val: string, w: number) => {
    setF(6.5, "bold", CINZA); doc.text(rot.toUpperCase(), x, y);
    setF(8.5, "normal", [30, 30, 30]); const q = doc.splitTextToSize(val || "-", w); doc.text(q, x, y + 3.6); return q.length;
  };
  const c3 = CW / 3;
  let n1 = campo(M + 3, "Competência", data(dCompet), c3 - 6);
  let n2 = campo(M + 3 + c3, "Local da prestação", locPrest, c3 - 6);
  let n3 = campo(M + 3 + 2 * c3, "DPS", nDPS ? `nº ${nDPS}${serie ? ` · série ${serie}` : ""}` : "", c3 - 6);
  y += 4.5 + Math.max(n1, n2, n3) * 3.8 + 1;
  n1 = campo(M + 3, "Código de tributação nacional", cTrib ? `${cTrib}${xTrib ? ` · ${xTrib}` : ""}` : "", CW - 6);
  y += 4.5 + n1 * 3.8 + 1;
  n1 = campo(M + 3, "Código NBS", cNBS ? `${cNBS}${xNBS ? ` · ${xNBS}` : ""}` : "", CW - 6);
  y += 4.5 + n1 * 3.8 + 1;
  n1 = campo(M + 3, "ISSQN", [tribISS, retISS, pAliq ? `alíquota ${pAliq.toLocaleString("pt-BR")}%` : ""].filter(Boolean).join(" · "), CW - 6);
  y += 4.5 + n1 * 3.8 + 4;

  // ── valores ──
  doc.setDrawColor(...LINHA); doc.line(M, y, M + CW, y); y += 5;
  const valores: [string, number][] = [["Valor do serviço", vServ], ["Descontos", vDesc], ["Base de cálculo", bc], ["ISS", vISS]];
  const vx = M + CW - 70;
  for (const [rot, v] of valores) {
    setF(8.5, "normal", CINZA); doc.text(rot, vx, y, { align: "left" });
    setF(8.5, "normal", [30, 30, 30]); doc.text(brl(v), M + CW - 3, y, { align: "right" });
    y += 5.5;
  }
  doc.setFillColor(...FUNDO); doc.roundedRect(vx - 30, y - 2, 100, 12, 1.5, 1.5, "F");
  setF(8, "bold", NAVY); doc.text("VALOR LÍQUIDO DA NOTA", vx - 26, y + 5.5);
  setF(14, "bold", NAVY); doc.text(brl(vLiq), M + CW - 3, y + 6, { align: "right" });
  y += 16;

  // ── rodapé ──
  doc.setDrawColor(...LINHA); doc.line(M, 276, M + CW, 276);
  setF(7, "normal", CINZA);
  doc.text("Consulte a autenticidade desta NFS-e em www.nfse.gov.br/consulta pela chave de acesso acima.", M, 281);
  doc.text(`Espelho gerado pelo UNV Nexus a partir do XML autorizado pelo Emissor Nacional (${g("verAplic")}). Emissão: ${dataHora(dhProc)}.`, M, 285.5);
  doc.text("UNV Holdings · unvholdings.com.br", M, 290);
  return new Uint8Array(doc.output("arraybuffer"));
}

// ─────────────────────────────────────────────────────────────────────────────
// DANFSe v2.0 no padrão nacional (Nota Técnica SE/CGNFS-e nº 008, versão 1.02, de 14/07/2026).
// A API do gov que devolvia o PDF (adn.nfse.gov.br/danfse) foi suspensa em 03/08/2026: desde então quem
// gera o DANFSe é o sistema emissor, a partir do XML autorizado, seguindo o modelo do Anexo I.
// Fabrício, 12/11/2026: "a NF oficial do site do gov não está baixando".
// Regras da NT seguidas aqui: A4 retrato, página única, borda de 1 pt, linhas de 0,5 pt, sombreamento de 5%
// no cabeçalho, nos títulos dos blocos e nos campos "Emitente" e "Valor líquido + IBS/CBS"; título de bloco
// 7 pt negrito em maiúsculas; título de campo 6 pt negrito; conteúdo 7 pt; QR Code da consulta pública;
// campo sem informação no XML sai com traço; nada que não esteja no XML é impresso.
// Medidas em centímetros, como na tabela 2.4.5 da NT. Fonte: Helvetica (equivalente métrica da Arial).
// ─────────────────────────────────────────────────────────────────────────────
const UF_IBGE: Record<string, string> = { "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF" };

type DanfseOpts = {
  jsPDF: any;                       // construtor do jsPDF
  QRCode: any;                      // biblioteca "qrcode" (usa QRCode.create)
  logoNfseB64: string;              // logomarca oficial da NFS-e (PNG, base64)
  situacao?: "cancelada" | "substituida" | null;   // marca d'água
  nomeMunicipio?: (cod: string) => Promise<string | null>;   // nome do município pelo código do IBGE
};

async function gerarDanfse(xml: string, o: DanfseOpts): Promise<Uint8Array> {
  // ── leitura do XML ──
  const semAss = xml.replace(/<Signature[\s\S]*?<\/Signature>/g, "");
  const blocoDe = (tag: string, src: string) => (src.match(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>`)) || [""])[0];
  const des = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const g = (tag: string, src: string) => des(((src.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`)) || [])[1] || "").trim());
  const dps = blocoDe("DPS", semAss);
  const inf = dps ? semAss.replace(dps, "") : semAss;          // infNFSe sem a DPS (campos calculados pelo fisco)
  const emit = blocoDe("emit", inf), valN = blocoDe("valores", inf), ibsN = blocoDe("IBSCBS", inf);
  const prest = blocoDe("prest", dps), toma = blocoDe("toma", dps), interm = blocoDe("interm", dps);
  const serv = blocoDe("serv", dps), valD = blocoDe("valores", dps), ibsD = blocoDe("IBSCBS", dps);
  const destB = blocoDe("dest", ibsD);
  const tribMun = blocoDe("tribMun", valD), tribFed = blocoDe("tribFed", valD), pisc = blocoDe("piscofins", tribFed), totTrib = blocoDe("totTrib", valD);
  const chave = ((semAss.match(/<infNFSe[^>]*\sId="NFS(\d+)"/) || [])[1] || "").trim();

  // ── formatação ──
  const T = "-";
  const v = (s: string) => (s && s.trim() ? s.trim() : T);
  const corta = (s: string, max: number) => (s.length > max ? s.slice(0, max) + "..." : s);
  const num = (s: string) => (s === "" || s == null ? null : Number(String(s).replace(",", ".")));
  const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rs = (s: string) => { const n = num(s); return n == null || Number.isNaN(n) ? T : `R$ ${fmt(n)}`; };
  const pct = (s: string) => { const n = num(s); return n == null || Number.isNaN(n) ? T : `${fmt(n)} %`; };
  const docF = (b: string) => {
    const c = g("CNPJ", b), p = g("CPF", b), n = g("NIF", b);
    if (c) return c.length === 14 ? c.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, "$1.$2.$3/$4-$5") : c;
    if (p) return p.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    return n || T;
  };
  const cepF = (c: string) => { const s = c.replace(/\D/g, ""); return s.length === 8 ? s.replace(/^(\d{2})(\d{3})(\d{3})$/, "$1.$2-$3") : c; };
  const foneF = (f: string) => { const s = f.replace(/\D/g, ""); return s.length === 10 ? s.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3") : s.length === 11 ? s.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3") : f; };
  const dataF = (iso: string) => { const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : v(iso); };
  const dataHoraF = (iso: string) => { const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]}` : v(iso); };
  const ufDe = (cMun: string) => UF_IBGE[String(cMun || "").slice(0, 2)] || "";

  // nome do município pelo código: primeiro o que o próprio XML traz, depois a consulta externa
  const nomesXml: Record<string, string> = {};
  const guarda = (cod: string, nome: string) => { if (cod && nome) nomesXml[cod] = nome; };
  guarda(g("cLocEmi", dps), g("xLocEmi", inf));
  guarda(g("cLocPrestacao", serv), g("xLocPrestacao", inf));
  guarda(g("cLocIncid", inf), g("xLocIncid", inf));
  guarda(g("cLocalidadeIncid", ibsN), g("xLocalidadeIncid", ibsN));
  const nomeMun = async (cod: string) => {
    if (!cod) return "";
    if (nomesXml[cod]) return nomesXml[cod];
    try { const n = o.nomeMunicipio ? await o.nomeMunicipio(cod) : null; if (n) { nomesXml[cod] = n; return n; } } catch { /* segue sem o nome */ }
    return "";
  };
  const munUf = async (cod: string, cidadeExt = "") => {
    if (!cod) return v(cidadeExt);
    const n = await nomeMun(cod), uf = ufDe(cod);
    return n ? `${n} / ${uf}` : uf ? `${T} / ${uf}` : T;
  };

  // pessoa (prestador, tomador, destinatário, intermediário) no formato dos blocos do DANFSe
  const pessoa = async (b: string, reserva = "") => {
    const pega = (tag: string) => g(tag, b) || (reserva ? g(tag, reserva) : "");
    const end = blocoDe("end", b) || blocoDe("enderNac", b) || (reserva ? blocoDe("enderNac", reserva) || blocoDe("end", reserva) : "");
    const cMun = g("cMun", end), cepV = g("CEP", end) || g("cEndPost", end);
    const partes = [g("xLgr", end), g("nro", end), g("xCpl", end), g("xBairro", end)].filter(Boolean);
    return {
      doc: docF(b) !== T ? docF(b) : (reserva ? docF(reserva) : T),
      im: v(pega("IM")),
      fone: v(foneF(pega("fone"))),
      nome: v(corta(pega("xNome"), 77)),
      mun: await munUf(cMun, g("xCidade", end)),
      ibgeCep: cMun || cepV ? `${cMun || T} / ${cepV ? cepF(cepV) : T}` : T,
      endereco: partes.length ? corta(partes.join(", "), 77) : T,
      email: v(corta(pega("email"), 77)),
    };
  };

  // ── descrições dos códigos do leiaute ──
  const tpAmb = g("tpAmb", dps);
  const AMB_GER: Record<string, string> = { "1": "Prefeitura", "2": "Sistema Nacional da NFS-e" };
  const TP_AMB: Record<string, string> = { "1": "Produção", "2": "Homologação" };
  const TP_EMIT: Record<string, string> = { "1": "Prestador", "2": "Tomador", "3": "Intermediário" };
  const C_STAT: Record<string, string> = { "100": "NFS-e Gerada", "101": "NFS-e de Substituição Gerada", "102": "NFS-e de Decisão Judicial ou Administrativa", "103": "NFS-e Avulsa" };
  const FIN: Record<string, string> = { "0": "NFS-e regular" };
  const OP_SN: Record<string, string> = { "1": "Não Optante", "2": "Optante - Microempreendedor Individual (MEI)", "3": "Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)" };
  const REG_AP_SN: Record<string, string> = {
    "1": "Regime de apuração dos tributos federais e municipal pelo Simples Nacional",
    "2": "Regime de apuração dos tributos federais pelo SN e o ISSQN pela NFS-e conforme respectiva legislação municipal do tributo",
    "3": "Regime de apuração dos tributos federais e municipal pela NFS-e conforme respectivas legislações federal e municipal de cada tributo",
  };
  const TRIB_ISSQN: Record<string, string> = { "1": "Operação Tributável", "2": "Imunidade", "3": "Exportação de Serviço", "4": "Não Incidência" };
  const RET_ISSQN: Record<string, string> = { "1": "Não Retido", "2": "Retido pelo Tomador", "3": "Retido pelo Intermediário" };
  const REG_ESP: Record<string, string> = { "0": "Nenhum", "1": "Ato Cooperado (Cooperativa)", "2": "Estimativa", "3": "Microempresa Municipal", "4": "Notário ou Registrador", "5": "Profissional Autônomo", "6": "Sociedade de Profissionais", "9": "Outros" };
  const IMUN: Record<string, string> = {
    "0": "Imunidade (tipo não informado na nota de origem)", "1": "Patrimônio, renda ou serviços, uns dos outros",
    "2": "Entidades religiosas e templos de qualquer culto", "3": "Patrimônio, renda ou serviços dos partidos políticos e entidades sem fins lucrativos",
    "4": "Livros, jornais, periódicos e o papel destinado a sua impressão", "5": "Fonogramas e videofonogramas musicais produzidos no Brasil",
  };
  const SUSP: Record<string, string> = { "1": "Exigibilidade Suspensa por Decisão Judicial", "2": "Exigibilidade Suspensa por Processo Administrativo" };
  const RET_PISCOFINS: Record<string, string> = {
    "0": "PIS/COFINS/CSLL Não Retidos", "1": "PIS/COFINS Retido", "2": "PIS/COFINS Não Retido", "3": "PIS/COFINS/CSLL Retidos",
    "4": "PIS/COFINS Retidos, CSLL Não Retido", "5": "PIS Retido, COFINS/CSLL Não Retido", "6": "COFINS Retido, PIS/CSLL Não Retido",
    "7": "PIS Não Retido, COFINS/CSLL Retidos", "8": "PIS/COFINS Não Retidos, CSLL Retido", "9": "COFINS Não Retido, PIS/CSLL Retidos",
  };
  const cod = (mapa: Record<string, string>, c: string, max = 0) => (c === "" ? T : max ? corta(mapa[c] || c, max) : (mapa[c] || c));

  // ── valores ──
  const vServ = g("vServ", valD);
  const descInc = g("vDescIncond", valD), descCond = g("vDescCond", valD);
  const retPisCofins = g("tpRetPisCofins", pisc) === "1";
  const soma = (...xs: string[]) => { const ns = xs.map(num).filter((n): n is number => n != null && !Number.isNaN(n)); return ns.length ? String(ns.reduce((a, b) => a + b, 0)) : ""; };
  const contribRet = retPisCofins ? soma(g("vRetCSLL", tribFed), g("vPis", pisc), g("vCofins", pisc)) : g("vRetCSLL", tribFed);
  const ibsMun = blocoDe("mun", blocoDe("valores", ibsN)), ibsUf = blocoDe("uf", blocoDe("valores", ibsN)), ibsFed = blocoDe("fed", blocoDe("valores", ibsN));
  const totCibs = blocoDe("totCIBS", ibsN);
  const temIbs = !!ibsN || !!ibsD;
  const tresPct = (...xs: string[]) => (xs.some(Boolean) ? xs.map(pct).join(" / ") : T);

  // ── documento ──
  const doc = new o.jsPDF({ unit: "cm", format: "a4", orientation: "portrait", compress: true });
  const X0 = 0.30, W = 20.40, XF = X0 + W, YF = 29.40;
  const COL = [0.30, 5.41, 10.51, 15.62], CW = 5.09, PAD = 0.10;
  const PT = 0.0352778;                                  // 1 ponto em cm
  const CINZA5: [number, number, number] = [242, 242, 242];
  const fonte = (tam: number, negrito = false) => { doc.setFont("helvetica", negrito ? "bold" : "normal"); doc.setFontSize(tam); doc.setTextColor(0, 0, 0); };
  const linhaH = (y: number, x1 = X0, x2 = XF) => { doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5 * PT); doc.line(x1, y, x2, y); };
  const sombra = (x: number, y: number, w: number, h: number) => { doc.setFillColor(...CINZA5); doc.rect(x, y, w, h, "F"); };
  const cabe = (txt: string, larg: number, tam: number, negrito = false) => {
    fonte(tam, negrito);
    if (doc.getTextWidth(txt) <= larg) return txt;
    let t = txt;
    while (t.length > 1 && doc.getTextWidth(t + "...") > larg) t = t.slice(0, -1);
    return t + "...";
  };
  /** campo comum: título em 6 pt negrito e conteúdo em 7 pt logo abaixo */
  const campo = (rotulo: string, valor: string, x: number, y: number, larg = CW) => {
    fonte(6, true); doc.text(rotulo, x + PAD, y + 0.22);
    doc.text(cabe(valor, larg - 2 * PAD, 7), x + PAD, y + 0.50);
  };
  /** campo do bloco de identificação: título em 7 pt negrito, tudo em maiúsculas */
  const campoId = (rotulo: string, valor: string, x: number, y: number, larg = CW) => {
    fonte(7, true); doc.text(rotulo, x + PAD, y + 0.25);
    doc.text(cabe(valor, larg - 2 * PAD, 7), x + PAD, y + 0.54);
  };
  const tituloBloco = (txt: string, y: number, alt: number) => { sombra(X0, y, CW, alt); fonte(7, true); doc.text(txt, X0 + PAD, y + 0.30); };
  const blocoSuprimido = (txt: string, y: number) => { linhaH(y); fonte(7); doc.text(txt, X0 + W / 2, y + 0.24, { align: "center" }); return y + 0.32; };

  // borda da página (1 pt)
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(1 * PT); doc.rect(0.19, 0.19, 20.62, 29.32);

  // ── cabeçalho ──
  sombra(X0, 0.30, W, 1.16);
  try { doc.addImage(o.logoNfseB64, "PNG", 0.49, 0.47, 4.00, 0.81); } catch { /* sem logomarca não deixa de gerar */ }
  fonte(9, true);
  const meioCab = COL[1] + 10.19 / 2;
  doc.text("DANFSe v2.0", meioCab, tpAmb === "2" ? 0.62 : 0.78, { align: "center" });
  doc.text("Documento Auxiliar da NFS-e", meioCab, tpAmb === "2" ? 0.96 : 1.12, { align: "center" });
  if (tpAmb === "2") { doc.setTextColor(255, 0, 0); doc.text("NFS-e SEM VALIDADE JURÍDICA", meioCab, 1.30, { align: "center" }); doc.setTextColor(0, 0, 0); }
  const cLocEmi = g("cLocEmi", dps);
  const item99 = g("cTribNac", serv).startsWith("99");
  if (!item99) { doc.text(cabe(`Município: ${await munUf(cLocEmi)}`, CW - 2 * PAD, 8), COL[3] + PAD, 0.72); }
  fonte(6);
  doc.text(`Ambiente Gerador: ${cod(AMB_GER, g("ambGer", inf))}`, COL[3] + PAD, 1.13);
  doc.text(`Tipo de Ambiente: ${cod(TP_AMB, tpAmb)}`, COL[3] + PAD, 1.38);

  // ── dados da NFS-e ──
  linhaH(1.48);
  campoId("CHAVE DE ACESSO DA NFS-E", v(chave), COL[0], 1.50, 15.30);
  campoId("NÚMERO DA NFS-E", v(g("nNFSe", inf)), COL[0], 2.27);
  campoId("COMPETÊNCIA DA NFS-E", dataF(g("dCompet", dps)), COL[1], 2.27);
  campoId("DATA E HORA DA EMISSÃO DA NFS-E", dataHoraF(g("dhProc", inf)), COL[2], 2.27);
  campoId("NÚMERO DA DPS", v(g("nDPS", dps)), COL[0], 2.96);
  campoId("SÉRIE DA DPS", v(g("serie", dps)), COL[1], 2.96);
  campoId("DATA E HORA DA EMISSÃO DA DPS", dataHoraF(g("dhEmi", dps)), COL[2], 2.96);
  sombra(COL[0], 3.65, CW, 0.67);
  campoId("EMITENTE DA NFS-E", cod(TP_EMIT, g("tpEmit", dps)), COL[0], 3.65);
  campoId("SITUAÇÃO DA NFS-E", cod(C_STAT, g("cStat", inf), 37), COL[1], 3.65);
  campoId("FINALIDADE", cod(FIN, g("finNFSe", ibsD), 37), COL[2], 3.65);

  // QR Code da consulta pública (mínimo de 1,52 cm; posição X 17,48 / Y 1,67)
  if (chave) {
    const qr = o.QRCode.create(`https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${chave}`, { errorCorrectionLevel: "M" });
    const n = qr.modules.size, dados = qr.modules.data, lado = 1.56, m = lado / n, qx = 17.46, qy = 1.67;
    doc.setFillColor(0, 0, 0);
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (!dados[r * n + c]) { c++; continue; }
        let f = c; while (f < n && dados[r * n + f]) f++;
        doc.rect(qx + c * m, qy + r * m, (f - c) * m + 0.002, m + 0.002, "F");
        c = f;
      }
    }
  }
  fonte(6);
  ["A autenticidade desta NFS-e pode ser verificada", "pela leitura deste código QR ou pela consulta da", "chave de acesso no portal nacional da NFS-e"]
    .forEach((l, i) => doc.text(l, 15.80 + 4.72 / 2, 3.54 + i * 0.23, { align: "center" }));

  // ── blocos de pessoas ──
  const H = 0.64;                                       // altura de linha dos blocos
  let y = 4.34;
  const blocoPessoaDanfse = (titulo: string, p: any, comIM: boolean) => {
    linhaH(y); tituloBloco(titulo, y, H);
    campo("CNPJ / CPF / NIF", p.doc, COL[1], y);
    if (comIM) campo("Indicador Municipal (Inscrição)", p.im, COL[2], y);
    campo("Telefone", p.fone, COL[3], y);
    y += H;
    campo("Nome / Nome Empresarial", p.nome, COL[0], y, 10.19);
    campo("Município / Sigla UF", p.mun, COL[2], y);
    campo("Código IBGE / CEP", p.ibgeCep, COL[3], y);
    y += H;
    campo("Endereço", p.endereco, COL[0], y, 10.19);
    campo("E-mail", p.email, COL[2], y, 10.19);
    y += H;
  };

  const pPrest = await pessoa(prest, emit);
  blocoPessoaDanfse("PRESTADOR / FORNECEDOR", pPrest, true);
  const regTrib = blocoDe("regTrib", prest);
  campo("Simples Nacional na Data de Competência", cod(OP_SN, g("opSimpNac", regTrib), 37), COL[0], y);
  campo("Regime de Apuração Tributária pelo SN", cod(REG_AP_SN, g("regApTribSN", regTrib), 77), COL[1], y, 10.19);
  y += H;

  const temToma = !!(g("CNPJ", toma) || g("CPF", toma) || g("NIF", toma) || g("xNome", toma));
  if (temToma) blocoPessoaDanfse("TOMADOR / ADQUIRENTE", await pessoa(toma), true);
  else y = blocoSuprimido("TOMADOR/ADQUIRENTE DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e", y);

  const temDest = !!(g("CNPJ", destB) || g("CPF", destB) || g("NIF", destB) || g("xNome", destB));
  const mesmoDoc = (a: string, b: string) => { const d = (s: string) => g("CNPJ", s) || g("CPF", s) || g("NIF", s); return !!d(a) && d(a) === d(b); };
  if (temDest && !mesmoDoc(destB, toma)) blocoPessoaDanfse("DESTINATÁRIO DA OPERAÇÃO", await pessoa(destB), false);
  else if (temDest) y = blocoSuprimido("O DESTINATÁRIO É O PRÓPRIO TOMADOR/ADQUIRENTE DA OPERAÇÃO", y);
  else y = blocoSuprimido("DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e", y);

  const temInterm = !!(g("CNPJ", interm) || g("CPF", interm) || g("NIF", interm) || g("xNome", interm));
  if (temInterm) blocoPessoaDanfse("INTERMEDIÁRIO DA OPERAÇÃO", await pessoa(interm), true);
  else y = blocoSuprimido("INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e", y);

  // ── blocos de baixo: medidos antes, pra a sobra de altura ir pra descrição e pras informações complementares ──
  const sujeitoIss = !!tribMun && g("tribISSQN", tribMun) !== "4";
  const linhaRegime = !!(g("regEspTrib", regTrib) || g("tpImunidade", tribMun) || g("tpSusp", tribMun) || g("nProcesso", tribMun));
  const linhaBM = !!(g("tpBM", valN) || g("vCalcBM", valN) || g("vRedBCBM", tribMun) || g("vDR", valD) || g("vCalcDR", valN) || descInc);
  const linhaPisCofins = (g("dCompet", dps).slice(0, 4) || "2026") <= "2026";
  const altIss = sujeitoIss ? H * (2 + (linhaRegime ? 1 : 0) + (linhaBM ? 1 : 0)) : 0.32;
  const altFed = H * (1 + (linhaPisCofins ? 1 : 0));
  const altIbs = H * 4, altTotal = 0.67 * 2, altTitInfo = 0.39;

  // informações complementares (união dos campos, separados por barra vertical; a linha dos tributos é fixa)
  const infoCompl = blocoDe("infoCompl", serv), obra = blocoDe("obra", serv), evento = blocoDe("atvEvento", serv);
  const itens: string[] = [];
  const junta = (rot: string, val: string) => { if (val) itens.push(`${rot} ${val}`); };
  junta("Inf. Cont.:", g("xInfComp", infoCompl));
  junta("NFS-e Subst.:", g("chSubstda", blocoDe("subst", dps)));
  junta("Doc. Ref.:", g("docRef", infoCompl));
  junta("Cod. Obra:", g("cObra", obra));
  junta("Insc. Imob.:", g("inscImobFisc", obra) || g("inscImobFisc", blocoDe("imovel", ibsD)));
  junta("Cod. Evt.:", g("idAtvEvt", evento));
  junta("Doc. Tec.:", g("idDocTec", infoCompl));
  junta("Núm. Ped.:", g("xPed", infoCompl));
  junta("Item Ped.:", (infoCompl.match(/<xItemPed>([^<]*)<\/xItemPed>/g) || []).map((s) => des(s.replace(/<[^>]+>/g, ""))).join(", "));
  junta("Inf. A. T. Mun.:", g("xOutInf", inf));
  const vT = blocoDe("vTotTrib", totTrib), pT = blocoDe("pTotTrib", totTrib), pSN = g("pTotTribSN", totTrib);
  const tributos = vT
    ? `Federais: ${rs(g("vTotTribFed", vT))}; Estaduais: ${rs(g("vTotTribEst", vT))}; Municipais: ${rs(g("vTotTribMun", vT))}`
    : pT
      ? `Federais: ${pct(g("pTotTribFed", pT))}; Estaduais: ${pct(g("pTotTribEst", pT))}; Municipais: ${pct(g("pTotTribMun", pT))}`
      : pSN !== ""
        ? `Federais: ${T}; Estaduais: ${T}; Municipais: ${T}; Simples Nacional: ${pct(pSN)}`
        : `Federais: ${T}; Estaduais: ${T}; Municipais: ${T}`;
  const linhaTributos = `Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: ${tributos}`;
  fonte(7);
  const ENTRE = 0.30;                                   // entrelinha do texto corrido de 7 pt
  const linhasInfo: string[] = itens.length ? doc.splitTextToSize(corta(itens.join(" | "), 1997), W - 2 * PAD) : [];
  const descricao = corta(g("xDescServ", serv), 1297);
  const linhasDesc: string[] = doc.splitTextToSize(descricao || T, W - 2 * PAD);

  // ── serviço prestado ──
  linhaH(y); tituloBloco("SERVIÇO PRESTADO", y, H);
  const cTribNac = g("cTribNac", serv), cTribMun = g("cTribMun", serv);
  const cTribF = cTribNac.length === 6 ? cTribNac.replace(/^(\d{2})(\d{2})(\d{2})$/, "$1.$2.$3") : cTribNac;
  campo("Código de Tributação Nacional / Municipal", cTribNac ? `${cTribF} / ${cTribMun || T}` : T, COL[1], y);
  const nbs = g("cNBS", serv);
  campo("Código da NBS", nbs.length === 9 ? nbs.replace(/^(\d)(\d{4})(\d{2})(\d{2})$/, "$1.$2.$3.$4") : v(nbs), COL[2], y);
  const cLocPrest = g("cLocPrestacao", serv), pais = g("cPaisPrestacao", serv);
  campo("Local da Prestação / Sigla UF / País", cLocPrest ? `${await munUf(cLocPrest)} / ${pais || "BR"}` : v(pais), COL[3], y);
  y += H;
  fonte(7);
  doc.text(cabe(corta(g("xTribMun", inf) || g("xTribNac", inf) || T, 167), W - 2 * PAD, 7), X0 + PAD, y + 0.26);
  y += 0.38;

  // altura que sobra na página depois dos blocos fixos
  const fixoAbaixo = altIss + altFed + altIbs + altTotal + altTitInfo;
  const sobra = YF - y - fixoAbaixo;
  const altInfoMin = 0.20 + (linhasInfo.length + 1) * ENTRE + 0.15;
  const altDescPedida = 0.30 + linhasDesc.length * ENTRE + 0.15;
  const altDesc = Math.max(0.63, Math.min(altDescPedida < sobra * 0.45 ? sobra * 0.45 : altDescPedida, sobra - altInfoMin));
  fonte(6, true); doc.text("Descrição do Serviço", X0 + PAD, y + 0.22);
  fonte(7);
  const cabemDesc = Math.max(1, Math.floor((altDesc - 0.30 - 0.05) / ENTRE));
  linhasDesc.slice(0, cabemDesc).forEach((l, i) => doc.text(l, X0 + PAD, y + 0.52 + i * ENTRE));
  y += altDesc;

  // ── tributação municipal (ISSQN) ──
  if (!sujeitoIss) {
    y = blocoSuprimido("TRIBUTAÇÃO MUNICIPAL (ISSQN) - OPERAÇÃO NÃO SUJEITA AO ISSQN", y);
  } else {
    linhaH(y); tituloBloco("TRIBUTAÇÃO MUNICIPAL (ISSQN)", y, H);
    campo("Tipo de Tributação do ISSQN", cod(TRIB_ISSQN, g("tribISSQN", tribMun)), COL[1], y);
    const cInc = g("cLocIncid", inf);
    campo("Município / Sigla UF / País de Incidência do ISSQN", cInc ? `${await munUf(cInc)} / ${g("cPaisResult", tribMun) || "BR"}` : T, COL[2], y, 10.19);
    y += H;
    if (linhaRegime) {
      campo("Regime Especial de Tributação do ISSQN", cod(REG_ESP, g("regEspTrib", regTrib)), COL[0], y);
      campo("Tipo de Imunidade do ISSQN", cod(IMUN, g("tpImunidade", tribMun), 37), COL[1], y);
      campo("Suspensão da Exigibilidade do ISSQN", cod(SUSP, g("tpSusp", tribMun), 37), COL[2], y);
      campo("Número Processo Suspensão", v(g("nProcesso", tribMun)), COL[3], y);
      y += H;
    }
    if (linhaBM) {
      campo("Benefício Municipal", v(g("tpBM", valN)), COL[0], y);
      campo("Cálculo do BM", rs(g("vCalcBM", valN) || g("vRedBCBM", tribMun)), COL[1], y);
      campo("Total Deduções/Reduções", rs(g("vDR", valD) || soma(g("vCalcDR", valN), g("vCalcReeRepRes", ibsN))), COL[2], y);
      campo("Desconto Incondicionado", rs(descInc), COL[3], y);
      y += H;
    }
    campo("BC ISSQN", rs(g("vBC", valN)), COL[0], y);
    campo("Alíquota Aplicada", pct(g("pAliqAplic", valN)), COL[1], y);
    campo("Retenção do ISSQN", cod(RET_ISSQN, g("tpRetISSQN", tribMun)), COL[2], y);
    campo("ISSQN Apurado", rs(g("vISSQN", valN)), COL[3], y);
    y += H;
  }

  // ── tributação federal (exceto CBS) ──
  linhaH(y); tituloBloco("TRIBUTAÇÃO FEDERAL (EXCETO CBS)", y, H);
  campo("IRRF", rs(g("vRetIRRF", tribFed)), COL[1], y);
  campo("Contribuição Previdenciária - Retida", rs(g("vRetCP", tribFed)), COL[2], y);
  campo("Contribuições Sociais - Retidas", rs(contribRet), COL[3], y);
  y += H;
  if (linhaPisCofins) {
    campo("PIS - Débito Apuração Própria", pisc ? rs(retPisCofins ? "0" : g("vPis", pisc)) : T, COL[0], y);
    campo("COFINS - Débito Apuração Própria", pisc ? rs(retPisCofins ? "0" : g("vCofins", pisc)) : T, COL[1], y);
    campo("Descrição Contrib. Sociais - Retidas", cod(RET_PISCOFINS, g("tpRetPisCofins", pisc)), COL[2], y, 10.19);
    y += H;
  }

  // ── tributação IBS / CBS ──
  linhaH(y); tituloBloco("TRIBUTAÇÃO IBS / CBS", y, H);
  const gIbs = blocoDe("gIBSCBS", ibsD);
  campo("CST / cClassTrib", g("CST", gIbs) || g("cClassTrib", gIbs) ? `${g("CST", gIbs) || T} / ${g("cClassTrib", gIbs) || T}` : T, COL[1], y);
  const cLocIbs = g("cLocalidadeIncid", ibsN);
  campo("Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF",
    temIbs && (g("cIndOp", ibsD) || cLocIbs) ? `${g("cIndOp", ibsD) || T} / ${cLocIbs || T} / ${cLocIbs ? await munUf(cLocIbs) : T}` : T, COL[2], y, 10.19);
  y += H;
  campo("Exclusões e Reduções da Base de Cálculo", temIbs ? rs(soma(descInc, g("vCalcReeRepRes", ibsN), g("vISSQN", valN), g("vPis", pisc), g("vCofins", pisc))) : T, COL[0], y);
  campo("Base de Cálculo Após Exclusões e Reduções", rs(g("vBC", blocoDe("valores", ibsN))), COL[1], y);
  campo("Red. Alíquota IBS / Red. Alíquota CBS", tresPct(g("pRedAliqUF", ibsUf), g("pRedAliqMun", ibsMun), g("pRedAliqCBS", ibsFed)), COL[2], y);
  campo("Alíquota - IBS UF / IBS Mun", g("pIBSUF", ibsUf) || g("pIBSMun", ibsMun) ? `${pct(g("pIBSUF", ibsUf))} / ${pct(g("pIBSMun", ibsMun))}` : T, COL[3], y);
  y += H;
  campo("Alíq. Efetiva Municipal - IBS", pct(g("pAliqEfetMun", ibsMun)), COL[0], y);
  campo("Valor Apurado Municipal - IBS", rs(g("vIBSMun", totCibs)), COL[1], y);
  campo("Alíq. Efetiva Estadual - IBS", pct(g("pAliqEfetUF", ibsUf)), COL[2], y);
  campo("Valor Apurado Estadual - IBS", rs(g("vIBSUF", totCibs)), COL[3], y);
  y += H;
  campo("Valor Total Apurado - IBS", rs(g("vIBSTot", totCibs)), COL[0], y);
  campo("Alíquota - CBS", pct(g("pCBS", ibsFed)), COL[1], y);
  campo("Alíquota Efetiva - CBS", pct(g("pAliqEfetCBS", ibsFed)), COL[2], y);
  campo("Valor Total Apurado - CBS", rs(g("vCBS", totCibs)), COL[3], y);
  y += H;

  // ── valor total da NFS-e ──
  const HT = 0.67;
  linhaH(y); sombra(X0, y, CW, HT); fonte(7, true); doc.text("VALOR TOTAL DA NFS-E", X0 + PAD, y + 0.30);
  campoId("VALOR DA OPERAÇÃO / SERVIÇO", rs(vServ), COL[1], y);
  campo("Desconto Incondicionado", rs(descInc), COL[2], y);
  campo("Desconto Condicionado", rs(descCond), COL[3], y);
  y += HT;
  campo("Total das Retenções (ISSQN / Federais)", rs(g("vTotalRet", valN)), COL[0], y);
  campoId("VALOR LÍQUIDO DA NFS-e", rs(g("vLiq", valN)), COL[1], y);
  campo("Total do IBS/CBS", rs(soma(g("vIBSTot", totCibs), g("vCBS", totCibs))), COL[2], y);
  sombra(COL[3], y, CW, HT);
  campoId("VALOR LÍQUIDO DA NFS-e + IBS/CBS", rs(g("vTotNF", totCibs)), COL[3], y);
  y += HT;

  // ── informações complementares (ocupa o resto da página; a linha dos tributos é obrigatória) ──
  linhaH(y); sombra(X0, y, W, altTitInfo); fonte(7, true); doc.text("INFORMAÇÕES COMPLEMENTARES", X0 + PAD, y + 0.27);
  y += altTitInfo;
  fonte(7);
  const cabemInfo = Math.max(0, Math.floor((YF - y - 0.20 - ENTRE - 0.10) / ENTRE));
  linhasInfo.slice(0, cabemInfo).forEach((l, i) => doc.text(l, X0 + PAD, y + 0.30 + i * ENTRE));
  doc.text(cabe(linhaTributos, W - 2 * PAD, 7), X0 + PAD, y + 0.30 + Math.min(linhasInfo.length, cabemInfo) * ENTRE);

  // ── marca d'água de nota cancelada ou substituída (diagonal, Arial 50 pt no mínimo, cinza K35) ──
  if (o.situacao === "cancelada" || o.situacao === "substituida") {
    const marca = o.situacao === "cancelada" ? "CANCELADA" : "SUBSTITUÍDA";
    doc.setFont("helvetica", "normal"); doc.setFontSize(88); doc.setTextColor(166, 166, 166);
    // translúcida, pra não esconder os dados da nota
    try { doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: 0.45 })); } catch { /* sem transparência, segue opaca */ }
    const larg = doc.getTextWidth(marca), ang = 50 * Math.PI / 180, alt = 88 * PT * 0.35;
    // o texto gira em torno do início da linha de base: recua meio comprimento pra o centro cair no meio da página
    doc.text(marca, 10.5 - (larg / 2) * Math.cos(ang) + alt * Math.sin(ang), 14.85 + (larg / 2) * Math.sin(ang) + alt * Math.cos(ang), { angle: 50 });
    try { doc.restoreGraphicsState(); } catch { /* idem */ }
    doc.setTextColor(0, 0, 0);
  }
  return new Uint8Array(doc.output("arraybuffer"));
}

// Logomarca oficial da NFS-e (gov.br/nfse, "Logo - NFS-e - Horizontal.png"), reduzida pra 520 px de largura
const LOGO_NFSE_B64 = "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";

/** nome do município pelo código do IBGE (o XML só traz o código do município do tomador) */
async function nomeMunicipioIbge(cod: string): Promise<string | null> {
  try {
    const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${cod}`, { signal: AbortSignal.timeout(2500) });
    if (!r.ok) return null;
    const d = await r.json();
    return typeof d?.nome === "string" && d.nome ? d.nome : null;
  } catch { return null; }
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
    // A função roda sem verificação de JWT na entrada: ler só o "role" do token aceitava token forjado.
    // Servidor é quem manda exatamente a chave de serviço do projeto.
    const chaveServico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const ehServidor = !!token && !!chaveServico && token === chaveServico;
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

    // DANFSe: o PDF da nota. Desde 03/08/2026 o gov não entrega mais o PDF (NT 008/2026 suspendeu a API
    // adn.nfse.gov.br/danfse): quem gera o DANFSe é o sistema emissor, no modelo nacional, a partir do XML.
    //   fonte "espelho" = espelho no visual do Nexus; qualquer outro valor = DANFSe no modelo nacional.
    if (body.action === "danfse") {
      if (!body.chave_acesso) return json({ error: "informe chave_acesso" }, 400);
      const chaveD = String(body.chave_acesso);
      const fonte = body.fonte === "espelho" ? "espelho" : "danfse";
      const { data: reg } = await supabase.from("nfse_records")
        .select("id, xml_nfse, status").eq("chave_acesso", chaveD).maybeSingle();
      let xmlGz: string | null = reg?.xml_nfse ?? null;
      if (!xmlGz) {
        // nota sem XML guardado: busca o XML autorizado no gov e guarda
        try {
          const { data: cfgD } = await supabase.from("nfse_emitter_config").select("*").limit(1).maybeSingle();
          const { data: certD } = await supabase.from("fiscal_certificates")
            .select("file_path, senha_cifrada").eq("ativo", true).maybeSingle();
          if (cfgD && certD) {
            const { data: arqD } = await supabase.storage.from("certificados").download(certD.file_path);
            const abertoD = abrirPfx(bytesToB64(new Uint8Array(await arqD!.arrayBuffer())), await decifrar(certD.senha_cifrada));
            const rN = await pontoGov(`/SefinNacional/nfse/${chaveD}`, "GET", undefined, abertoD.certPem, abertoD.keyPem, String(body.ambiente || cfgD.ambiente));
            const dN = JSON.parse(rN.corpo);
            if (dN?.nfseXmlGZipB64) {
              xmlGz = dN.nfseXmlGZipB64;
              if (reg?.id) await supabase.from("nfse_records").update({ xml_nfse: xmlGz }).eq("id", reg.id);
            }
          }
        } catch (e) { console.error("[nfse-emitir] danfse: XML não veio do gov", e); }
      }
      if (!xmlGz) return json({ error: "Não tenho o XML desta nota guardado e o gov não devolveu agora. Tente de novo em alguns minutos." }, 503);
      const xml = await gunzipB64(xmlGz);
      let pdf: Uint8Array;
      if (fonte === "espelho") {
        pdf = await gerarEspelho(xml, chaveD);
      } else {
        const { jsPDF } = await import("https://esm.sh/jspdf@2.5.2");
        const QRCode = (await import("https://esm.sh/qrcode@1.5.4")).default;
        pdf = await gerarDanfse(xml, {
          jsPDF, QRCode, logoNfseB64: LOGO_NFSE_B64, nomeMunicipio: nomeMunicipioIbge,
          situacao: reg?.status === "cancelled" ? "cancelada" : reg?.status === "replaced" ? "substituida" : null,
        });
      }
      let b64 = "";
      for (let k = 0; k < pdf.length; k += 8192) b64 += String.fromCharCode(...pdf.subarray(k, k + 8192));
      return json({ ok: true, pdf_base64: btoa(b64), fonte });
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
