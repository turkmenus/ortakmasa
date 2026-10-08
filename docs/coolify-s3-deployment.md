# Ortakmasa - Coolify ve S3 Altyapısı Dağıtım Rehberi

Bu rehber, **Ortakmasa** (Colanode forku) uygulamasının Coolify üzerinde PostgreSQL (pgvector), Valkey (Redis), S3 uyumlu nesne depolama (MinIO veya Cloudflare R2 / AWS S3) ve dahili Nginx ters vekili (reverse proxy) ile eksiksiz kurulumunu adım adım açıklar.

---

## 1. Mimari Genel Bakış

Coolify üzerindeki Ortakmasa mimarisi 5 temel bileşenden oluşur:

```
                               ┌────────────────────────────────────────────────┐
                               │                    Coolify                     │
                               │           (Traefik Reverse Proxy + SSL)         │
                               └───────────────────────┬────────────────────────┘
                                                       │
                                   https://ortakmasa.yourdomain.com
                                                       │
                                                       ▼
                                     ┌────────────────────────────────────┐
                                     │            ortakmasa_web           │
                                     │          (Nginx + Web UI)          │
                                     │                                    │
                                     │  /             ──> Web UI (SPA)    │
                                     │  /api/v1/*     ──┐                 │
                                     │  /client/v1/*  ──┤ Reverse Proxy   │
                                     │  /mcp/*        ──┤ (SSE/WS/TUS)    │
                                     │  /config       ──┘                 │
                                     └─────────────────┬──────────────────┘
                                                       │ (Internal Docker)
                                                       ▼
                                     ┌────────────────────────────────────┐
                                     │           ortakmasa_server         │
                                     │         (Fastify API + MCP)        │
                                     └─────┬───────────┬────────────┬─────┘
                                           │           │            │
                         ┌─────────────────┴─┐   ┌─────┴──────┐   ┌─┴────────────────┐
                         │ ortakmasa_postgres │   │  valkey    │   │  S3 Depolama     │
                         │ (pg17 + pgvector) │   │  (Redis)   │   │  (MinIO veya R2) │
                         └───────────────────┘   └────────────┘   └──────────────────┘
```

### Tek Domain Avantajı
`apps/web` Docker imajı içindeki Nginx konfigürasyonu, `/api/v1`, `/client/v1`, `/mcp` ve `/config` endpoint'lerini arka plandaki `server:3000` konteynerine otomatik yönlendirir. Böylece:
- Web UI ve API **aynı domain** üzerinde çalışır (CORS hatası yaşanmaz).
- MCP SSE ve istemci CRDT senkronizasyonu için ek alt alan adı (subdomain) gerekmez.
- Tus dosya yüklemeleri için 500MB'a kadar doğrudan destek sağlanır.

---

## 2. Depolama (S3) Seçenekleri

Ortakmasa, AWS S3 API uyumlu tüm nesne depolama servislerini destekler. İki yaygın senaryo:

### Seçenek A: Dahili MinIO (Self-hosted, Sıfır Maliyet)
Docker Compose yığınında hazır gelen MinIO konteyneri kullanılır. Konteyner ayağa kalkarken `S3_BUCKET` dizinini otomatik oluşturur.
- **S3_ENDPOINT**: `http://minio:9000`
- **S3_FORCE_PATH_STYLE**: `true`
- **S3_REGION**: `us-east-1`

### Seçenek B: Cloudflare R2 (Önerilen Bulut Seçeneği)
10 GB ücretsiz depolama, **0 $ çıkış (egress) ücreti**:
- Cloudflare Dashboard'dan R2 Bucket oluşturun (örn: `ortakmasa`).
- R2 API Token üretin (Object Read & Write yetkisiyle).
- **S3_ENDPOINT**: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- **S3_ACCESS_KEY**: `<R2_ACCESS_KEY_ID>`
- **S3_SECRET_KEY**: `<R2_SECRET_ACCESS_KEY>`
- **S3_BUCKET**: `ortakmasa`
- **S3_REGION**: `auto`
- **S3_FORCE_PATH_STYLE**: `false`

