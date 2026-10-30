/* ============================================
   saint-names.js — place at project root, next to
   ph-locations.js and amplify-init.js.

   A curated (not exhaustive) offline list of commonly
   chosen Catholic confirmation/saint names, in the same
   spirit as ph-locations.js's curated region/city list —
   good enough to cover most requesters, with an "Other"
   option revealing a free-text fallback for anything not
   listed, so nobody is ever blocked by a missing name.
   ============================================ */

export const CONFIRMATION_NAMES = [
  'Agatha', 'Agnes', 'Aloysius', 'Ambrose', 'Andrew', 'Angela', 'Anne', 'Anthony',
  'Augustine', 'Barbara', 'Bartholomew', 'Benedict', 'Bernadette', 'Bernard',
  'Blaise', 'Bonaventure', 'Bridget', 'Camillus', 'Catherine', 'Cecilia', 'Charles',
  'Christopher', 'Clare', 'Clement', 'Cornelius', 'Cyril', 'Damian', 'David',
  'Dominic', 'Dorothy', 'Edith', 'Edmund', 'Edward', 'Elizabeth', 'Faustina',
  'Felicity', 'Francis', 'Francis Xavier', 'Gabriel', 'Genevieve', 'George',
  'Gerard', 'Gertrude', 'Gregory', 'Helena', 'Henry', 'Hilary', 'Hildegard',
  'Ignatius', 'Irene', 'Isaac', 'Isidore', 'James', 'Jerome', 'Joachim',
  'Joan of Arc', 'John', 'John Paul', 'Joseph', 'Jude', 'Julia', 'Justin',
  'Kateri', 'Kevin', 'Lawrence', 'Leo', 'Louis', 'Lucy', 'Luke', 'Margaret',
  'Maria Goretti', 'Mark', 'Martha', 'Martin', 'Mary', 'Matthew',
  'Maximilian Kolbe', 'Michael', 'Monica', 'Nicholas', 'Padre Pio', 'Patrick',
  'Paul', 'Peter', 'Philip', 'Pius', 'Raphael', 'Raymond', 'Rita', 'Rose of Lima',
  'Sebastian', 'Simon', 'Stephen', 'Teresa of Avila', 'Therese of Lisieux',
  'Thomas', 'Thomas Aquinas', 'Timothy', 'Ursula', 'Valentine', 'Veronica',
  'Vincent de Paul', 'Zita',
];

export const OTHER_NAME_VALUE = '__other__';

export function confirmationNameOptionsHtml(selected = '') {
  const opts = ['<option value="">Select a confirmation name…</option>']
    .concat(CONFIRMATION_NAMES.map(n =>
      `<option value="${n}"${n === selected ? ' selected' : ''}>${n}</option>`))
    .concat([`<option value="${OTHER_NAME_VALUE}"${selected === OTHER_NAME_VALUE ? ' selected' : ''}>Other (not listed)</option>`]);
  return opts.join('');
}