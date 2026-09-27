/* ============================================
   SacraDigit — Shared Livestream Status (AWS Amplify)
   Used by Sacramedia/livestream.js (media team sets it),
   Sacramedia/media-dashboard.js (stat card), and
   user/user-dashboard.js ("Watch Live" banner).

   - LivestreamStatus  — ONE record = current status
       (anyone can read it; media/admin can change it)
   - LivestreamSession — one record per "Go Live", for history
       (media/admin only)
   ============================================ */

const OFF = { id: null, isLive: false, platform: 'Facebook', url: '', updatedAt: '' };

function toStatus(record) {
  if (!record) return { ...OFF };
  return {
    id: record.id,
    isLive: !!record.isLive,
    platform: record.platform || 'Facebook',
    url: record.url || '',
    updatedAt: record.updatedAt || record.createdAt || '',
  };
}

/** Live-subscribe to the current status. Calls onChange(status) on every update. */
export function watchLivestream(client, onChange) {
  return client.models.LivestreamStatus.observeQuery().subscribe({
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
  const fields = { isLive, platform, url };
  const result = current && current.id
    ? await client.models.LivestreamStatus.update({ id: current.id, ...fields })
    : await client.models.LivestreamStatus.create(fields);
  if (result.errors?.length) throw new Error(result.errors.map(e => e.message).join('; '));
  return toStatus(result.data);
}

/** Record a "Go Live" in the shared history. */
export async function addLivestreamHistory(client, { platform, url }) {
  const result = await client.models.LivestreamSession.create({ platform, url, startedAt: new Date().toISOString() });
  if (result.errors?.length) throw new Error(result.errors.map(e => e.message).join('; '));
}

/** Live-subscribe to past streams, newest first: [{ platform, url, startedAt }]. */
export function watchLivestreamHistory(client, onChange) {
  return client.models.LivestreamSession.observeQuery().subscribe({
    next: ({ items }) => onChange(items
      .map(r => ({ platform: r.platform, url: r.url, startedAt: r.startedAt || r.createdAt }))
      .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))),
    error: (err) => console.error('Failed to load livestream history:', err),
  });
}
