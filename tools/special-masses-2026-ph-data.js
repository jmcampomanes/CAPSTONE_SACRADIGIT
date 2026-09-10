/* ============================================
   2026 Special Masses — Philippines
   Curated from the GCatholic liturgical calendar:
   https://gcatholic.org/calendar/2026/PH-en

   Only Solemnities (S) and Feasts (F) are included —
   the ~150 daily Optional Memorials from that calendar
   are left out on purpose, since they happen almost
   every day and wouldn't read as "special" masses.
   Holy Week (Palm Sunday through Easter Vigil) and
   Ash Wednesday are added too even though the source
   doesn't badge them S/F, since they're clearly
   pastorally significant days for a parish.

   rank: 'Solemnity' | 'Feast' | 'Triduum'
   suggestedTime: a reasonable default — always
   editable in the tool before importing.
   ============================================ */

export const SPECIAL_MASSES_2026_PH = [
  { date: '2026-01-01', name: 'The Blessed Virgin Mary, the Mother of God', rank: 'Solemnity', suggestedTime: '10:00 AM' },
  { date: '2026-01-04', name: 'The Epiphany of the Lord', rank: 'Solemnity', suggestedTime: '' },
  { date: '2026-01-09', name: 'Our Lord Jesus Christ, Señor Jesus Nazareno', rank: 'Feast', suggestedTime: '6:00 PM' },
  { date: '2026-01-11', name: 'The Baptism of the Lord', rank: 'Feast', suggestedTime: '' },
  { date: '2026-01-18', name: 'Santo Niño', rank: 'Feast', suggestedTime: '9:00 AM' },
  { date: '2026-02-02', name: 'The Presentation of the Lord (Candlemas)', rank: 'Feast', suggestedTime: '6:00 PM' },
  { date: '2026-02-18', name: 'Ash Wednesday', rank: 'Triduum', suggestedTime: '6:30 AM & 6:00 PM' },
  { date: '2026-03-19', name: 'Saint Joseph, husband of Mary', rank: 'Solemnity', suggestedTime: '6:00 PM' },
  { date: '2026-03-25', name: 'The Annunciation of the Lord', rank: 'Solemnity', suggestedTime: '6:00 PM' },
  { date: '2026-03-29', name: "Palm Sunday of the Lord's Passion", rank: 'Triduum', suggestedTime: '' },
  { date: '2026-04-02', name: "Holy Thursday of the Lord's Supper", rank: 'Triduum', suggestedTime: '6:00 PM' },
  { date: '2026-04-03', name: "Good Friday of the Lord's Passion", rank: 'Triduum', suggestedTime: '3:00 PM' },
  { date: '2026-04-04', name: 'Holy Saturday — Easter Vigil', rank: 'Triduum', suggestedTime: '7:00 PM' },
  { date: '2026-04-05', name: "Easter Sunday of the Lord's Resurrection", rank: 'Solemnity', suggestedTime: '' },
  { date: '2026-04-06', name: 'Monday in the Octave of Easter', rank: 'Solemnity', suggestedTime: '6:30 AM' },
  { date: '2026-04-07', name: 'Tuesday in the Octave of Easter', rank: 'Solemnity', suggestedTime: '6:30 AM' },
  { date: '2026-04-08', name: 'Wednesday in the Octave of Easter', rank: 'Solemnity', suggestedTime: '6:30 AM' },
  { date: '2026-04-09', name: 'Thursday in the Octave of Easter', rank: 'Solemnity', suggestedTime: '6:30 AM' },
  { date: '2026-04-10', name: 'Friday in the Octave of Easter', rank: 'Solemnity', suggestedTime: '6:30 AM' },
  { date: '2026-04-11', name: 'Saturday in the Octave of Easter', rank: 'Solemnity', suggestedTime: '6:30 AM' },
  { date: '2026-04-25', name: 'Saint Mark, evangelist', rank: 'Feast', suggestedTime: '6:00 PM' },
  { date: '2026-05-13', name: 'Our Lady of Fatima', rank: 'Feast', suggestedTime: '', note: 'Parish patronal title — check whether this is celebrated as a Solemnity locally.' },
  { date: '2026-05-14', name: 'Saint Matthias, apostle', rank: 'Feast', suggestedTime: '6:00 PM' },
  { date: '2026-05-17', name: 'Ascension of the Lord', rank: 'Solemnity', suggestedTime: '' },
  { date: '2026-05-24', name: 'Pentecost Sunday', rank: 'Solemnity', suggestedTime: '' },
  { date: '2026-05-28', name: 'Our Lord Jesus Christ, the Eternal High Priest', rank: 'Feast', suggestedTime: '6:00 PM' },
  { date: '2026-05-31', name: 'The Most Holy Trinity', rank: 'Solemnity', suggestedTime: '' },
  { date: '2026-06-07', name: 'The Most Holy Body and Blood of Christ (Corpus Christi)', rank: 'Solemnity', suggestedTime: '' },
  { date: '2026-06-12', name: 'The Most Sacred Heart of Jesus', rank: 'Solemnity', suggestedTime: '6:00 PM' },
  { date: '2026-06-24', name: 'The Nativity of Saint John the Baptist', rank: 'Solemnity', suggestedTime: '6:00 PM' },
  { date: '2026-06-29', name: 'Saint Peter and Saint Paul, apostles', rank: 'Solemnity', suggestedTime: '6:00 PM' },
  { date: '2026-07-03', name: 'Saint Thomas, apostle', rank: 'Feast', suggestedTime: '6:00 PM' },
  { date: '2026-07-25', name: 'Saint James, apostle', rank: 'Feast', suggestedTime: '6:00 PM' },
  { date: '2026-08-06', name: 'The Transfiguration of the Lord', rank: 'Feast', suggestedTime: '6:00 PM' },
  { date: '2026-08-10', name: 'Saint Lawrence, deacon and martyr', rank: 'Feast', suggestedTime: '6:00 PM' },
  { date: '2026-08-15', name: 'The Assumption of the Blessed Virgin Mary', rank: 'Solemnity', suggestedTime: '' },
  { date: '2026-08-24', name: 'Saint Bartholomew, apostle', rank: 'Feast', suggestedTime: '6:00 PM' },
  { date: '2026-09-08', name: 'The Nativity of the Blessed Virgin Mary', rank: 'Feast', suggestedTime: '6:00 PM' },
  { date: '2026-09-14', name: 'The Exaltation of the Holy Cross', rank: 'Feast', suggestedTime: '6:00 PM' },
  { date: '2026-09-21', name: 'Saint Matthew, apostle and evangelist', rank: 'Feast', suggestedTime: '6:00 PM' },
  { date: '2026-09-28', name: 'Saint Lawrence Ruiz and companions, martyrs', rank: 'Feast', suggestedTime: '6:00 PM', note: 'First Filipino saint — often marked locally.' },
  { date: '2026-09-29', name: 'Saint Michael, Saint Gabriel, and Saint Raphael, archangels', rank: 'Feast', suggestedTime: '6:00 PM' },
  { date: '2026-10-21', name: 'Saint Pedro Calungsod, martyr', rank: 'Feast', suggestedTime: '6:00 PM', note: 'Filipino saint — often marked locally.' },
  { date: '2026-10-28', name: 'Saint Simon and Saint Jude, apostles', rank: 'Feast', suggestedTime: '6:00 PM' },
  { date: '2026-11-01', name: 'All Saints', rank: 'Solemnity', suggestedTime: '' },
  { date: '2026-11-02', name: 'The Commemoration of all the Faithful Departed (All Souls)', rank: 'Triduum', suggestedTime: '' },
  { date: '2026-11-09', name: 'The Dedication of the Lateran Basilica in Rome', rank: 'Feast', suggestedTime: '6:00 PM' },
  { date: '2026-11-22', name: 'Our Lord Jesus Christ, King of the Universe', rank: 'Solemnity', suggestedTime: '' },
  { date: '2026-11-30', name: 'Saint Andrew, apostle', rank: 'Feast', suggestedTime: '6:00 PM' },
  { date: '2026-12-08', name: 'The Immaculate Conception of the Blessed Virgin Mary', rank: 'Solemnity', suggestedTime: '6:00 PM' },
  { date: '2026-12-25', name: 'The Nativity of the Lord (Christmas)', rank: 'Solemnity', suggestedTime: '' },
  { date: '2026-12-26', name: 'Saint Stephen, first martyr', rank: 'Feast', suggestedTime: '6:00 PM' },
  { date: '2026-12-27', name: 'The Holy Family of Jesus, Mary and Joseph', rank: 'Feast', suggestedTime: '' },
  { date: '2026-12-28', name: 'The Holy Innocents, martyrs', rank: 'Feast', suggestedTime: '6:00 PM' },
];
