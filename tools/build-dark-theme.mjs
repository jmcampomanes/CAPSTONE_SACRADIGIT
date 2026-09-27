/* ============================================
   SacraDigit — dark theme generator
   Run:  node tools/build-dark-theme.mjs
   Writes: theme-dark.css (project root)

   Every app stylesheet was written for a light
   page. Instead of hand-writing a dark copy of
   each, this reads them all and, for every rule
   that uses a light colour, writes the same rule
   under :root[data-theme="dark"] with a dark
   equivalent:
     white / near-white backgrounds → dark slate
     dark text                      → light text
     coloured text                  → lighter shade
     light borders                  → dark borders
   Dark backgrounds (navy headers, gold/lavender
   buttons) are left alone, and so is the text on
   them. Re-run this after changing any CSS file.
   ============================================ */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const postcss = require('postcss');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'theme-dark.css');
const PREFIX = ':root[data-theme="dark"]';

const SOURCES = [
  'service-schedule.css',
  ...['Sacradigit/sacradigit-css', 'user/user-css', 'Sacraitech/itech-css', 'Sacramedia/media-css']
    .flatMap(dir => fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.css')).map(f => `${dir}/${f}`)),
].filter(f => !/print|\/style\.css$/.test(f)); // certificate print pages + the public landing page stay light

// Parts of the page that must keep their light colours.
const EXCLUDE = /ci-qr|qr-|print|leaflet|scan-canvas|#scan-canvas|sacred-|cert-|certificate-(paper|page)/i;

/* ---------- colour helpers ---------- */
const NAMED = { white: [255, 255, 255, 1], black: [0, 0, 0, 1] };

function parseColor(tok) {
  const t = tok.trim().toLowerCase();
  if (NAMED[t]) return NAMED[t].slice();
  let m = t.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  m = t.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.slice(0, 3).every(v => !isNaN(v))) return [p[0], p[1], p[2], p.length > 3 && !isNaN(p[3]) ? p[3] : 1];
  }
  return null;
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb([h, s, l]) {
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

const fmt = ([r, g, b, a = 1]) => {
  const hex = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return a >= 1 ? `#${hex(r)}${hex(g)}${hex(b)}` : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${+a.toFixed(3)})`;
};

// Dark palette
const SURFACE = [26, 33, 49];      // cards, panels, inputs     (#1a2131)
const SUNKEN = [18, 24, 39];       // page background, wells    (#121827)
const RAISED = [36, 44, 62];       // hover, subtle fills       (#242c3e)
const LINE = [44, 53, 72];         // borders                   (#2c3548)

function darkBackground(c) {
  const [h, s, l] = rgbToHsl(c);
  const a = c[3];
  if (a < 0.4) return null;                // light overlays read fine on dark
  if (l < 0.8) return null;                // accents (lavender, gold) and dark colours — keep
  if (s < 0.15 || l > 0.97) {              // neutral light greys
    if (l >= 0.995) return [...SURFACE, a];
    if (l >= 0.965) return [...SUNKEN, a];
    if (l >= 0.93) return [...RAISED, a];
    if (l >= 0.85) return [...LINE, a];
    return [58, 68, 89, a];
  }
  // tinted light backgrounds (green-50, amber-50, lavender tints…) → deep tint, same hue
  return [...hslToRgb([h, Math.min(0.45, Math.max(0.22, s * 0.5)), 0.17]), a];
}

function darkText(c) {
  const [h, s, l] = rgbToHsl(c);
  const a = c[3];
  if (l > 0.72) return null;               // already light
  if (s < 0.15) {                          // greys
    if (l < 0.16) return [241, 243, 247, a];
    if (l < 0.3) return [227, 230, 236, a];
    if (l < 0.45) return [196, 201, 211, a];
    if (l < 0.55) return [160, 168, 182, a];
    return [139, 147, 163, a];
  }
  return [...hslToRgb([h, Math.min(s, 0.75), 0.74]), a]; // coloured text: same hue, lighter
}

function darkBorder(c) {
  const [h, s, l] = rgbToHsl(c);
  const a = c[3];
  if (l < 0.72) return null;
  if (s < 0.15) return [...LINE, a];
  return [...hslToRgb([h, Math.min(0.4, s * 0.6), 0.3]), a];
}

const COLOR_TOKEN = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\bwhite\b/g;

/** Replace every colour token in a value using `map`; null if nothing changed. */
function mapValue(value, map) {
  let changed = false;
  const out = value.replace(COLOR_TOKEN, (tok) => {
    const c = parseColor(tok);
    if (!c) return tok;
    const d = map(c);
    if (!d) return tok;
    changed = true;
    return fmt(d);
  });
  return changed ? out : null;
}

const BG_PROPS = new Set(['background', 'background-color', 'background-image']);
const TEXT_PROPS = new Set(['color', 'fill', 'caret-color', 'text-decoration-color', '-webkit-text-fill-color']);
const BORDER_PROPS = /^(border(-(top|right|bottom|left))?(-color)?|outline(-color)?|column-rule-color|stroke)$/;

function prefixSelector(sel) {
  return sel.split(',').map(s => {
    s = s.trim();
    if (!s) return s;
    if (/^html\b/.test(s)) return s.replace(/^html/, PREFIX);
    if (/^:root\b/.test(s)) return s.replace(/^:root/, PREFIX);
    return `${PREFIX} ${s}`;
  }).join(',\n');
}

/* ---------- generate ---------- */
let rulesOut = 0;
const out = postcss.root();

for (const rel of SOURCES) {
  const css = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const root = postcss.parse(css, { from: rel });
  const block = postcss.root();

  root.walkRules((rule) => {
    if (rule.parent.type === 'atrule' && /keyframes/i.test(rule.parent.name)) return;
    if (rule.parent.type === 'atrule' && rule.parent.name === 'media' && /print/.test(rule.parent.params)) return;
    if (EXCLUDE.test(rule.selector)) return;

    // Does this rule paint its own dark/coloured background? Then its text colour stays.
    let keepsDarkBg = false;
    rule.walkDecls((d) => {
      if (!BG_PROPS.has(d.prop)) return;
      const toks = d.value.match(COLOR_TOKEN) || [];
      if (toks.some(t => { const c = parseColor(t); return c && c[3] >= 0.4 && !darkBackground(c); })) keepsDarkBg = true;
    });

    const decls = [];
    rule.walkDecls((d) => {
      let v = null;
      if (BG_PROPS.has(d.prop)) v = mapValue(d.value, darkBackground);
      else if (TEXT_PROPS.has(d.prop)) v = keepsDarkBg ? null : mapValue(d.value, darkText);
      else if (BORDER_PROPS.test(d.prop)) v = mapValue(d.value, darkBorder);
      if (v) decls.push(postcss.decl({ prop: d.prop, value: v, important: d.important }));
    });
    if (!decls.length) return;

    const newRule = postcss.rule({ selector: prefixSelector(rule.selector) });
    decls.forEach(d => newRule.append(d));

    // keep @media / @supports wrappers
    let target = newRule;
    for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent) {
      const at = postcss.atRule({ name: p.name, params: p.params });
      at.append(target);
      target = at;
    }
    block.append(target);
    rulesOut++;
  });

  if (block.nodes.length) {
    out.append(postcss.comment({ text: ` from ${rel} ` }));
    block.each(n => out.append(n.clone()));
  }
}

/* ---------- Tailwind utilities used in the markup + shared bits ---------- */
const MANUAL = `
/* ---- Base ---- */
${PREFIX} { color-scheme: dark; }
${PREFIX} body { background-color: #121827; color: #e3e6ec; }

/* ---- Tailwind utility classes used in the pages ---- */
${PREFIX} .bg-white { background-color: #1a2131 !important; }
${PREFIX} .bg-gray-50 { background-color: #121827 !important; }
${PREFIX} .bg-gray-100 { background-color: #242c3e !important; }
${PREFIX} .hover\\:bg-gray-50:hover { background-color: #242c3e !important; }
${PREFIX} .hover\\:bg-gray-100:hover { background-color: #2c3548 !important; }
${PREFIX} .text-gray-900 { color: #f1f3f7 !important; }
${PREFIX} .text-gray-800 { color: #e6e9ef !important; }
${PREFIX} .text-gray-700 { color: #d3d8e1 !important; }
${PREFIX} .text-gray-600 { color: #b6bdca !important; }
${PREFIX} .text-gray-500 { color: #9ea6b5 !important; }
${PREFIX} .text-gray-400 { color: #8a93a4 !important; }
${PREFIX} .text-gray-300 { color: #5f6879 !important; }
${PREFIX} .text-navy, ${PREFIX} .hover\\:text-navy:hover { color: #c7cbe8 !important; }
${PREFIX} .text-lavender { color: #b3b6e6 !important; }
${PREFIX} .text-green-600, ${PREFIX} .text-green-700 { color: #6ee7a0 !important; }
${PREFIX} .text-red-600, ${PREFIX} .text-red-700 { color: #fca5a5 !important; }
${PREFIX} .text-amber-600 { color: #fcd34d !important; }
${PREFIX} .bg-green-50 { background-color: #133024 !important; }
${PREFIX} .bg-amber-50 { background-color: #33280f !important; }
${PREFIX} .border-gray-100, ${PREFIX} .border-gray-200 { border-color: #2c3548 !important; }
${PREFIX} .divide-gray-100 > * + * { border-color: #2c3548 !important; }
${PREFIX} .border-red-400 { border-color: #f87171 !important; }

/* ---- Form controls ---- */
${PREFIX} input, ${PREFIX} select, ${PREFIX} textarea { color: #e6e9ef; }
${PREFIX} input::placeholder, ${PREFIX} textarea::placeholder { color: #6b7486; }
${PREFIX} select option, ${PREFIX} select optgroup { background-color: #1a2131; color: #e6e9ef; }

/* ---- Help (?) button + tutorial (styles injected by help-tutorial.js) ---- */
${PREFIX} .help-icon-btn { background-color: #1a2131; border-color: #3a4459; color: #9ea6b5; }
${PREFIX} .help-icon-btn:hover { background-color: #242c3e; color: #e6e9ef; }
${PREFIX} .help-modal-card { background-color: #1a2131; color: #e3e6ec; }

/* ---- Inline navy text/icons (style="color:#1e2a4a") set directly in markup ---- */
${PREFIX} [style*="color:#1e2a4a"], ${PREFIX} [style*="color: #1e2a4a"] { color: #c7cbe8 !important; }
${PREFIX} [style*="background-color:rgba(30,42,74"], ${PREFIX} [style*="background-color: rgba(30,42,74"] { background-color: rgba(199, 203, 232, 0.12) !important; }

/* ---- Images and maps keep their real colours ---- */
${PREFIX} .leaflet-container { background-color: #ddd; }

/* ---- Keep deliberately white things white (QR codes, scanned pages) ---- */
${PREFIX} .ci-qr, ${PREFIX} #scan-canvas { background-color: #ffffff !important; }

/* ---- Scrollbars ---- */
${PREFIX} ::-webkit-scrollbar-track { background: #121827; }
${PREFIX} ::-webkit-scrollbar-thumb { background: #3a4459; border-radius: 999px; }
`;

const header = `/* ============================================
   SacraDigit — dark theme (GENERATED — do not edit by hand)
   Built by tools/build-dark-theme.mjs from ${SOURCES.length} stylesheets.
   Applies when <html data-theme="dark">; see ui-prefs.js.
   Fix colours in the generator (or the MANUAL block in it) and re-run:
     node tools/build-dark-theme.mjs
   ============================================ */
`;
fs.writeFileSync(OUT, header + MANUAL + '\n' + out.toString() + '\n');
console.log(`theme-dark.css: ${rulesOut} rules from ${SOURCES.length} stylesheets`);
