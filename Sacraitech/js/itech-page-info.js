/* ============================================
   Sacra ITech — "What can I do here?" box at the top
   of each ITech page (started by itech-shell.js; the
   box itself is ../../shared/js/page-info.js, shared with every
   portal). The page's main button sits on its right.
   The Dashboard has none.
   ============================================ */

import { mountPageInfo as mount } from '../../shared/js/page-info.js';

const PAGE_INFO = {
  'itech-backup.html': {
    title: 'What’s on this page?',
    text: 'Download every module as one JSON file, or one module at a time. Keep backups somewhere safe, off this computer.',
  },
  'itech-cloud.html': {
    title: 'What’s on this page?',
    text: 'The parish’s file storage: its folders and the latest uploads, including the media team’s library.',
  },
  'itech-logs.html': {
    title: 'What’s on this page?',
    text: 'Who did what in the portals, and when. Search or filter by action and date, and export the list as a CSV file.',
    move: ['#btn-export-logs'],
  },
  'itech-parish-info.html': {
    title: 'What’s on this page?',
    text: 'The parish’s address, office hours and contact details. The Parish Assistant uses them to answer parishioners’ questions.',
  },
  'itech-roles.html': {
    title: 'What’s on this page?',
    text: 'Everyone who can sign in, and their role. A person’s role decides which portal they can open and what they can change there.',
  },
  'itech-service-schedules.html': {
    title: 'What’s on this page?',
    text: 'The days, times and slots for each service parishioners can book on Request a Service. Changes apply right away to new bookings; existing bookings are kept.',
  },
  'itech-storage.html': {
    title: 'What’s on this page?',
    text: 'How much storage the parish uses, by folder, and every tracked file. Run the consistency check to find records whose file is missing, and files nothing points to.',
  },
  'profile.html': {
    title: 'What’s on this page?',
    text: 'Your own profile. Phone, About and your photo are saved to your account.',
  },
};

export const mountItechPageInfo = (pageFile) => mount(pageFile, PAGE_INFO, { portal: 'itech', withStyles: true });
