// amplify-init.js (Sacradigit copy) — used by seed-mock-data.js and
// seed-mock-masses-schedules.js. Re-exports the project-root client so
// there is only ONE amplify_outputs.json (at the project root) to keep
// up to date after each backend deploy.
export { client } from '../amplify-init.js';
