/* ============================================
   SacraDigit — Back button for step-by-step forms
   Without this, the phone/browser Back button on
   step 3 of a form leaves the page and every answer
   is lost. Each step the person moves to gets its
   own history entry, so Back goes one step back.
   ============================================ */

/**
 * @param {string} key          unique per form on the page, e.g. 'cert-baptismal'
 * @param {(step:number)=>void} showStep  shows a step WITHOUT recording it again
 * @param {()=>boolean} isAlive  false once the form has been removed from the page
 * @returns {{ moved(step:number):void, leave():number }}
 *   moved: call from the form's go() after every step change
 *   leave: forget the recorded steps; returns how many entries to rewind
 *          (history.go(-n)) to get back to where the form started
 */
export function stepHistory(key, showStep, isAlive = () => true) {
  let trail = [];          // steps of our own history entries, oldest first
  let restoring = false;

  const onPop = (e) => {
    if (!isAlive()) { window.removeEventListener('popstate', onPop); return; }
    const entry = e.state?.[key];
    if (!entry) return;
    trail.length = entry.depth + 1;
    trail[entry.depth] = entry.step;
    restoring = true;
    try { showStep(entry.step); } finally { restoring = false; }
  };
  window.addEventListener('popstate', onPop);

  const record = (step, depth, replace) => {
    const state = { ...(history.state || {}), [key]: { step, depth } };
    if (replace) history.replaceState(state, ''); else history.pushState(state, '');
  };

  return {
    moved(step) {
      if (restoring) return;
      if (!trail.length) { trail = [step]; record(step, 0, true); return; }
      const last = trail.length - 1;
      if (trail[last] === step) return;
      // The form's own "← Back": rewind instead of stacking a new entry.
      if (last > 0 && trail[last - 1] === step) { history.back(); return; }
      trail.push(step);
      record(step, trail.length - 1, false);
    },
    leave() {
      const extra = Math.max(0, trail.length - 1);
      trail = [];
      return extra;
    },
  };
}
