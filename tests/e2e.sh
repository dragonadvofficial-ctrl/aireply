# End-to-end: needs local Postgres + `node tests/mock-openai-meta.mjs` running + `npm run build` + seeded demo data.
set -e
cd /home/claude/rply
set -a; . ./.env; set +a
export OPENAI_API_KEY=test OPENAI_BASE_URL=http://localhost:4010/v1 META_GRAPH_BASE_OVERRIDE=http://localhost:4010 META_APP_SECRET=testsecret
# prep: one test account with a token
npx tsx tests/e2e-prep.ts
# start web (already running? restart with env) + worker
pkill -f next-server || true; pkill -f "worker/index.ts" || true; sleep 1
(PORT=3000 npx next start > /tmp/next.log 2>&1 &)
(npx tsx worker/index.ts > /tmp/worker.log 2>&1 &)
sleep 5
post() {
  local body="$1"; local sig=$(printf '%s' "$body" | openssl dgst -sha256 -hmac testsecret | awk '{print $2}')
  curl -s -X POST localhost:3000/api/webhooks/meta -H "content-type: application/json" -H "x-hub-signature-256: sha256=$sig" -d "$body"; echo
}
T=$(date +%s)
c() { echo "{\"object\":\"page\",\"entry\":[{\"id\":\"PAGE_TEST\",\"time\":$T,\"changes\":[{\"field\":\"feed\",\"value\":{\"item\":\"comment\",\"verb\":\"add\",\"comment_id\":\"$1\",\"post_id\":\"POST1\",\"from\":{\"id\":\"$2\",\"name\":\"$3\"},\"message\":\"$4\",\"created_time\":$T}}]}]}"; }
dm() { echo "{\"object\":\"page\",\"entry\":[{\"id\":\"PAGE_TEST\",\"time\":$T,\"messaging\":[{\"sender\":{\"id\":\"$1\"},\"recipient\":{\"id\":\"PAGE_TEST\"},\"timestamp\":${T}000,\"message\":{\"mid\":\"$2\",\"text\":\"$3\"}}]}]}"; }
echo "--- bad signature (expect 401):"; curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3000/api/webhooks/meta -H "x-hub-signature-256: sha256=00" -d '{}'
echo "--- verify GET:"; curl -s "localhost:3000/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=x&hub.challenge=abc" -o /dev/null -w "%{http_code}\n"
post "$(c C1 U1 'Ali' 'بكام الهودي؟')"                          # rule
post "$(c C1 U1 'Ali' 'بكام الهودي؟')"                          # duplicate delivery
post "$(c C2 U2 'Mona' '@friend.name')"                         # noise
post "$(c C3 U3 'Spam' 'earn 500 dollars daily on whatsapp +201234567890 crypto')" # spam -> hide
post "$(c C4 U4 'Hady' 'عندكم مقاس 38 في الكارجو؟')"              # llm
post "$(dm U5 M1 'الأوردر متأخر جدا')"                            # llm complaint -> handoff
post "$(dm U6 M2 'سلام')"; post "$(dm U6 M3 'عندكم مقاس 38 في الكارجو')"   # debounce -> 1 call
sleep 14
post "$(c C7 U7 'Sara' 'عندكم مقاس ٣٨ فى الكارجو ؟')"             # exact/semantic cache
sleep 9
echo "--- worker log"; grep -c '"what":"done"' /tmp/worker.log; grep -E 'retry|dead' /tmp/worker.log | head -5
