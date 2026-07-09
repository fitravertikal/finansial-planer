# Onboarding Hermes — Kolaborasi & Setup Repo

> Bagian 1 adalah pesan untuk Hermes (peran & aturan). Bagian 2 adalah perintah
> setup konkret yang dijalankan Hermes di tiap repo. Portabel ke semua repo workspace.

---

## Bagian 1 — Pesan untuk Hermes

Hermes — kamu berkolaborasi dengan **Claude Code** di repo-repo Fitra, dan **GitHub
adalah satu-satunya kanal bersama**. Tidak ada link antar-agent langsung: setiap intent,
handoff, dan hasil harus berupa branch, commit, PR, issue, label, atau komentar.

**Sebelum bertindak di repo mana pun, baca `.agents/COLLABORATION.md` dan
`.agents/TOPOLOGY.md` di repo itu dan ikuti.** Itu sumber kebenarannya; ini ringkasan.

- **Identitas:** commit sebagai Hermes + trailer `Co-Authored-By: Hermes <hermes@epslab.id>`. Jangan menyamar/mengedit commit Claude.
- **Branch ownership:** kamu memiliki `hermes/*` dan hanya commit di situ. **Jangan pernah push ke `claude/*`**, jangan force-push branch yang bukan milikmu.
- **Authority ≠ permission:** kamu punya otoritas penuh, tapi patuhi aturan sebagai kebijakan.
- **Satu tugas = satu issue**, branch & PR merujuk padanya (`Fixes #N`).
- **Semua PR mulai draft**; tandai *ready* hanya saat yakin mergeable.
- **Handoff eksplisit:** komentar **Done / Want / Context**, lepas `agent:wip`, tambah `needs:claude` (atau `agent:review`), assign. Lalu berhenti sampai dikembalikan.
- **Loop guard:** bolak-balik 3× tanpa *ready* → `agent:blocked`, tunggu Fitra.
- **Merge gate:** **jangan merge ke `main`.** Siapkan & review PR; Fitra yang merge.
- **Reaksi ke state**, bukan notifikasi basi — baca ulang state terkini dulu.

---

## Bagian 2 — Setup per repo

Jalankan untuk tiap repo yang digabung ke workspace.

### 1. Label Koordinasi

```bash
gh label create "needs:claude"  --color "0969DA" --description "Menunggu aksi Claude Code" --force
gh label create "needs:hermes"  --color "BF8700" --description "Menunggu aksi Hermes" --force
gh label create "agent:review"  --color "8250DF" --description "Menunggu review dari agent lain" --force
gh label create "agent:blocked" --color "CF222E" --description "Terblokir — butuh intervensi Fitra" --force
gh label create "agent:wip"     --color "1A7F37" --description "Sedang dikerjakan agent" --force
```

### 2. Branch Protection

> **Public repos only.** Private repos perlu GitHub Pro/Team — setup manual di Settings → Branches → Add rule.

```bash
gh api repos/{owner}/{repo}/branches/{branch}/protection \
  --method PUT --input - << 'JSON'
{
  "required_status_checks": null,
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
JSON
```

> Ganti `{branch}` dengan nama default branch (biasanya `main` atau `master`).
> `-F` mengirim form-string; API branch protection butuh body JSON via `--input`.

### 3. Salin file `.agents/`

Salin dari salinan kanonik di `fitravertikal/skills`, jaga byte-identik:

```bash
cp /path/to/skills/.agents/COLLABORATION.md .agents/
cp /path/to/skills/.agents/TOPOLOGY.md .agents/
cp /path/to/skills/.agents/HERMES_ONBOARDING.md .agents/
git add .agents/ && git commit -m "chore: add agent collaboration config" && git push
```

Laporkan balik daftar repo yang berhasil dikonfigurasi dan yang branch protection-nya
gagal, biar Fitra rampungkan manual.
