# Task (Hermes) — Deploy finansial-planer publik di financial.epslab.id

**Owner:** Hermes (DevOps/infra) · **Requested by:** Fitra
**Goal:** Publikasikan app ini ke **https://financial.epslab.id** (GitHub Pages + domain sendiri).
**Access needed:** Cloudflare (zona `epslab.id`) + repo GitHub.
**Protocol:** Per `.agents/COLLABORATION.md` — perubahan repo di branch `hermes/*` + draft PR (Fitra merge); DNS & Pages settings = infra langsung.

## Fakta teknis
- App = Vite + React + TS, **static build** (`dist/`), pakai **HashRouter** (routing aman).
- Disajikan di **root domain** (`financial.epslab.id`), jadi build pakai **base `/`** (default) — **jangan** pakai `--base=/finansial-planer/` (itu hanya untuk URL `github.io/finansial-planer/`). Salah base = asset 404.
- Data local-first (IndexedDB) per-perangkat; deploy hanya soal akses, bukan sync.

---

## 1. DNS di Cloudflare (zona epslab.id)
```
Type: CNAME
Name: financial
Target: fitravertikal.github.io
Proxy: DNS only (awan abu-abu)   ← wajib saat provisioning cert GitHub
TTL: Auto
```
> DNS-only dulu supaya GitHub bisa terbitkan sertifikat Let's Encrypt. Setelah HTTPS aktif, boleh nyalakan proxy (oranye) dengan **SSL mode: Full** (jangan Flexible — bisa redirect loop).

## 2. Repo (branch `hermes/custom-domain` → draft PR → Fitra merge)

**a. `public/CNAME`** (Vite menyalin `public/` ke root `dist/`):
```
financial.epslab.id
```

**b. `.github/workflows/deploy.yml`** — build base root + publish ke Pages:
```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npx vite build          # base '/' (root) untuk custom domain
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

## 3. Aktifkan Pages + set custom domain (GitHub)
```bash
gh api repos/fitravertikal/finansial-planer/pages -X POST -f build_type=workflow 2>/dev/null || true
gh api repos/fitravertikal/finansial-planer/pages -X PUT  -f cname=financial.epslab.id -f build_type=workflow
```
(atau Settings → Pages → Source: GitHub Actions + Custom domain: `financial.epslab.id`)

## 4. Cert + Enforce HTTPS
Setelah "DNS check successful" & cert terbit (beberapa menit s/d ~1 jam):
```bash
gh api repos/fitravertikal/finansial-planer/pages -X PUT -F https_enforced=true
```
(atau centang **Enforce HTTPS** di Settings → Pages)

## 5. Verifikasi
- `https://financial.epslab.id` termuat; bisa catat transaksi, set budget, lihat dashboard dari HP.
- `http://…` redirect ke `https://…` setelah Enforce HTTPS.

## 6. Report
Konfirmasi: DNS propagate, custom domain OK, HTTPS aktif, URL live. Boleh update `SETUP_REPORT.md` di `skills`.

---

### Urutan aman
DNS CNAME → merge PR (deploy base root) → set custom domain → tunggu cert → Enforce HTTPS.
