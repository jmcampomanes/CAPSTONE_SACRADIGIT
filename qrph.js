/* ============================================
   SacraDigit — QR Ph with an amount
   GCash and Maya "My QR" codes are QR Ph (EMVCo)
   text: two-digit tag, two-digit length, value.
   withAmount() turns a blank-amount QR into one
   that opens the app with the amount filled in:
   01 = '12' (one-time QR), 54 = amount, then a
   fresh CRC in 63. The account inside stays the
   same, so the money still goes to that account.
   ============================================ */

function parse(payload) {
  const fields = [];
  let i = 0;
  while (i < payload.length) {
    const id = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || !Number.isInteger(len) || i + 4 + len > payload.length) return null;
    fields.push([id, payload.slice(i + 4, i + 4 + len)]);
    i += 4 + len;
  }
  return fields;
}

// CRC-16/CCITT-FALSE, the checksum QR Ph puts in tag 63.
function crc16(text) {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// A real QR Ph text: starts with 000201 and its CRC checks out.
export function isQrPh(payload) {
  if (typeof payload !== 'string' || !payload.startsWith('000201') || !parse(payload)) return false;
  return crc16(payload.slice(0, -4)) === payload.slice(-4).toUpperCase();
}

// One field's value, e.g. qrPhField(qr, '59') is the account name.
export function qrPhField(payload, id) {
  return parse(payload)?.find(([k]) => k === id)?.[1] ?? '';
}

// The same QR with `amount` pesos filled in, or null if `payload` isn't a valid QR Ph.
export function withAmount(payload, amount) {
  if (!isQrPh(payload) || !(amount > 0)) return null;
  const fields = parse(payload).filter(([id]) => id !== '54' && id !== '63');
  const pointOfInit = fields.find(([id]) => id === '01');
  if (pointOfInit) pointOfInit[1] = '12';
  fields.push(['54', Number(amount).toFixed(2)]);
  fields.sort((a, b) => Number(a[0]) - Number(b[0]));
  const body = fields.map(([id, v]) => id + String(v.length).padStart(2, '0') + v).join('') + '6304';
  return body + crc16(body);
}
