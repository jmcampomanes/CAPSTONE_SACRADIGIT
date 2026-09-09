/* ============================================
   SacraDigit — Philippine Regions & Cities/
   Municipalities (bundled, offline dataset)

   This app has no backend/build step, so instead of
   calling an external geographic API at runtime, the
   region -> city/municipality picker used on the
   Baptismal Certificate request form (Place of Birth)
   is backed by this small local dataset.

   It's a curated list of the most commonly selected
   cities/municipalities per region (provincial capitals,
   highly urbanized cities, and other well-known LGUs) —
   not the full ~1,600-entry PSGC list. Any location not
   listed can still be entered via the "Other" option the
   UI adds automatically (see ph-locations.js consumers).

   Import from admin pages as:  import { ... } from '../ph-locations.js';
   Import from user pages as:   import { ... } from '../ph-locations.js';
   (this file lives at the project root, next to amplify-init.js)
   ============================================ */

export const PH_REGIONS = [
  { name: 'National Capital Region (NCR)', cities: [
    'City of Manila', 'Quezon City', 'Caloocan City', 'Las Piñas City', 'Makati City',
    'Malabon City', 'Mandaluyong City', 'Marikina City', 'Muntinlupa City', 'Navotas City',
    'Parañaque City', 'Pasay City', 'Pasig City', 'City of San Juan', 'Taguig City', 'Valenzuela City', 'Pateros',
  ] },
  { name: 'Cordillera Administrative Region (CAR)', cities: [
    'Baguio City', 'Tabuk City', 'La Trinidad', 'Bontoc', 'Lagawe', 'Bangued', 'Sagada',
  ] },
  { name: 'Region I – Ilocos Region', cities: [
    'Laoag City', 'Vigan City', 'San Fernando City (La Union)', 'Dagupan City', 'Alaminos City', 'Candon City', 'Batac City',
  ] },
  { name: 'Region II – Cagayan Valley', cities: [
    'Tuguegarao City', 'Ilagan City', 'Cauayan City', 'Santiago City', 'Bayombong', 'Basco',
  ] },
  { name: 'Region III – Central Luzon', cities: [
    'San Fernando City (Pampanga)', 'Angeles City', 'Olongapo City', 'Tarlac City', 'Cabanatuan City',
    'San Jose City', 'Palayan City', 'Balanga City', 'Malolos City', 'Meycauayan City', 'San Jose del Monte City',
  ] },
  { name: 'Region IV-A – CALABARZON', cities: [
    'Calamba City', 'Antipolo City', 'Lucena City', 'Batangas City', 'Lipa City', 'Tanauan City',
    'San Pablo City', 'Santa Rosa City', 'Biñan City', 'Cavite City', 'Dasmariñas City', 'Bacoor City',
    'Imus City', 'Tagaytay City', 'Trece Martires City',
  ] },
  { name: 'MIMAROPA Region (Region IV-B)', cities: [
    'Calapan City', 'Puerto Princesa City', 'Odiongan', 'Boac', 'San Jose (Occidental Mindoro)', 'Mamburao',
  ] },
  { name: 'Region V – Bicol Region', cities: [
    'Legazpi City', 'Naga City', 'Iriga City', 'Sorsogon City', 'Masbate City', 'Tabaco City', 'Ligao City', 'Daet',
  ] },
  { name: 'Region VI – Western Visayas', cities: [
    'Iloilo City', 'Bacolod City', 'Roxas City', 'Kalibo', 'San Jose de Buenavista', 'Passi City', 'Silay City', 'Talisay City (Negros Occidental)',
  ] },
  { name: 'Region VII – Central Visayas', cities: [
    'Cebu City', 'Mandaue City', 'Lapu-Lapu City', 'Tagbilaran City', 'Dumaguete City', 'Talisay City (Cebu)', 'Toledo City', 'Bogo City',
  ] },
  { name: 'Region VIII – Eastern Visayas', cities: [
    'Tacloban City', 'Ormoc City', 'Catbalogan City', 'Calbayog City', 'Maasin City', 'Borongan City', 'Baybay City',
  ] },
  { name: 'Region IX – Zamboanga Peninsula', cities: [
    'Zamboanga City', 'Pagadian City', 'Dipolog City', 'Dapitan City', 'Isabela City',
  ] },
  { name: 'Region X – Northern Mindanao', cities: [
    'Cagayan de Oro City', 'Iligan City', 'Malaybalay City', 'Valencia City', 'Ozamiz City',
    'Oroquieta City', 'Tangub City', 'Gingoog City',
  ] },
  { name: 'Region XI – Davao Region', cities: [
    'Davao City', 'Tagum City', 'Panabo City', 'Digos City', 'Mati City', 'Island Garden City of Samal',
  ] },
  { name: 'Region XII – SOCCSKSARGEN', cities: [
    'General Santos City', 'Koronadal City', 'Kidapawan City', 'Tacurong City', 'Cotabato City',
  ] },
  { name: 'Region XIII – Caraga', cities: [
    'Butuan City', 'Surigao City', 'Bislig City', 'Tandag City', 'Bayugan City', 'Cabadbaran City',
  ] },
  { name: 'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)', cities: [
    'Marawi City', 'Lamitan City', 'Jolo', 'Bongao', 'Buluan',
  ] },
];

/** Every option value the "Other" fallback should never collide with. */
export const OTHER_CITY_VALUE = '__other__';

/** Builds the <option> markup for the Region <select>. */
export function regionOptionsHtml(selected = '') {
  return `<option value="">Select region…</option>` +
    PH_REGIONS.map(r => `<option value="${r.name}" ${r.name === selected ? 'selected' : ''}>${r.name}</option>`).join('');
}

/** Builds the <option> markup for the City <select> given a region name (or '' for the disabled placeholder-only state). */
export function cityOptionsHtml(regionName, selected = '') {
  const region = PH_REGIONS.find(r => r.name === regionName);
  const cities = region ? region.cities : [];
  const cityOptions = cities.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
  const otherSelected = selected === OTHER_CITY_VALUE ? 'selected' : '';
  return `<option value="">${region ? 'Select city/municipality…' : 'Select a region first'}</option>` +
    cityOptions +
    (region ? `<option value="${OTHER_CITY_VALUE}" ${otherSelected}>Other (not listed)</option>` : '');
}