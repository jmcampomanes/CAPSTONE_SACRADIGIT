/* ============================================
   SacraDigit — donation receipt (PDF)
   One A4 page on the parish letterhead (same
   emblem, name and colours as print-report.js):
   receipt number, who gave, the fund, method,
   amount in figures and in words, and a QR with
   the receipt details the office can scan to
   check it. Drawn with jsPDF and downloaded
   straight away — no print dialog.
   ============================================ */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { PARISH } from './print-report.js';

const EMBLEM = new URL('./sacradigit-images/fatima-emblem.png', import.meta.url).href;

const NAVY = [30, 42, 74];
const BLUE = [29, 58, 138];
const GOLD = [201, 168, 76];
const INK = [17, 24, 39];
const GRAY = [107, 114, 128];
const LINE = [229, 231, 235];
const SOFT = [247, 248, 252];

// jsPDF's built-in fonts have no ₱ sign, so amounts read "PHP 500.00".
const php = (n) => `PHP ${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const longDate = (d) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
// 'YYYY-MM-DD' as a local date (new Date('2026-10-25') would be UTC and can show the day before).
function parseDay(s) {
  const [y, m, d] = String(s || '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

/* ---- amount in words: 1250.5 → "One Thousand Two Hundred Fifty Pesos and Fifty Centavos Only" ---- */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function underThousand(n) {
  const words = [];
  if (n >= 100) { words.push(ONES[Math.floor(n / 100)], 'Hundred'); n %= 100; }
  if (n >= 20) { words.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '')); n = 0; }
  if (n > 0) words.push(ONES[n]);
  return words.join(' ');
}

function numberToWords(n) {
  if (n === 0) return 'Zero';
  const words = [];
  for (const [size, name] of [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand'], [1, '']]) {
    const chunk = Math.floor(n / size) % 1000;
    if (chunk) words.push(underThousand(chunk), name);
  }
  return words.filter(Boolean).join(' ');
}

export function amountInWords(amount) {
  const pesos = Math.floor(amount);
  const centavos = Math.round((amount - pesos) * 100);
  const p = `${numberToWords(pesos)} Peso${pesos === 1 ? '' : 's'}`;
  return centavos ? `${p} and ${numberToWords(centavos)} Centavo${centavos === 1 ? '' : 's'} Only` : `${p} Only`;
}

async function toDataUrl(url) {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Builds and downloads the receipt.
 * { ref, date ('YYYY-MM-DD'), donor, purpose, amount, method, contact? }
 * contact: the parish contact from parish-info.js (phone, email, location).
 */
export async function downloadDonationReceipt({ ref, date, donor, purpose, amount, method, contact }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const W = 210, M = 18, R = W - M;
  const given = parseDay(date);
  const issued = new Date();

  doc.setProperties({ title: `Donation Receipt ${ref}`, subject: 'Official Donation Receipt', author: PARISH.name, creator: 'SacraDigit Parish Portal' });

  /* ---- Letterhead ---- */
  let y = 16;
  try {
    doc.addImage(await toDataUrl(EMBLEM), 'PNG', M, y, 19, 22.5);
  } catch (err) {
    console.warn('Receipt emblem unavailable:', err);
  }
  const tx = M + 24;
  doc.setTextColor(...BLUE);
  doc.setFont('times', 'bold').setFontSize(18).text(PARISH.name.toUpperCase(), tx, y + 7);
  doc.setFontSize(10.5).text(PARISH.diocese, tx, y + 12.5, { charSpace: 0.4 });
  doc.setTextColor(...GRAY).setFont('helvetica', 'normal').setFontSize(8.5);
  doc.text(contact?.location || PARISH.address, tx, y + 17.5);
  const reach = [contact?.phone && `Tel. ${contact.phone}`, contact?.email].filter(Boolean).join('   |   ');
  if (reach) doc.text(reach, tx, y + 21.5);

  doc.setTextColor(...NAVY).setFont('helvetica', 'bold').setFontSize(10).text('SACRADIGIT', R, y + 7, { align: 'right' });
  doc.setTextColor(...GRAY).setFont('helvetica', 'normal').setFontSize(7.5).text('Parish Portal', R, y + 11, { align: 'right' });

  y += 27;
  doc.setFillColor(...NAVY).rect(M, y, R - M, 1.1, 'F');
  doc.setFillColor(...GOLD).rect(M, y + 1.6, R - M, 0.5, 'F');

  /* ---- Title, receipt number, date issued ---- */
  y += 14;
  doc.setTextColor(...NAVY).setFont('helvetica', 'bold').setFontSize(17).text('OFFICIAL DONATION RECEIPT', M, y, { charSpace: 0.3 });
  doc.setTextColor(...GRAY).setFont('helvetica', 'normal').setFontSize(9.5)
    .text('Acknowledgement of an offering made through the SacraDigit Parish Portal', M, y + 6);

  doc.setFontSize(7.5).text('RECEIPT NO.', R, y - 6, { align: 'right' });
  doc.setTextColor(...INK).setFont('helvetica', 'bold').setFontSize(11).text(ref, R, y - 1.5, { align: 'right' });
  doc.setTextColor(...GRAY).setFont('helvetica', 'normal').setFontSize(7.5).text('DATE ISSUED', R, y + 4, { align: 'right' });
  doc.setTextColor(...INK).setFont('helvetica', 'bold').setFontSize(10).text(longDate(issued), R, y + 8.5, { align: 'right' });

  /* ---- Received from ---- */
  y += 16;
  doc.setFillColor(...SOFT).setDrawColor(...LINE).roundedRect(M, y, R - M, 20, 2.5, 2.5, 'FD');
  doc.setTextColor(...GRAY).setFont('helvetica', 'bold').setFontSize(7.5).text('RECEIVED FROM', M + 5, y + 7, { charSpace: 0.4 });
  doc.setTextColor(...INK).setFont('times', 'bold').setFontSize(16).text(donor, M + 5, y + 15);

  /* ---- Details ---- */
  y += 27;
  const rows = [
    ['Reference No.', ref],
    ['Date of Donation', given ? longDate(given) : String(date || '—')],
    ['Fund / Purpose', purpose],
    ['Payment Method', method],
  ];
  const rowH = 11;
  doc.setDrawColor(...LINE).roundedRect(M, y, R - M, rowH * rows.length, 2.5, 2.5, 'S');
  rows.forEach(([label, value], i) => {
    const ry = y + rowH * i;
    if (i) doc.line(M, ry, R, ry);
    doc.setTextColor(...GRAY).setFont('helvetica', 'normal').setFontSize(9.5).text(label, M + 5, ry + 7);
    doc.setTextColor(...INK).setFont('helvetica', 'bold').setFontSize(10.5).text(String(value || '—'), R - 5, ry + 7, { align: 'right' });
  });

  /* ---- Amount ---- */
  y += rowH * rows.length + 6;
  doc.setFillColor(...NAVY).roundedRect(M, y, R - M, 18, 2.5, 2.5, 'F');
  doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(9).text('AMOUNT RECEIVED', M + 5, y + 11, { charSpace: 0.4 });
  doc.setFontSize(19).text(php(amount), R - 5, y + 12, { align: 'right' });
  doc.setFillColor(...GOLD).rect(M + 5, y + 18, R - M - 10, 0.6, 'F');

  y += 26;
  doc.setTextColor(...GRAY).setFont('helvetica', 'normal').setFontSize(9).text('Amount in words:', M, y);
  doc.setTextColor(...INK).setFont('helvetica', 'bolditalic').setFontSize(10);
  const words = doc.splitTextToSize(amountInWords(Number(amount) || 0), R - M - 30);
  doc.text(words, M + 29, y);

  /* ---- Thank you ---- */
  y += 8 + 5 * words.length;
  doc.setTextColor(...NAVY).setFont('times', 'italic').setFontSize(13).text('Thank you for your generous offering.', W / 2, y, { align: 'center' });
  doc.setTextColor(...GRAY).setFont('times', 'italic').setFontSize(10)
    .text('"Each of you should give what you have decided in your heart to give, for God loves a cheerful giver."', W / 2, y + 7, { align: 'center' })
    .text('2 Corinthians 9:7', W / 2, y + 12, { align: 'center' });

  /* ---- QR + notes ---- */
  y = 228;
  const qrText = [`SacraDigit Donation Receipt`, `Ref: ${ref}`, `Amount: ${php(amount)}`, `Date: ${date}`, `Fund: ${purpose}`, `Method: ${method}`].join('\n');
  try {
    doc.addImage(await QRCode.toDataURL(qrText, { margin: 1, width: 300, errorCorrectionLevel: 'M' }), 'PNG', M, y, 30, 30);
  } catch (err) {
    console.warn('Receipt QR unavailable:', err);
  }
  const nx = M + 36;
  doc.setTextColor(...NAVY).setFont('helvetica', 'bold').setFontSize(9).text('Important', nx, y + 4);
  doc.setTextColor(...GRAY).setFont('helvetica', 'normal').setFontSize(8.5);
  const notes = [
    'This receipt is system-generated and is valid without a signature.',
    method === 'Cash'
      ? 'Cash offerings are received at the parish office.'
      : `${method} offerings are subject to verification by the parish office against the reference number.`,
    'Scan the QR code to read the receipt details. For questions, contact the parish office and quote the reference number.',
  ];
  let ny = y + 9.5;
  notes.forEach(n => {
    const lines = doc.splitTextToSize(`•  ${n}`, R - nx);
    doc.text(lines, nx, ny);
    ny += 4.2 * lines.length + 1;
  });

  /* ---- Footer ---- */
  doc.setDrawColor(...LINE).line(M, 280, R, 280);
  doc.setTextColor(...GRAY).setFont('helvetica', 'normal').setFontSize(7.5);
  doc.text(`Generated ${issued.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} via SacraDigit Parish Portal`, M, 285);
  doc.text(PARISH.name, R, 285, { align: 'right' });

  doc.save(`Donation-Receipt-${ref}.pdf`);
}
