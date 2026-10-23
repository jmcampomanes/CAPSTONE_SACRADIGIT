/* ============================================
   SacraDigit — "What can I do here?" box at the top
   of each parishioner page (started by user-shell.js;
   the box itself is ../page-info.js, shared with the
   staff portals).
   Same look as Request a Service's "What can I request
   here?": an info icon, a question, a sentence or two —
   and, when the page has a main button, that button on
   the right (moved in from the page's .page-actions row).
   The Dashboard has none. Pages that already have their
   own box (Request a Service, Mass Intentions) keep it;
   Mass Intentions just gets its button moved inside.
   ============================================ */

import { mountPageInfo as mount } from '../page-info.js';

const PAGE_INFO = {
  'user-mass-schedule.html': {
    title: 'What’s on this page?',
    text: 'The Mass times for every week, with today highlighted. Pick a date below to see that day’s Masses, including special ones.',
  },
  'user-announcements.html': {
    title: 'What’s on this page?',
    text: 'Official notices from the parish office are under Announcements; photos and news from the media team are under Updates. Tap any card to read it in full.',
  },
  'user-messages.html': {
    title: 'Who will reply?',
    text: 'Messages here go to the parish office. A staff member will reply on this page, usually within 1 day.',
  },
  'user-my-requests.html': {
    title: 'What’s on this page?',
    text: 'Every certificate you’ve asked for and where it is now. When one is ready, pick it up at the parish office.',
  },
  'user-requested-services.html': {
    title: 'What’s on this page?',
    text: 'Your blessings, sacraments and special Masses, with their dates. Blessings wait for the parish office to approve them. Tap View details to reschedule or cancel.',
  },
  'user-request-certificate.html': {
    title: 'What can I request here?',
    text: 'A copy of your Baptismal, Confirmation, First Communion or Marriage certificate. Pick one below and fill in the details — it’s usually ready to pick up in 3–5 working days.',
    action: { href: 'user-my-requests.html', label: 'View My Requests', icon: 'list' },
  },
  'user-donations.html': {
    title: 'How does giving work?',
    text: 'Choose a fund, pick an amount, and say how you’ll send it — GCash, Maya, bank transfer or cash at the office. No money leaves your account until you send it yourself.',
  },
  'user-facility-booking.html': {
    title: 'What can I book here?',
    text: 'A parish hall or room for a meeting, party or other event. Book at least 3 days ahead — your booking is confirmed right away.',
  },
  'user-mass-intentions.html': {}, // keeps its own "What is a Mass Intention?" box
  'user-prayer-wall.html': {
    title: 'What is the Prayer Wall?',
    text: 'Share a prayer request and the parish community will pray with you. Tap “I prayed for this” on someone’s request to let them know.',
  },
  'user-ministry.html': {
    title: 'How do I volunteer?',
    text: 'Pick your ministry, find a Mass that still needs people, and tap Volunteer. You can withdraw until the day before; after that, ask for a swap so someone else can take your place.',
  },
  'user-badges.html': {
    title: 'What are badges?',
    text: 'You earn badges for coming to Mass, giving and serving in the parish. Check in at Mass to count your visits — the code is on the church screen.',
  },
  'user-profile.html': {
    title: 'What’s on this page?',
    text: 'Your contact details, password, the notices you get, and a record of your activity in the portal.',
  },
  'user-settings.html': {
    title: 'What can I change here?',
    text: 'Make the letters bigger, switch to dark mode, or change the language to Filipino. Your choices are saved on this device.',
  },
};

export const mountPageInfo = (pageFile) => mount(pageFile, PAGE_INFO);
