# SacraDigit — Folder Guide

HTML pages stay where they are, so page URLs never change.
Each folder keeps its scripts in `js/` and its styles in `css/`.

```
index.html, login.html, home.html   Public landing page and sign-in
landing/                            Scripts + styles for index.html and login.html

shared/                             Used by more than one portal
  js/                               auth, amplify-init, toast, ui-prefs, i18n-fil, pwa, ...
    assistant/                      Parish Assistant chat (AI)
    notifications/                  Bell notifications
    sacred-art.js                   Rotating sacred art (all portals)
    portal-profile.js               "My Profile" for the ITech and Media portals
  css/                              theme-dark, accessibility, detail-table, service-schedule, ...

Sacradigit/                         Admin + Secretary portal (pages *.html)
  js/                               Page scripts (dashboard.js, masses.js, ...)
    scanner/                        Document scanner (OCR)
  css/                              Page styles
user/                               Parishioner portal (pages *.html)
  js/                               Page scripts
  css/                              Page styles
    page-accents.css                Header colour of every Request a Service /
                                    Request a Certificate page (<html data-page="...">)
Sacraitech/                         IT team portal (pages + js/ + css/)
Sacramedia/                         Media team portal (pages + js/ + css/)

sacradigit-images/                  Images
public/                             Copied as-is to the site root (sw.js, manifest, offline page)
tools/                              Dev tools (dark theme builder, special masses import, mock community data)
server/                             Back-end helpers (AI chat proxy, email notifier)
ocr/, loading screen test/          Experiments, not linked from the portals
amplify_outputs.json                Amplify backend config (keep at the root)
```

## Where to edit

| To change...                              | Edit                                      |
|-------------------------------------------|-------------------------------------------|
| An admin page `Sacradigit/masses.html`    | `Sacradigit/js/masses.js`, `Sacradigit/css/masses.css` |
| A parishioner page `user/user-donations.html` | `user/js/user-donations.js`, `user/css/user-donations.css` |
| Any Request a Service form                | `user/js/service-request-page.js` (the page only passes its service key) |
| Any Request a Certificate form            | `user/js/certificate-request-page.js`     |
| Sign-in, roles, redirects                 | `shared/js/auth.js`                       |
| Dark mode                                 | run `node tools/build-dark-theme.mjs` (writes `shared/css/theme-dark.css`) |
