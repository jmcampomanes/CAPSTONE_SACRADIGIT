/* ============================================
   mass-types.js — place at project root, next to
   ph-locations.js / saint-names.js / amplify-init.js.

   Single source of truth for the Mass model's `type`
   field — the deployed MassType enum is exactly these
   4 values ('daily' | 'anticipated' | 'special' |
   'binyag'; see the note this same file's callers used
   to duplicate in Sacradigit/seed-mock-masses-schedules.js).
   Each entry carries a friendly label, a short
   description of what actually makes that Mass
   different from the others, and a distinct color so a
   requester or admin scanning a list of masses can tell
   them apart at a glance instead of relying on a single
   generic "Special" tag. Shared between the admin
   (Sacradigit/masses.js) and parishioner
   (user/user-mass-schedule.js) Mass Schedule pages so
   the two sides always agree on what each type means and
   looks like.
   ============================================ */

export const MASS_TYPES = {
  daily: {
    label: 'Daily Mass',
    desc: 'The regular Mass held on weekdays and Sunday mornings.',
    color: '#5b5fa8',
    bg: 'rgba(139,143,199,0.14)',
  },
  anticipated: {
    label: 'Anticipated Mass',
    desc: 'Saturday evening Mass that fulfills the Sunday obligation.',
    color: '#b5943e',
    bg: 'rgba(201,168,76,0.16)',
  },
  special: {
    label: 'Special Mass',
    desc: 'A one-time Mass for a feast day, devotion, or parish occasion.',
    color: '#dc2626',
    bg: 'rgba(239,68,68,0.12)',
  },
  binyag: {
    label: 'Baptism Mass',
    desc: 'Mass celebrated alongside a baptism.',
    color: '#15803d',
    bg: 'rgba(21,128,61,0.12)',
  },
};

// Fallback for a `type` value that somehow isn't one of the 4 above
// (e.g. old/bad data) — keeps rendering from breaking instead of
// throwing on `MASS_TYPES[type].label`.
const FALLBACK_TYPE = { label: 'Mass', desc: '', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' };

export function massTypeInfo(type) {
  return MASS_TYPES[type] || FALLBACK_TYPE;
}

/** A small colored pill naming the Mass's type — meant to sit next to
    every rendered Mass entry (list rows, calendar cells, day-plan
    items, details modals) on both the admin and user pages, so the
    same visual language marks what kind of Mass it is everywhere. */
export function massTypeBadgeHtml(type) {
  const info = massTypeInfo(type);
  return `<span class="mass-type-badge" style="color:${info.color};background-color:${info.bg};">${info.label}</span>`;
}

/** A compact legend explaining what each of the 4 Mass types means —
    meant to sit once near the top of a Mass Schedule page so the
    badges above are never just an unexplained color. */
export function massTypeLegendHtml() {
  return Object.entries(MASS_TYPES).map(([key, info]) => `
    <div class="mass-legend-item">
      <span class="mass-type-badge" style="color:${info.color};background-color:${info.bg};">${info.label}</span>
      <span class="mass-legend-desc">${info.desc}</span>
    </div>`).join('');
}