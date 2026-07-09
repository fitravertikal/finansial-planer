import { useEffect, useRef, useState } from 'react';
import { useSaveSyncConfig, useSyncMeta, useSyncNow } from '../../hooks/useSync';
import { db } from '../../data';
import { buildBackup, parseBackup, restoreBackup, serializeBackup } from '../../data/backup';

export function SettingsScreen() {
  const { data: meta } = useSyncMeta();
  const saveConfig = useSaveSyncConfig();
  const sync = useSyncNow();
  const fileRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  useEffect(() => {
    if (meta) {
      setUrl(meta.syncUrl ?? 'https://sync.epslab.id');
      setKey(meta.syncKey ?? '');
    }
  }, [meta]);

  async function exportBackup() {
    const json = serializeBackup(await buildBackup(db));
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `finansial-planer-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importBackup(file: File) {
    if (!window.confirm('Impor akan MENGGANTI semua data saat ini. Lanjut?')) return;
    const backup = parseBackup(await file.text());
    await restoreBackup(db, backup);
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      {/* Sync */}
      <section className="rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="text-sm font-semibold">Sync antar perangkat</h2>
        <label className="block">
          <span className="text-xs text-gray-500">Server URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Space key</span>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="tempel key dari perangkat lain / Hermes"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <p className="text-xs text-gray-400">
          Key disimpan hanya di perangkat ini (tidak pernah masuk repo). Pakai key yang sama di HP &amp; laptop untuk data yang sama.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => saveConfig.mutate({ url, key })}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Simpan
          </button>
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending || !meta?.syncKey}
            className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {sync.isPending ? 'Menyinkron…' : 'Sync sekarang'}
          </button>
        </div>
        {sync.isSuccess && (
          <p className="text-xs text-emerald-600">
            Sinkron OK — {sync.data.pulled} masuk, {sync.data.pushed} terkirim.
          </p>
        )}
        {sync.isError && <p className="text-xs text-red-600">{(sync.error as Error).message}</p>}
        {meta?.lastSyncedAt && (
          <p className="text-xs text-gray-400">Terakhir sync: {new Date(meta.lastSyncedAt).toLocaleString('id-ID')}</p>
        )}
      </section>

      {/* Backup */}
      <section className="rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="text-sm font-semibold">Backup lokal (JSON)</h2>
        <p className="text-xs text-gray-400">Data hanya di browser ini. Ekspor rutin sebagai cadangan.</p>
        <div className="flex gap-2">
          <button onClick={exportBackup} className="flex-1 rounded-lg bg-gray-100 py-2 text-sm font-semibold text-gray-700">
            Ekspor
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex-1 rounded-lg bg-gray-100 py-2 text-sm font-semibold text-gray-700">
            Impor
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importBackup(f);
              e.target.value = '';
            }}
          />
        </div>
      </section>
    </div>
  );
}
