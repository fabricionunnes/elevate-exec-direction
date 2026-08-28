// Certificado digital A1 da empresa: guarda o arquivo .pfx e a senha (cifrada)
// para o sistema assinar e transmitir NFS-e direto no Emissor Nacional (gov.br),
// sem intermediário pago. O certificado vence todo ano — por isso a troca é
// feita aqui dentro, sem depender de ninguém mexer no servidor.
//
// Ações: save | status | test | delete
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

async function chave() {
  const raw = Deno.env.get("CERT_ENCRYPTION_KEY");
  if (!raw) throw new Error("CERT_ENCRYPTION_KEY não configurada");
  return await crypto.subtle.importKey("raw", b64ToBytes(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function cifrar(texto: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await chave(), new TextEncoder().encode(texto));
  return `${bytesToB64(iv)}:${bytesToB64(new Uint8Array(buf))}`;
}
async function decifrar(guardado: string) {
  const [iv, dados] = guardado.split(":");
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(iv) }, await chave(), b64ToBytes(dados));
  return new TextDecoder().decode(buf);
}

/** abre o .pfx e devolve certificado + chave em PEM (formato que a conexão usa) */
function abrirPfx(pfxB64: string, senha: string) {
  const der = forge.util.decode64(pfxB64);
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const keyBags = (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [])
    .concat(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []);
  if (!certBags.length || !keyBags.length) throw new Error("Arquivo sem certificado ou sem chave privada");

  // o certificado do titular é o que tem chave associada; na dúvida, o primeiro
  const cert = certBags[0].cert!;
  const key = keyBags[0].key!;

  const titular = cert.subject.attributes.map((a: any) => a.value).join(", ");
  const cn = cert.subject.getField("CN")?.value || "";
  const cnpj = (cn.match(/(\d{14})/) || [])[1] || (titular.match(/(\d{14})/) || [])[1] || null;

  // cadeia completa ajuda a conexão com o gov
  const cadeia = certBags.map((b: any) => forge.pki.certificateToPem(b.cert)).join("\n");

  return {
    certPem: cadeia,
    keyPem: forge.pki.privateKeyToPem(key),
    titular: cn || titular,
    cnpj,
    validoDe: cert.validity.notBefore as Date,
    validoAte: cert.validity.notAfter as Date,
  };
}

/** só master/admin mexem no certificado da empresa — é credencial fiscal */
async function exigirAdmin(req: Request, supabase: any) {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("nao_autorizado");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("nao_autorizado");
  const { data: staff } = await supabase.from("onboarding_staff")
    .select("id, role, is_active").eq("user_id", user.id).maybeSingle();
  if (!staff?.is_active || !["master", "admin"].includes(staff.role)) throw new Error("nao_autorizado");
  return staff;
}

function sb() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** fala com o Emissor Nacional através da ponte na VPS: o servidor do gov (IIS)
 *  pede o certificado por renegociação TLS, que o runtime daqui não faz. */