### Seçenek C: AWS S3
- **S3_ENDPOINT**: `https://s3.<region>.amazonaws.com`
- **S3_ACCESS_KEY**: `<AWS_ACCESS_KEY_ID>`
- **S3_SECRET_KEY**: `<AWS_SECRET_ACCESS_KEY>`
- **S3_BUCKET**: `ortakmasa`
- **S3_REGION**: `eu-central-1`
- **S3_FORCE_PATH_STYLE**: `false`

---

## 3. Coolify ile Dağıtım (Adım Adım)

### Yöntem 1: Coolify Docker Compose Kaynağı (En Kolay)

1. Coolify panelinize giriş yapın.
2. İlgili Proje ve Ortam içinde **+ New Resource** → **Docker Compose** seçin.
3. Repository olarak Ortakmasa GitHub reponuzu bağlayın.
4. Compose dosya yolu olarak:
   ```
   hosting/coolify/docker-compose.yaml
   ```
   belirtin veya içeriği doğrudan Coolify compose editörüne yapıştırın.
5. **Environment Variables** bölümüne aşağıdaki değişkenleri girin (veya `hosting/coolify/.env.example` dosyasını kopyalayın):

```bash
# Domain ayarları
APP_DOMAIN=ortakmasa.192.168.1.101.nip.io
APP_PROTOCOL=https
WEB_PORT=80

# Veritabanı ve Önbellek
POSTGRES_USER=colanode_user
POSTGRES_PASSWORD=guclu_bir_veritabani_sifresi
POSTGRES_DB=colanode_db
REDIS_PASSWORD=guclu_bir_redis_sifresi

# S3 / MinIO Ayarları
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=guclu_bir_minio_sifresi
S3_BUCKET=ortakmasa
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

6. Coolify'da `web` servisine domain olarak alan adınızı tanımlayın (örn. `https://ortakmasa.192.168.1.101.nip.io`).
7. **Deploy** butonuna tıklayın.

---

## 4. Ortam Değişkenleri Referans Tablosu

| Değişken | Varsayılan Değer | Açıklama |
|---|---|---|
| `APP_DOMAIN` | `localhost:4000` | Uygulamanın yayınlandığı FQDN |
| `APP_PROTOCOL` | `https` | `http` veya `https` |
| `POSTGRES_URL` | *(Otomatik üretilir)* | `postgres://user:pass@postgres:5432/db` |
| `REDIS_URL` | *(Otomatik üretilir)* | `redis://:pass@valkey:6379/0` |
| `STORAGE_PROVIDER` | `s3` | Depolama tipi (`s3` veya `file`) |
| `S3_ENDPOINT` | `http://minio:9000` | S3 API uç noktası |
| `S3_ACCESS_KEY` | `minioadmin` | S3 Access Key / Kullanıcı adı |
| `S3_SECRET_KEY` | - | S3 Secret Key / Parola |
| `S3_BUCKET` | `ortakmasa` | Dosyaların saklanacağı bucket |
| `S3_REGION` | `us-east-1` | S3 bölgesi (R2 için `auto`) |
| `S3_FORCE_PATH_STYLE`| `true` | MinIO için `true`, AWS/R2 için `false` |

---

## 5. Doğrulama ve Test Adımları

Dağıtım tamamlandıktan sonra aşağıdaki kontrolleri gerçekleştirin:

### 1. Sunucu Konfigürasyon Kontrolü
```bash
curl -s https://ortakmasa.yourdomain.com/config | jq .
```
Yanıt olarak sunucu adı (`Ortakmasa`) ve yetenekler dönmelidir.

### 2. Public API ve Token Testi
```bash
curl -s https://ortakmasa.yourdomain.com/api/v1/workspaces \
  -H "Authorization: Bearer colanode_pat_SIZIN_TOKENINIZ"
```

### 3. MCP SSE Uç Noktası
```bash
curl -N -H "Accept: text/event-stream" \
  -H "Authorization: Bearer colanode_pat_SIZIN_TOKENINIZ" \
  https://ortakmasa.yourdomain.com/mcp
```
`endpoint` SSE mesajı akmalıdır.

### 4. Dosya Yükleme (Tus / S3)
Web arayüzünde herhangi bir sayfaya görsel veya dosya sürükleyip bırakarak yüklemenin S3 bucket'ına yazıldığını doğrulayın. MinIO konsoluna (`http://your-server-ip:9001`) girerek dosyaların `ortakmasa` bucket'ı altına geldiğini görebilirsiniz.
