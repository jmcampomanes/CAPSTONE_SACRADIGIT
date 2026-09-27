/* ============================================
   SacraDigit — Service catalog
   Every service a parishioner can book, with the
   form fields each one asks for. Shared by the
   parishioner "Request a Service" page and the
   admin "+ Service" walk-in form, so both always
   offer the same services and ask the same things.
   Scheduling rules for each (days, times,
   capacity) live in service-schedule.js.
   ============================================ */

import { MAP_PIN_LABEL } from './service-schedule.js';

// Groups the catalog below into three rows on the "Services We Offer"
// panel — Blessings, Sacraments, Special Masses (in that order) — each
// with its own short description, so it's clear at a glance what kind
// of request each card is instead of one undifferentiated grid. Order
// here is also the on-page row order.
export const SERVICE_CATEGORIES = [
  { key: 'blessing', label: 'Blessings', desc: 'Blessings for a home, vehicle, or business.' },
  { key: 'sacrament', label: 'Sacraments', desc: 'The sacraments of the Catholic faith.' },
  { key: 'special-mass', label: 'Special Masses', desc: 'A Mass offered for a specific intention or occasion.' },
];

// All 7 sacraments of the Catholic Church are listed below, in their
// traditional order (Baptism, Confirmation, Eucharist, Reconciliation,
// Anointing of the Sick, Matrimony, Holy Orders) — each with its own
// short description, matching the Blessings/Special Masses cards.
export const SERVICE_TYPES = [
  { id: 'baptism', name: 'Baptism', category: 'sacrament', desc: 'Sacrament of initiation for infants, children, or adults.',
    iconBg: 'rgba(139,143,199,0.16)', iconColor: '#5b5fa8',
    icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 3C8 3 5 6 5 9c0 4 7 12 7 12s7-8 7-12c0-3-3-6-7-6z"/></svg>`,
    fields: [
      { id: 'child-name', label: "Child's Full Name", kind: 'name', required: true, span2: true },
      { id: 'father-name', label: "Father's Name", kind: 'name', required: false },
      { id: 'mother-name', label: "Mother's Maiden Name", kind: 'name', required: false },
    ] },
  { id: 'confirmation', name: 'Confirmation', category: 'sacrament', desc: 'Sacrament of the Holy Spirit, completing Christian initiation.',
    iconBg: 'rgba(15,138,122,0.14)', iconColor: '#0f8a7a',
    icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.657 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/></svg>`,
    fields: [
      { id: 'candidate-name-conf', label: "Candidate's Full Name", kind: 'name', required: true, span2: true },
      { id: 'sponsor-name-conf', label: "Confirmation Sponsor's Name", kind: 'name', required: false, span2: true },
    ] },
  { id: 'first-communion', name: 'First Communion', category: 'sacrament', desc: 'Sacrament of the Holy Eucharist, first reception.',
    iconBg: 'rgba(201,168,76,0.16)', iconColor: '#b5943e',
    icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    fields: [
      { id: 'child-name-fc', label: "Child's Full Name", kind: 'name', required: true, span2: true },
      { id: 'parent-1-fc', label: 'Parent 1', kind: 'name', required: false, span2: true },
      { id: 'parent-2-fc', label: 'Parent 2', kind: 'name', required: false, span2: true },
    ] },
  { id: 'confession', name: 'Confession / Reconciliation', category: 'sacrament', desc: 'Sacrament of Penance — private confession and absolution.',
    iconBg: 'rgba(122,78,168,0.14)', iconColor: '#7a4ea8',
    icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>`,
    fields: [
      { id: 'penitent-name-conf', label: 'Your Full Name', kind: 'name', required: false, span2: true },
    ] },
  { id: 'anointing-of-the-sick', name: 'Anointing of the Sick', category: 'sacrament', desc: 'Sacrament of healing and comfort for the seriously ill or elderly.',
    iconBg: 'rgba(21,128,61,0.1)', iconColor: '#15803d',
    icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-3-3v6m9-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    fields: [
      { id: 'patient-name', label: "Patient's Full Name", kind: 'name', required: true, span2: true },
      { id: 'location-anointing', label: 'Location (Home / Hospital)', placeholder: "e.g. St. Luke's Medical Center, Room 204", required: true, span2: true },
    ] },
  { id: 'wedding', name: 'Wedding', category: 'sacrament', desc: 'Sacrament of matrimony for the Catholic rite.',
    iconBg: 'rgba(239,68,68,0.1)', iconColor: '#dc2626',
    icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`,
    fields: [
      { id: 'groom-name', label: "Groom's Full Name", kind: 'name', required: true, span2: true },
      { id: 'bride-name', label: "Bride's Full Name", kind: 'name', required: true, span2: true },
    ] },
  { id: 'holy-orders', name: 'Holy Orders', category: 'sacrament', desc: 'Sacrament of ordination to the diaconate, priesthood, or episcopate.',
    iconBg: 'rgba(194,112,28,0.14)', iconColor: '#c2701c',
    icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>`,
    fields: [
      { id: 'candidate-name-ho', label: "Candidate's Full Name", kind: 'name', required: true, span2: true },
      { id: 'sending-diocese', label: 'Sending Diocese / Seminary', placeholder: 'e.g. Diocese of Cubao', required: false, span2: true },
    ] },
  { id: 'funeral', name: 'Funeral Mass', category: 'special-mass', desc: 'Mass and rites for a deceased loved one.',
    iconBg: 'rgba(107,114,128,0.12)', iconColor: '#6b7280',
    icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
    fields: [
      { id: 'deceased-name', label: 'Full Name of Deceased', kind: 'name', required: true, span2: true },
      { id: 'requester-rel', label: 'Relationship to Deceased', placeholder: 'e.g. Son, Daughter, Spouse', required: true },
    ] },
  { id: 'house-blessing', name: 'House Blessing', category: 'blessing', desc: 'Blessing for a home or residence.',
    iconBg: 'rgba(201,168,76,0.16)', iconColor: '#b5943e',
    icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`,
    fields: [
      // Saved as "lat, lng" under this label; the admin Blessings page
      // and Requested Services show it as a Google Maps link.
      { id: 'map-pin', label: MAP_PIN_LABEL, kind: 'map', addressField: 'address', required: false, span2: true },
      { id: 'address', label: 'Complete Address', placeholder: 'e.g. 12 Mabini St., Cubao', required: true, span2: true },
      { id: 'household', label: 'Household / Owner Name', placeholder: 'e.g. Santos Family', required: true },
    ] },
  { id: 'vehicle-blessing', name: 'Vehicle / Item Blessing', category: 'blessing', desc: 'Blessing for a vehicle or a special item.',
    iconBg: 'rgba(21,128,61,0.1)', iconColor: '#15803d',
    icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
    fields: [
      { id: 'item', label: 'Item Description', placeholder: 'e.g. 2023 Honda CR-V — XYZ 456', required: true, span2: true },
      { id: 'owner', label: "Owner's Name", placeholder: 'e.g. Maria Santos', required: true },
    ] },
  { id: 'business-dedication', name: 'Business Dedication', category: 'blessing', desc: 'Blessing to dedicate a new or existing business.',
    iconBg: 'rgba(139,143,199,0.16)', iconColor: '#5b5fa8',
    icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 21h18M5 21V7l8-4v18M13 21V11l6 4v6M9 9v.01M9 12v.01M9 15v.01"/></svg>`,
    fields: [
      { id: 'business-name', label: 'Business Name', placeholder: 'e.g. Reyes Bakery', required: true, span2: true },
      { id: 'business-address', label: 'Business Address', placeholder: 'e.g. Aurora Blvd. corner 8th', required: true },
    ] },
  { id: 'anniversary-mass', name: 'Anniversary Mass', category: 'special-mass', desc: 'Thanksgiving mass for a wedding or ordination anniversary.',
    iconBg: 'rgba(239,68,68,0.1)', iconColor: '#dc2626',
    icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 13l4 4L19 7"/></svg>`,
    fields: [
      { id: 'spouse-1', label: 'Spouse 1', kind: 'name', required: true, span2: true },
      { id: 'spouse-2', label: 'Spouse 2', kind: 'name', required: true, span2: true },
      { id: 'years', label: 'Years Being Celebrated', placeholder: 'e.g. 15 years', required: false },
    ] },
  { id: 'pet-blessing', name: 'Pet Blessing', category: 'blessing', desc: 'Blessing for a pet or animal companion.',
    iconBg: 'rgba(161,98,7,0.14)', iconColor: '#a16207',
    icon: `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><ellipse cx="6.5" cy="9" rx="2" ry="2.4"/><ellipse cx="11.5" cy="6.2" rx="2" ry="2.4"/><ellipse cx="16.5" cy="6.2" rx="2" ry="2.4"/><ellipse cx="20" cy="10.2" rx="2" ry="2.4"/><path d="M13.5 11c-4 0-7.5 2.7-7.5 6.2 0 2.7 2.6 3.8 6.4 3.8h1.7c3.8 0 7.4-1.1 7.4-3.8C21.5 13.7 17.5 11 13.5 11z"/></svg>`,
    fields: [
      { id: 'pet-name', label: "Pet's Name", placeholder: 'e.g. Bantay', required: true, span2: true },
      { id: 'pet-type', label: 'Type of Pet', placeholder: 'e.g. Dog, Cat, Bird', required: false },
      { id: 'pet-owner', label: "Owner's Name", placeholder: 'e.g. Santos Family', required: true },
    ] },
  { id: 'baccalaureate-mass', name: 'Baccalaureate Mass', category: 'special-mass', desc: 'Thanksgiving Mass for graduating students before commencement.',
    iconBg: 'rgba(29,78,216,0.12)', iconColor: '#1d4ed8',
    icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>`,
    fields: [
      { id: 'graduate-name', label: "Graduate's Full Name", kind: 'name', required: true, span2: true },
      { id: 'school-name', label: 'School / University', placeholder: 'e.g. Ateneo de Manila University', required: false, span2: true },
      { id: 'graduation-year', label: 'Graduation Year / Batch', placeholder: 'e.g. 2026', required: false },
    ] },
];
