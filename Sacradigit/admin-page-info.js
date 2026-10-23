/* ============================================
   SacraDigit Admin — "What can I do here?" box at the
   top of each admin page (started by dashboard.js; the
   box itself is ../page-info.js, shared with every
   portal). The page's main buttons sit on its right.
   The Dashboard keeps its welcome banner instead.
   ============================================ */

import { mountPageInfo as mount } from '../page-info.js';

const PAGE_INFO = {
  'record-requests.html': {
    title: 'What’s on this page?',
    text: 'Certificate requests from parishioners and walk-ins. Open one to check it, approve it, and generate the certificate; mark it released once it’s picked up.',
  },
  'digital-archives.html': {
    title: 'What’s on this page?',
    text: 'Every digitized sacramental record. Search to find one, scan or upload a paper record, or add a new record by hand.',
  },
  'mass-intentions.html': {
    title: 'What’s on this page?',
    text: 'Mass intentions and offerings from parishioners and walk-ins. Add one for a walk-in, and print the intentions for each Mass.',
  },
  'masses.html': {
    title: 'What’s on this page?',
    text: 'The weekly Mass schedule and special Masses. Switch to the calendar to see a whole month, or print the schedule.',
  },
  'special-schedules.html': {
    title: 'What’s on this page?',
    text: 'Seasonal and special liturgical schedules, like Simbang Gabi. Add one, or switch to the calendar to see them by month.',
  },
  'blessings.html': {
    title: 'What’s on this page?',
    text: 'House blessings, business dedications and other blessing requests. Approve or reschedule them, and book one for a walk-in.',
  },
  'schedule-offers.html': {
    title: 'What’s on this page?',
    text: 'Parishioners book the parish’s fixed schedule slots directly, so bookings arrive here already scheduled. Reschedule or cancel one if the parish can’t honour it.',
  },
  'facility-booking.html': {
    title: 'What’s on this page?',
    text: 'Bookings for parish rooms, halls and chapels. Check what’s taken in the calendar, add a booking, or cancel one.',
  },
  'ministry-bookings.html': {
    title: 'Who can book here?',
    text: 'People who serve the parish use its rooms with no fee. Type their name: anyone on the Ministry Roster, or vouched for by the Head Admin in the last 6 months, is verified automatically. Anyone else needs the Head Admin’s word.',
  },
  'donations.html': {
    title: 'What’s on this page?',
    text: 'Parish donations, collections and giving goals. See the last 7 days in a chart, set a new goal, or export a report.',
  },
  'columbary.html': {
    title: 'What’s on this page?',
    text: 'Niches, reservations, payments and inurnments. Click a niche on the map to reserve it, record a payment, or see who rests there.',
  },
  'attendance.html': {
    title: 'What’s on this page?',
    text: 'From the QR check-ins at Mass: which Masses fill up, how attendance changes over time, and the busiest days and times.',
  },
  'ministry-roster.html': {
    title: 'What’s on this page?',
    text: 'Lectors, choir, altar servers and ushers who signed up for each weekend and special Mass this month. Print it for the sacristy.',
  },
  'badge-maker.html': {
    title: 'What are badges?',
    text: 'Badges parishioners earn automatically from their records, or that you give by hand for a special honor. They show up on each parishioner’s My Badges page.',
  },
  'prayer-wall.html': {
    title: 'What’s on this page?',
    text: 'Prayer requests waiting for review before they appear on the wall. Anonymous requests never show a name, not even here.',
  },
  'announcements.html': {
    title: 'What’s on this page?',
    text: 'Parish-wide announcements for parishioners. Write a new one, or edit and remove the ones already published.',
  },
  'messages.html': {
    title: 'Who answers here?',
    text: 'Questions from parishioners. The Head Admin and the Secretary both see and answer every conversation.',
  },
  'parish-info.html': {
    title: 'What’s on this page?',
    text: 'The parish’s address, office hours and contact details. The Parish Assistant uses them to answer parishioners’ questions.',
  },
  'profile.html': {
    title: 'What’s on this page?',
    text: 'Your account details, password and photo, and a record of your activity in the portal.',
  },
};

export const mountAdminPageInfo = (pageFile) => mount(pageFile, PAGE_INFO, { portal: 'admin', withStyles: true });
