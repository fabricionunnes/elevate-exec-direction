#!/usr/bin/env bash
# Deploy das functions do Time de IA (Max) no Supabase do Nexus pela Management API.
# Uso: bash scripts/deploy-time-ia.sh [ai-team-chat|ai-team-orchestrator|ai-team-tts|all]
#      bash scripts/deploy-time-ia.sh sql supabase/migrations/<arquivo>.sql   (aplica uma migration)
# Token: lê do keychain do Mac ("Supabase CLI") ou da env SUPABASE_ACCESS_TOKEN.
set -euo pipefail
cd "$(dirname "$0")/.."
REF=xrncvhzxjmddqluxoosu
TOK="${SUPABASE_ACCESS_TOKEN:-$(security find-generic-password -s "Supabase CLI" -a supabase -w | sed 's/^go-keyring-base64://' | base64 -d)}"
ALVO="${1:-all}"
if [ "$ALVO" = "sql" ]; then
  ARQ="${2:?informe o arquivo .sql}"
  printf 'migration %s: ' "$(basename "$ARQ")"
  python3 -c 'import json,sys; print(json.dumps({"query": open(sys.argv[1]).read()}))' "$ARQ" \
    | curl -s -w " HTTP %{http_code}\n" -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
        -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" --data-binary @- | head -c 300
  exit 0
fi
deploy() {
  local fn="$1"; shift
  local meta="{\"name\":\"$fn\",\"entrypoint_path\":\"index.ts\",\"verify_jwt\":true"
  local extra=()
  if [ "$fn" != "ai-team-tts" ]; then
    meta="$meta,\"import_map_path\":\"deno.json\""
    extra=(-F "file=@supabase/functions/ai-team-orchestrator/shared.ts;filename=shared.ts" -F "file=@supabase/functions/deno.json;filename=deno.json")
  fi
  if [ "$fn" = "ai-team-chat" ]; then
    extra+=(-F "file=@supabase/functions/ai-team-chat/meta.ts;filename=meta.ts")
  fi
  meta="$meta}"
  printf '%s: ' "$fn"
  curl -s -X POST "https://api.supabase.com/v1/projects/$REF/functions/deploy?slug=$fn" \
    -H "Authorization: Bearer $TOK" \
    -F "metadata=$meta;type=application/json" \
    -F "file=@supabase/functions/$fn/index.ts;filename=index.ts" "${extra[@]}" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("status"), "v" + str(d.get("version")), d.get("message") or "")'
}
if [ "$ALVO" = "all" ]; then
  for fn in ai-team-orchestrator ai-team-chat ai-team-tts; do deploy "$fn"; done
else
  deploy "$ALVO"
fi
