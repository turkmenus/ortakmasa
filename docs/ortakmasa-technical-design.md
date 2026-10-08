# Ortakmasa Teknik Tasarım Belgesi

**Proje:** ortakmasa (Colanode fork'u)  
**Lokasyon:** `/home/personal/Projects/ortakmasa`  
**Domain:** `ortakmasa.192.168.1.101.nip.io`  
**Tarih:** 2026-10-08  

## 1. Hedef

Colanode'un açık kaynak kodunu temel alarak, MHEK için self-hosted, multi-tenant, davetiye-tabanlı işbirliği platformu kurmak. İlk odak:

1. Public API + PAT (Personal Access Token) auth.
2. MCP server ile CRUD araçları.
3. Davetiye-link mekanizması.
4. Coolify üzerinde çalışan deployment.

MHEK tema/marka değişikliği **dışarıda** bırakıldı.

---

## 2. Mevcut Colanode Mimarisinde Değişecek Yerler

### 2.1 API Katmanı

Mevcut API'ler `apps/server/src/api/client/routes` altında `/client/v1` prefix'iyle sunuluyor.

Yeni yapı:

```
apps/server/src/api/
├── index.ts              # Mevcut: /client/v1 register ediliyor
├── client/routes/        # Mevcut private sync + auth routes
├── public/routes/        # YENİ: /api/v1 public API
│   ├── index.ts
│   ├── auth/             # PAT yönetimi (list, create, revoke)
│   ├── workspaces/       # List workspaces, create workspace
│   ├── nodes/            # CRUD for pages, databases, records
│   └── search.ts         # Workspace search
└── mcp/                  # YENİ: MCP server
    ├── server.ts
    ├── tools/
    │   ├── create-page.ts
    │   ├── list-pages.ts
    │   ├── get-page.ts
    │   ├── update-page.ts
    │   ├── create-database.ts
    │   ├── list-databases.ts
    │   ├── create-record.ts
    │   ├── list-records.ts
    │   ├── update-record.ts
    │   └── search-workspace.ts
    └── auth.ts           # PAT validation for MCP
```

`apps/server/src/api/index.ts` güncellenecek:

```ts
instance.register(clientRoutes, { prefix: `${prefix}/client/v1` });
instance.register(publicRoutes, { prefix: `${prefix}/api/v1` });
instance.register(mcpRoutes, { prefix: `${prefix}/mcp` }); // SSE transport
```

### 2.2 Veritabanı Değişiklikleri

Yeni migration dosyaları `apps/server/src/data/migrations/` altına eklenecek.

#### Tablo 1: `api_tokens`

| Kolon | Tip | Not |
|---|---|---|
| `id` | varchar(30) PK | |
| `account_id` | varchar(30) FK → accounts | |
| `user_id` | varchar(30) FK → users | Workspace-scoped token için |
| `workspace_id` | varchar(30) FK → workspaces | Opsiyonel; global token olabilir |
| `name` | varchar(256) | Token adı (örn. "Claude Code") |
| `token_hash` | varchar(256) | SHA256 hash |
| `token_salt` | varchar(256) | |
| `scopes` | jsonb | `["read", "write"]` |
| `status` | integer | Active / Revoked |
| `last_used_at` | timestamptz | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `created_by` | varchar(30) | |
| `revoked_at` | timestamptz | |

#### Tablo 2: `workspace_invitations`

| Kolon | Tip | Not |
|---|---|---|
| `id` | varchar(30) PK | |
| `workspace_id` | varchar(30) FK → workspaces | |
| `email` | varchar(256) | Davetiye gönderilen email |
| `token` | varchar(256) unique | Davetiye link token'ı |
| `role` | varchar(30) | `member` / `admin` |
| `status` | integer | Pending / Accepted / Revoked |
| `expires_at` | timestamptz | |
| `created_at` | timestamptz | |
| `created_by` | varchar(30) | Davet eden user |
| `accepted_at` | timestamptz | |
| `accepted_by` | varchar(30) | |

`users` tablosu zaten `workspace_id` + `account_id` unique constraint içeriyor. Davetiye kabul edildiğinde buraya `Active` user eklenir.

### 2.3 Auth Katmanı

Mevcut `account-auth.ts` plugin'i device token (`cnd_...`) doğruluyor. Public API ve MCP için **PAT plugin** eklenecek.

`apps/server/src/api/public/plugins/pat-auth.ts`:

```ts
// Header: Authorization: Bearer ort_xxxxxxxx
// 1. prefix kontrolü: ort_
// 2. token parse → tokenId + secret
// 3. api_tokens tablosundan hash + salt doğrula
// 4. account + workspace context oluştur
// 5. scopes kontrolü (read/write)
```

PAT formatı: `ort_<tokenId><secret>` (mevcut `cnd_` device token pattern'ine benzer).

---

## 3. Public API Endpoint Listesi

Tüm endpoint'ler `/api/v1` prefix'i altında.

### 3.1 PAT Yönetimi

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/tokens` | Kullanıcının PAT'lerini listele |
| POST | `/tokens` | Yeni PAT oluştur (name, workspace_id, scopes) |
| DELETE | `/tokens/:id` | PAT revoke et |

### 3.2 Workspace

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/workspaces` | Kullanıcının eriştiği workspace'leri listele |
| POST | `/workspaces` | Yeni workspace oluştur |
| GET | `/workspaces/:id` | Workspace detayı |
| POST | `/workspaces/:id/invitations` | Davetiye linki oluştur |
| POST | `/invitations/:token/accept` | Davetiye linkini kabul et |

### 3.3 Nodes (Pages + Databases + Records)

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/workspaces/:workspaceId/nodes` | Node listele (type filtresi: page, database, record) |
| POST | `/workspaces/:workspaceId/nodes` | Node oluştur |
| GET | `/workspaces/:workspaceId/nodes/:nodeId` | Node oku |
| PATCH | `/workspaces/:workspaceId/nodes/:nodeId` | Node güncelle |
| DELETE | `/workspaces/:workspaceId/nodes/:nodeId` | Node sil |
| GET | `/workspaces/:workspaceId/search` | Workspace içinde arama |

---

## 4. MCP Server Tasarımı

### 4.1 Transport

- **SSE (Server-Sent Events)** over HTTP — Colanode web server'ı zaten Fastify; `/mcp` route'u SSE handler olarak eklenebilir.
- Alternatif: **stdio** ayrı bir binary için. İlk aşamada SSE daha kolay.

### 4.2 Auth

Her MCP request'i `Authorization: Bearer ort_...` header'ı taşır. `pat-auth.ts` plugin aynı şekilde çalışır.

### 4.3 Tool Listesi (İlk Aşama)

| Tool | Açıklama | Input | Output |
|---|---|---|---|
| `create_page` | Workspace içinde yeni sayfa oluştur | `workspace_id`, `name`, `parent_id?`, `content?` | `{ id, name, url }` |
| `list_pages` | Sayfaları listele | `workspace_id`, `parent_id?`, `limit?` | `{ pages: [...] }` |
| `get_page` | Sayfa içeriğini oku | `workspace_id`, `page_id` | `{ id, name, content, updated_at }` |
| `update_page` | Sayfa içeriğini güncelle | `workspace_id`, `page_id`, `content` | `{ id, updated_at }` |
| `create_database` | Yeni database oluştur | `workspace_id`, `name`, `parent_id?`, `fields?` | `{ id, name }` |
| `list_databases` | Database'leri listele | `workspace_id` | `{ databases: [...] }` |
| `create_record` | Database'e kayıt ekle | `workspace_id`, `database_id`, `fields` | `{ id, fields }` |
| `list_records` | Database kayıtlarını listele | `workspace_id`, `database_id`, `limit?` | `{ records: [...] }` |
| `update_record` | Kayıt güncelle | `workspace_id`, `database_id`, `record_id`, `fields` | `{ id, fields }` |
| `search_workspace` | Workspace içinde arama | `workspace_id`, `query`, `limit?` | `{ results: [...] }` |

### 4.4 Tool Handler'lar

Handler'lar mevcut Colanode fonksiyonlarına bağlanacak:

- `lib/nodes.ts` → `createNode`, `fetchNode`
- `lib/documents.ts` → `createDocument`, `fetchDocument`, `updateDocument`
- `lib/records.ts` → `createRecord`, `fetchRecords`
- `lib/embeddings.ts` veya mevcut search service → `search_workspace`

### 4.5 OpenKnowledge'dan Ödünç Alınacaklar

`inkeep/open-knowledge/packages/server/src/mcp` dizininden:

- `@modelcontextprotocol/sdk` server kurulumu
- Tool şeması / Zod → JSON Schema pattern
- Agent identity, tool logging, telemetry pattern
- Error handling (`pretty-zod-errors.ts`)

Tool handler'larının veri katmanı yeniden yazılacak çünkü OpenKnowledge dosya sistemi + git tabanlı, Colanode Postgres + CRDT tabanlı.

---

## 5. Davetiye-Link Akışı

### 5.1 Davetiye Oluşturma

Owner/admin `POST /api/v1/workspaces/:id/invitations` çağrısı yapar:

```json
{
  "email": "arkadas@ornek.com",
  "role": "member"
}
```

Sunucu:
1. `workspace_invitations` tablosuna kayıt ekler (`token` UUID, `expires_at` 7 gün).
2. Eğer email SMTP aktifse email gönderir.
3. Her durumda token'ı döner: `{ "invitationUrl": "https://ortakmasa.192.168.1.101.nip.io/invite/TOKEN" }`.

UI'da bu link kopyalanabilir. Mevcut `users-create.ts` route'u da hâlâ email ile davetiye gönderebilir; yeni endpoint bunun yanında eklenir.

### 5.2 Davetiye Kabulü

Davet edilen kişi linki açar. Zaten kayıtlıysa workspace'e `users` tablosuna eklenir. Kayıtlı değilse önce kayıt olur (`email-register`), sonra davetiye otomatik kabul olur.

`POST /api/v1/invitations/:token/accept`:
1. Token geçerli ve aktif mi kontrol et.
2. Kullanıcı login mi? Değilse önce login/register redirect.
3. `users` tablosuna `Active` user ekle (role: invitation.role).
4. `workspace_invitations.status = Accepted` güncelle.

---

## 6. Coolify Deployment

### 6.1 Gereksinimler

Colanode Docker Compose zaten var: `hosting/docker/docker-compose.yaml`.

Servisler:
- `postgres` (pgvector)
- `valkey` (Redis alternatifi)
- `server` (Colanode API)
- `web` (Colanode web UI)

Coolify'a taşınırken:
- Ayrı resource olarak `postgres`, `valkey`, `server`, `web`.
- `server` ve `web` GitHub repo'dan build edilecek.
- `config.json` secret olarak mount edilecek.
- `POSTGRES_URL`, `REDIS_URL` Coolify environment variables.

### 6.2 Domain

- `ortakmasa.192.168.1.101.nip.io` → web + server aynı domain altında.
- Server API: `/api` veya subdomain `api.ortakmasa.192.168.1.101.nip.io`.
- İlk aşamada tek domain, `/client/v1`, `/api/v1`, `/mcp` path'leri üzerinden.

### 6.3 Config

`apps/server/config.example.json` temel alınarak `config.local.json`:

```json
{
  "name": "Ortakmasa",
  "web": {
    "domain": "ortakmasa.192.168.1.101.nip.io",
    "protocol": "https"
  },
  "mode": "standalone",
  "account": {
    "verificationType": "automatic"
  },
  "postgres": { "url": "env://POSTGRES_URL" },
  "redis": { "url": "env://REDIS_URL" },
  "storage": {
    "provider": { "type": "file" }
  },
  "email": {
    "enabled": false
  }
}
```

---

## 7. Çalışma Planı

| Adım | Kapsam | Tahmini Süre | Durum |
|---|---|---|---|
| 1 | Public API route yapısı + PAT auth + `api_tokens` tablosu + migration | 5-7 gün | ✅ Tamamlandı |
| 2 | Node/page CRUD public API endpoint'leri | 4-5 gün | ✅ Tamamlandı |
| 3 | Database/record CRUD public API endpoint'leri | 3-4 gün | ✅ Tamamlandı |
| 4 | Davetiye-link tablosu + endpoint'leri + UI akışı | 3-5 gün | ✅ Tamamlandı |
| 5 | MCP server kurulumu (SSE) + PAT auth | 3-4 gün | ✅ Tamamlandı |
| 6 | MCP tools: create/list/get/update page, database, record | 5-7 gün | ✅ Tamamlandı |
| 7 | Coolify deploy config + S3 / MinIO entegrasyonu + test | 3-5 gün | ✅ Tamamlandı |
| 8 | Bearer / PAT UI yönetimi (Token oluşturma, listeleme, silme, MCP config kopyalama) | 2 gün | ✅ Tamamlandı |
| 9 | UI RAG asistan aktifleştirme (opsiyonel, sonraki aşama) | 5-7 gün | Planlandı |

**Toplam tahmini süre (MCP CRUD + public API + davetiye + deploy):** 4-6 hafta.

---

## 8. Riskler

1. **Colanode pre-1.0** — mimari değişikliği yüksek. Her upgrade'de conflict çözme ihtiyacı.
2. **CRDT/local-first** — public API yazarken mevcut sync mekanizmasını kırmamak gerek. Node create/update işlemleri `lib/nodes.ts` üzerinden yapılmalı, doğrudan SQL yazılmamalı.
3. **PAT güvenliği** — token leakage riski. Scopes (read/write) ve revoke zorunlu.
4. **Embedding/search** — `search_workspace` tool'u için mevcut pgvector/full-text search altyapısını anlamak gerek.

---

## 9. Sonraki Adım

Teknik tasarım onaylandıktan sonra implementasyon başlayabilir. İlk adım **Adım 1: Public API route yapısı + PAT auth + api_tokens migration** olacak.

Implementation için önerilen profil: **Claude Code** veya **Codex** — monorepo + Fastify + Kysely + TypeScript deneyimi gerektirir.
