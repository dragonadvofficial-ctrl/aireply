# rply: AI agent بيرد على كومنتات ورسايل فيسبوك وإنستجرام

بيرد على الكومنتات والـ DMs لعدد كبير من الصفحات والأكونتات (اتعمل عشان 100+ أكونت). بيستخدم المعلومات اللي إنت بتعلّمهاله (Brain) وبالأسلوب اللي إنت بتحدده (Voice)، وبيحاول يقلل صرف التوكنز لأقصى حد.

```
Meta Webhooks ──► /api/webhooks/meta ──► Postgres (messages + jobs) ──► worker ──► Meta Graph API
                       (يرد 200 فورًا)                    ▲                │
                                                           └── OpenAI ◄────┘   (لو محتاج بس)
```

## تشغيل محلي (5 دقايق)

```bash
cp .env.example .env              # واملأ SESSION_SECRET و ENCRYPTION_KEY و DATABASE_URL
npm install
npm run db:migrate
npm run db:seed                   # اختياري: داتا تجريبية → demo@rply.app / rplydemo123
npm run dev                       # الواجهة: http://localhost:3000
npm run worker                    # في تيرمينال تاني: ده اللي بيرد فعلًا
npm test                          # تيستات الفلاتر والـ webhook
```

> مفيش رد بيطلع من غير **worker** شغال. الـ web بيستقبل ويخزّن بس.

## الربط مع Supabase

1. اعمل Project جديد، وبعدين **Database → Extensions** وفعّل `vector`.
2. من **Connect** خد الاتنين:
   - `DATABASE_URL` = Transaction pooler (بورت 6543) + `DB_PREPARE=false` ← ده للـ web.
   - `WORKER_DATABASE_URL` = Session pooler (بورت 5432) ← ده للـ worker والـ migrations.
3. `npm run db:migrate`.

الـ web ينفع يترفع على Vercel. الـ worker لازم يكون process شغال على طول (VPS صغير أو Railway أو Fly).

## إعداد Meta App

| الحاجة | فين |
|---|---|
| App نوعه **Business** | developers.facebook.com → My Apps |
| `META_APP_ID` / `META_APP_SECRET` | App settings → Basic |
| **Facebook Login for Business** → Configuration بالصلاحيات تحت → `META_LOGIN_CONFIG_ID` | Products |
| **Instagram → API setup with Instagram login** → `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | Products |
| Redirect URIs | `https://YOUR_DOMAIN/api/meta/callback/facebook` و `…/instagram` |
| **Webhooks**: Callback `https://YOUR_DOMAIN/api/webhooks/meta`، و Verify token = `META_WEBHOOK_VERIFY_TOKEN` | Page: `feed`, `messages`, `messaging_postbacks` · Instagram: `comments`, `messages` |
| Data deletion callback | `https://YOUR_DOMAIN/api/meta/data-deletion` |
| Privacy policy | `https://YOUR_DOMAIN/privacy` (عدّل النص قبل الـ Review) |

**الصلاحيات:**
`pages_show_list, pages_manage_metadata, pages_read_engagement, pages_read_user_content, pages_manage_engagement, pages_messaging, business_management, instagram_basic, instagram_manage_comments, instagram_manage_messages` + طريقة IG Login: `instagram_business_basic, instagram_business_manage_comments, instagram_business_manage_messages`.

قبل الـ App Review الأكونتات الوحيدة اللي هتشتغل هي اللي ليها role على الـ App (Standard Access). عشان تخدم عملاء محتاج **Business Verification + App Review (Advanced Access)**.

## النقل على VPS

```bash
# على السيرفر (Ubuntu + Docker)
git clone … && cd rply && cp .env.example .env    # APP_URL=https://your.domain
echo "DOMAIN=your.domain" >> .env && echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env
docker compose up -d --build                       # db + migrate + web + 2 workers + Caddy (HTTPS تلقائي)

# نقل الداتا من Supabase
pg_dump "$SUPABASE_SESSION_URL" --no-owner --no-acl -n public > dump.sql
docker compose exec -T db psql -U rply rply < dump.sql
```

مفيش أي اعتماد على حاجة خاصة بـ Supabase: Postgres + pgvector بس. الـ Auth والـ Queue والـ Rate limits كلهم جوه Postgres.

## هيكل المشروع

```
src/lib/meta/      graph.ts (client + errors) · oauth.ts (FB/IG login) · webhook.ts (verify + normalize) · send.ts
src/lib/ai/        pipeline.ts (سلّم التوكنز) · prompt.ts · knowledge.ts (RAG) · memory.ts · context.ts · models.ts (الأسعار)
src/lib/engine/    ingest.ts (webhook → DB) · processor.ts (تنفيذ الـ jobs)
src/lib/queue.ts   طابور Postgres (SKIP LOCKED + debounce + backoff)
src/lib/rate.ts    حدود Meta لكل أكونت
worker/index.ts    الـ worker
src/app/app/*      الداشبورد: Overview · Inbox · Accounts · Squads · Brain · Voice · Playground · Usage
db/migrations/     الـ schema
```

تفاصيل القرارات والبحث في [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