async function chamarGov(opts: {
  certPem: string; keyPem: string; path: string; metodo?: string; corpo?: string;
  host?: string; headers?: Record<string, string>;
}) {
  const url = Deno.env.get("NFSE_BRIDGE_URL");
  const token = Deno.env.get("NFSE_BRIDGE_TOKEN");
  if (!url || !token) throw new Error("Ponte de NFS-e não configurada");
  const r = await fetch(`${url}/gov`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bridge-token": token },
    body: JSON.stringify({
      host: opts.host || "sefin.nfse.gov.br",
      path: opts.path,
      metodo: opts.metodo || "GET",
      corpo: opts.corpo,
      headers: opts.headers,
      cert_pem: opts.certPem,
      key_pem: opts.keyPem,
    }),
  });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error || `ponte respondeu ${r.status}`);
  return d as { status: number; headers: any; corpo: string };
}




Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabase = sb();
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // chamada feita pelo próprio servidor (diagnóstico): o token de serviço traz
    // role=service_role no payload — quem já tem essa chave tem acesso total
    const tokenReq = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    let chaveServidor = tokenReq === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!chaveServidor && tokenReq.split(".").length === 3) {
      try {
        const payload = JSON.parse(atob(tokenReq.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        chaveServidor = payload?.role === "service_role";
      } catch { /* token que não é JWT: segue como usuário comum */ }
    }
    let staff: any = null;
    if (!(chaveServidor && action === "test")) {
      try {
        staff = await exigirAdmin(req, supabase);
      } catch {
        return json({ error: "Só master ou admin pode mexer no certificado digital." }, 403);
      }
    }

    if (action === "save") {
      const { arquivo_base64, senha, apelido } = body;
      if (!arquivo_base64 || !senha) return json({ error: "Envie o arquivo e a senha" }, 400);

      let dados;
      try {
        dados = abrirPfx(arquivo_base64, senha);
      } catch (e) {
        // erro mais comum: senha errada. Não vaza detalhe técnico pro usuário.
        return json({ error: "Não consegui abrir o certificado. Confira a senha e se o arquivo é .pfx/.p12 (tipo A1)." }, 400);
      }
      if (dados.validoAte.getTime() < Date.now()) {
        return json({ error: `Este certificado venceu em ${dados.validoAte.toLocaleDateString("pt-BR")}.` }, 400);
      }

      const caminho = `empresa/${crypto.randomUUID()}.pfx`;
      const bytes = b64ToBytes(arquivo_base64);
      const { error: upErr } = await supabase.storage.from("certificados")
        .upload(caminho, bytes, { contentType: "application/x-pkcs12", upsert: false });
      if (upErr) return json({ error: "Falha ao guardar o arquivo: " + upErr.message }, 500);

      // desativa o anterior e guarda o novo (troca de certificado vencido)
      await supabase.from("fiscal_certificates").update({ ativo: false }).eq("ativo", true);
      const { data: novo, error: insErr } = await supabase.from("fiscal_certificates").insert({
        apelido: apelido || "Certificado da empresa",
        cnpj: dados.cnpj, titular: dados.titular,
        file_path: caminho, senha_cifrada: await cifrar(senha),
        valido_de: dados.validoDe.toISOString(), valido_ate: dados.validoAte.toISOString(),
        ativo: true, enviado_por: staff?.id ?? null,
      }).select("id").single();
      if (insErr) return json({ error: insErr.message }, 500);

      return json({
        ok: true, id: novo.id, titular: dados.titular, cnpj: dados.cnpj,
        valido_ate: dados.validoAte.toISOString(),
      });
    }

    if (action === "status") {
      const { data } = await supabase.from("fiscal_certificates")
        .select("id, apelido, cnpj, titular, valido_de, valido_ate, ultimo_teste_em, ultimo_teste_ok, ultimo_teste_msg, created_at")
        .eq("ativo", true).maybeSingle();
      if (!data) return json({ tem_certificado: false });
      const dias = Math.floor((new Date(data.valido_ate).getTime() - Date.now()) / 86400000);
      return json({ tem_certificado: true, ...data, dias_para_vencer: dias, vencido: dias < 0 });
    }

    if (action === "test") {
      const municipio = String(body.codigo_municipio || "3144805"); // Nova Lima/MG
      const { data: cert } = await supabase.from("fiscal_certificates")
        .select("id, file_path, senha_cifrada").eq("ativo", true).maybeSingle();
      if (!cert) return json({ ok: false, message: "Nenhum certificado enviado ainda." });

      const { data: arq, error: dlErr } = await supabase.storage.from("certificados").download(cert.file_path);
      if (dlErr || !arq) return json({ ok: false, message: "Não achei o arquivo do certificado." });

      const senha = await decifrar(cert.senha_cifrada);
      const pfxB64 = bytesToB64(new Uint8Array(await arq.arrayBuffer()));
      const { certPem, keyPem } = abrirPfx(pfxB64, senha);

      let resultado;
      try {
        const r = await chamarGov({ certPem, keyPem, path: "/SefinNacional/swagger/docs/v1" });
        const amostra = (r.corpo || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220);
        const ok = r.status >= 200 && r.status < 300;
        resultado = {
          ok,
          message: ok
            ? "Conectado no Emissor Nacional — o certificado da empresa foi aceito pelo gov."
            : r.status === 403
              ? "O gov recusou o certificado (403). Confira se o certificado é o e-CNPJ da empresa e está válido."
              : `O gov respondeu ${r.status}. ${amostra}`,
        };
      } catch (e) {
        resultado = { ok: false, message: String((e as Error).message).slice(0, 300) };
      }

      await supabase.from("fiscal_certificates").update({
        ultimo_teste_em: new Date().toISOString(),
        ultimo_teste_ok: resultado.ok,
        ultimo_teste_msg: resultado.message,
      }).eq("id", cert.id);
      return json(resultado);
    }


    if (action === "delete") {
      const { data: cert } = await supabase.from("fiscal_certificates").select("id, file_path").eq("ativo", true).maybeSingle();
      if (cert) {
        await supabase.storage.from("certificados").remove([cert.file_path]);
        await supabase.from("fiscal_certificates").delete().eq("id", cert.id);
      }
      return json({ ok: true });
    }

    return json({ error: "ação inválida" }, 400);
  } catch (e) {
    console.error("[fiscal-certificate]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
