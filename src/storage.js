// window.storage shim used by App.jsx.
//
// Two modes, chosen automatically at startup:
//
// 1. SHARED / LIVE (Supabase) — used when VITE_SUPABASE_URL and
//    VITE_SUPABASE_ANON_KEY are set (see .env.example). Data is stored in a
//    Postgres table and pushed to every connected browser in real time via
//    Supabase Realtime, so a report submitted on one device appears on every
//    other open tab/device within a second or two, with no reload needed.
//    Photos uploaded via the Report Breakdown form go to a Supabase Storage
//    bucket (see supabase/schema.sql) and are stored as a public URL.
//
// 2. LOCAL ONLY (localStorage) — used automatically when Supabase isn't
//    configured, e.g. before you've set up a project, or if you just want to
//    poke around locally. Data stays on that one browser. Also syncs between
//    tabs on the same browser via the native `storage` event, for convenience.
//    Photos in this mode are inlined as base64 data URIs directly in the
//    record — fine for local testing, but localStorage only holds a few MB
//    total, so this isn't meant for real day-to-day use with many photos.
//
// App.jsx only ever calls window.storage.get/set/delete/list/subscribe/
// uploadImage — it doesn't know or care which mode is active.
// `window.storage.mode` is read by App.jsx purely to show the
// "Live — shared" vs "Local only" badge.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const TABLE = 'kv_store';
const PHOTO_BUCKET = 'breakdown-photos';

const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let storage;

if (hasSupabase) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  storage = {
    mode: 'supabase',

    async get(key, shared = false) {
      const { data, error } = await supabase
        .from(TABLE)
        .select('value')
        .eq('key', key)
        .eq('shared', shared)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(`Key not found: ${key}`);
      return { key, value: JSON.stringify(data.value), shared };
    },

    async set(key, value, shared = false) {
      const parsed = JSON.parse(value);
      const { error } = await supabase
        .from(TABLE)
        .upsert(
          { key, shared, value: parsed, updated_at: new Date().toISOString() },
          { onConflict: 'key,shared' }
        );
      if (error) throw error;
      return { key, value, shared };
    },

    async delete(key, shared = false) {
      const { error } = await supabase.from(TABLE).delete().eq('key', key).eq('shared', shared);
      if (error) throw error;
      return { key, deleted: true, shared };
    },

    async list(prefix = '', shared = false) {
      const { data, error } = await supabase
        .from(TABLE)
        .select('key')
        .eq('shared', shared)
        .like('key', `${prefix}%`);
      if (error) throw error;
      return { keys: (data || []).map((r) => r.key), prefix, shared };
    },

    // Push-based live updates. onChange receives the already-parsed value
    // (not a JSON string) whenever any client inserts/updates/deletes the row
    // for this key. Returns an unsubscribe function.
    subscribe(key, shared, onChange) {
      const channel = supabase
        .channel(`kv-${key}-${shared ? 'shared' : 'local'}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: TABLE, filter: `key=eq.${key}` },
          (payload) => {
            const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
            if (!row || row.shared !== shared) return;
            onChange(row.value);
          }
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    },
    // Uploads a File/Blob (already resized client-side by App.jsx) to
    // Supabase Storage and returns a public URL to store on the record.
    async uploadImage(fileOrBlob) {
      const ext = (fileOrBlob.name && fileOrBlob.name.includes('.'))
        ? fileOrBlob.name.split('.').pop().toLowerCase()
        : 'jpg';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || 'jpg'}`;
      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, fileOrBlob, { contentType: fileOrBlob.type || 'image/jpeg', upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
      return data.publicUrl;
    },
  };
} else {
  const NAMESPACE = 'tunisi-kv';
  const storageKey = (key, shared) => `${NAMESPACE}:${shared ? 'shared' : 'local'}:${key}`;

  storage = {
    mode: 'local',

    async get(key, shared = false) {
      const raw = window.localStorage.getItem(storageKey(key, shared));
      if (raw === null) throw new Error(`Key not found: ${key}`);
      return { key, value: raw, shared };
    },

    async set(key, value, shared = false) {
      window.localStorage.setItem(storageKey(key, shared), value);
      return { key, value, shared };
    },

    async delete(key, shared = false) {
      window.localStorage.removeItem(storageKey(key, shared));
      return { key, deleted: true, shared };
    },

    async list(prefix = '', shared = false) {
      const fullPrefix = storageKey(prefix, shared);
      const keys = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(fullPrefix)) keys.push(k.slice(storageKey('', shared).length));
      }
      return { keys, prefix, shared };
    },

    // Not truly live across devices, but at least keeps multiple tabs on the
    // SAME browser in sync, using the native storage event.
    subscribe(key, shared, onChange) {
      const target = storageKey(key, shared);
      const handler = (e) => {
        if (e.key !== target || e.newValue === null) return;
        try { onChange(JSON.parse(e.newValue)); } catch (err) {}
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    },
    // No object storage locally, so just inline the image as a data URI.
    // Fine for local testing; not meant for heavy real-world photo use.
    async uploadImage(fileOrBlob) {
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read image'));
        reader.readAsDataURL(fileOrBlob);
      });
    },
  };

  if (typeof window !== 'undefined' && !SUPABASE_URL && !SUPABASE_ANON_KEY) {
    console.info(
      '[tunisi-app] No Supabase credentials found — running in local-only mode. ' +
      'See README.md → "Wiring up real shared/live data with Supabase" to enable shared live storage.'
    );
  }
}

if (typeof window !== 'undefined') {
  window.storage = storage;
}

export default storage;