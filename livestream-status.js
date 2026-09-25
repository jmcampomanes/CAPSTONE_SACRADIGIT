/* ============================================
   SacraDigit — Shared Livestream Status (AWS Amplify)
   Used by Sacramedia/livestream.js (media team sets it),
   Sacramedia/media-dashboard.js (stat card), and
   user/user-dashboard.js ("Watch Live" banner).

   There's no Livestream model in the backend schema, so
   the status rides on the existing CloudFile model in
   folders no other page lists (Sacra ITech Cloud Access only shows
   its own named folders; the Media Library only reads
   folder 'media'):

   - folder 'livestream'          — ONE record = current status
       name  -> platform (e.g. "Facebook")
       url   -> stream link
       bytes -> 1 when live, 0 when off
   - folder 'livestream-history'  — one record per "Go Live"
       name -> platform, url -> link, createdAt -> start time

   If a Livestream model is added to the backend later,
   only this file needs to change.
   ============================================ */

const STATUS_FOLDER = 'livestream';
const HISTORY_FOLDER = 'livestream-history';

const OFF = { id: null, isLive: false, platform: 'Facebook', url: '', updatedAt: '' };

function toStatus(record) {
  if (!record) return { ...OFF };
  return {
    id: record.id,
    isLive: record.bytes === 1,
    platform: record.name || 'Facebook',
    url: record.url || '',
    updatedAt: record.updatedAt || record.createdAt || '',
  };
}

/** Live-subscribe to the current status. Calls onChange(status) on every update. */
export function watchLivestream(client, onChange) {
  return client.models.CloudFile.observeQuery({ filter: { folder: { eq: STATUS_FOLDER } } }).subscribe({
    next: ({ items }) => {
      // Should be one record; if two ever exist, the newest wins.
      const latest = items.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
      onChange(toStatus(latest));
    },
    error: (err) => {
      console.error('Failed to load livestream status:', err);
      onChange({ ...OFF });
    },
  });
}

/** Create or update the single status record. `current` is the last status from watchLivestream. */
export async function saveLivestream(client, current, { isLive, platform, url }) {
  const fields = { name: platform, url, bytes: isLive ? 1 : 0, folder: STATUS_FOLDER };
  const result = current && current.id
    ? await client.models.CloudFile.update({ id: current.id, ...fields })
    : await client.models.CloudFile.create(fields);
  if (result.errors?.length) throw new Error(result.errors.map(e => e.message).join('; '));
  return toStatus(result.data);
}

/** Record a "Go Live" in the shared history. */
export async function addLivestreamHistory(client, { platform, url }) {
  const result = await client.models.CloudFile.create({ name: platform, url, bytes: 0, folder: HISTORY_FOLDER });
  if (result.errors?.length) throw new Error(result.errors.map(e => e.message).join('; '));
}

/** Live-subscribe to past streams, newest first: [{ platform, url, startedAt }]. */
export function watchLivestreamHistory(client, onChange) {
  return client.models.CloudFile.observeQuery({ filter: { folder: { eq: HISTORY_FOLDER } } }).subscribe({
    next: ({ items }) => onChange(items
      .map(r => ({ platform: r.name, url: r.url, startedAt: r.createdAt }))
      .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))),
    error: (err) => console.error('Failed to load livestream history:', err),
  });
}
