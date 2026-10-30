/* ============================================
   SacraMedia — "What can I do here?" box at the top
   of each Media page (started by media-shell.js; the
   box itself is ../../shared/js/page-info.js, shared with every
   portal). The page's main button sits on its right
   (`move` brings it up from the panel header).
   The Dashboard keeps its welcome banner instead.
   ============================================ */

import { mountPageInfo as mount } from '../../shared/js/page-info.js';

const PAGE_INFO = {
  'announcements.html': {
    title: 'What’s on this page?',
    text: 'Parish announcements and updates. Write a new one, keep it as a draft until it’s ready, and unpublish or archive old ones.',
  },
  'content-calendar.html': {
    title: 'What’s on this page?',
    text: 'Posts the media team has planned, with their date, platform and status. Add an entry so everyone knows what’s coming up.',
    move: ['#add-entry-btn'],
  },
  'event-coverage.html': {
    title: 'What’s on this page?',
    text: 'Requests for the media team to cover a parish event with photos or video. Add a request, then approve or reject each one.',
    move: ['#add-request-btn'],
  },
  'livestream.html': {
    title: 'How does going live work?',
    text: 'Pick the platform and paste the stream link, then tap Go live. While it’s on, parishioners see a “Watch Live” banner on their dashboard.',
  },
  'media-library.html': {
    title: 'What’s on this page?',
    text: 'Parish photos and videos, shared with the whole media team. They also appear to the IT team under Cloud Access → Media Library.',
    move: ['#add-media-btn'],
  },
  'post-templates.html': {
    title: 'What’s on this page?',
    text: 'Reusable post templates, so posts the team makes again and again start from the same wording every time.',
    move: ['#add-template-btn'],
  },
  'profile.html': {
    title: 'What’s on this page?',
    text: 'Your own profile. Phone, About and your photo are saved to your account.',
  },
};

export const mountMediaPageInfo = (pageFile) => mount(pageFile, PAGE_INFO, { portal: 'media', withStyles: true });
