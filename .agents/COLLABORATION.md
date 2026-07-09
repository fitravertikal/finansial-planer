# Protokol Kolaborasi Agent

GitHub adalah **satu-satunya kanal bersama** antara Hermes dan Claude Code.
Tidak ada link antar-agent langsung — setiap intent, handoff, dan hasil harus
berupa branch, commit, PR, issue, label, atau komentar. Kalau tidak ada di
GitHub, agent lain tidak bisa melihatnya.

File ini template portabel. Salin ke setiap repo yang ikut workspace, dan jaga
tetap identik di semua repo agar kedua agent bisa mengandalkan satu protokol.
Pendampingnya: `.agents/TOPOLOGY.md` (siapa di mana & surface mana yang dipakai).

## Identitas & Batas

| Aturan | Detail |
|---|---|
| **Commit identity** | Hermes: commit sebagai Hermes + trailer `Co-Authored-By: Hermes <hermes@epslab.id>`. Claude: `Co-Authored-By: Claude <claude@anthropic.com>`. Jangan menyamar atau mengedit commit agent lain. |
| **Branch ownership** | Hermes memiliki `hermes/*`, Claude memiliki `claude/*`. Hanya commit di branch milik sendiri. |
| **Force-push** | Jangan pernah force-push branch yang bukan milikmu. |
| **Authority ≠ permission** | Hermes punya otoritas penuh ke semua repo, tapi tetap patuh aturan ini sebagai kebijakan — seperti engineer senior yang punya admin tapi tetap ikut proses. Bagian yang bisa dipaksakan (branch protection, required review) dikonfigurasi di GitHub; sisanya dihormati atas dasar kepercayaan. |

## Workflow: Satu Tugas = Satu Issue

```
Issue → Branch → PR (draft) → Handoff → Review → Ready → Merge (Fitra)
```

1. **Satu tugas = satu GitHub issue.** Branch & PR merujuk padanya (`Fixes #N`).
2. **Semua PR mulai sebagai draft.** Tandai `ready for review` hanya saat yakin mergeable.
3. **Handoff eksplisit.** Saat ingin agent lain bertindak:
   - Posting **satu** komentar berisi:
     - **Done**: apa yang kamu ubah (tautkan commit/PR)
     - **Want**: aksi berikutnya yang diminta
     - **Context**: yang tak jelas dari diff
   - Lepas label `agent:wip`, tambah `needs:claude` / `needs:hermes` (atau `agent:review`), assign ke agent berikutnya.
   - **Berhenti** mengerjakan issue itu sampai dikembalikan.
4. **Bertindak hanya atas labelmu.** Ambil kerjaan berlabel untukmu (ganti jadi `agent:wip` saat mulai). Jangan bertindak atas label buatan aksimu sendiri, jangan balas komentarmu sendiri.

## Loop Guard

Jika satu issue bolak-balik antar agent **3× tanpa jadi ready**:
- Tambah label `agent:blocked`
- Tulis catatan singkat "di mana macetnya"
- Tunggu Fitra. Jangan lempar tugas tanpa henti.

## Konflik & Merge

- **Konflik:** rebase branch **milikmu sendiri** ke base terbaru, resolve, force-push
  hanya branch milikmu. Kalau konflik ada di logika yang bukan wewenangmu, kembalikan
  dengan `needs:<agent lain>` daripada menebak.
- **Satu penulis per branch:** prefix kepemilikan + nama branch per-tugas mencegah dua
  aktor berebut ref yang sama.
- **Merge gate:** **jangan merge ke `main`.** Siapkan & review PR; **Fitra yang merge.**
  Ini kebijakan, bukan sekadar batasan teknis.

## Reaksi ke State

Baca ulang state issue/PR terkini sebelum bertindak — baton mungkin sudah berpindah.
Jangan mengandalkan notifikasi basi atau asumsi.

## Referensi Label

| Label | Arti | Warna |
|---|---|---|
| `needs:claude` | Menunggu aksi Claude Code | `0969DA` |
| `needs:hermes` | Menunggu aksi Hermes | `BF8700` |
| `agent:review` | Menunggu review dari agent lain | `8250DF` |
| `agent:blocked` | Terblokir — butuh intervensi Fitra | `CF222E` |
| `agent:wip` | Sedang dikerjakan agent | `1A7F37` |

**Aturan emas anti-loop:** agent hanya bertindak atas label yang ditujukan padanya,
dan menghapus label itu (ganti `agent:wip`) saat mengambil kerjaan. Agent tidak pernah
memasang ulang label yang ditujukan ke dirinya sendiri.
