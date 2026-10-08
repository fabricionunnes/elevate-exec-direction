// Cria (ou atualiza) o usuário da Yasmim e registra como admin.
// Uso:
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//   ADMIN_EMAIL=email@exemplo.com ADMIN_PASSWORD='senha' ADMIN_NAME='Yasmim' \
//   node scripts/create-admin.mjs
// A service role key fica só na sua máquina. Nunca no front nem no git.
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = "Yasmim" } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Faltam variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let userId;
const { data: created, error } = await sb.auth.admin.createUser({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true, user_metadata: { name: ADMIN_NAME } });
if (error) {
  if (!/already|exists|registered/i.test(error.message)) { console.error(error.message); process.exit(1); }
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const u = list.users.find((x) => x.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  if (!u) { console.error("Usuário existe mas não foi encontrado."); process.exit(1); }
  userId = u.id;
  await sb.auth.admin.updateUserById(userId, { password: ADMIN_PASSWORD, email_confirm: true });
  console.log("Usuário já existia; senha atualizada.");
} else {
  userId = created.user.id;
  console.log("Usuário criado.");
}

const { error: e2 } = await sb.from("admins").upsert({ user_id: userId, name: ADMIN_NAME });
if (e2) { console.error(e2.message); process.exit(1); }
console.log(`OK: ${ADMIN_EMAIL} é admin (${userId}).`);
