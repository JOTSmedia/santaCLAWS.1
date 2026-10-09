/* SANTA CLAWS — reading-aware auto-scroll
 * If the visitor hasn't interacted, the page scrolls itself at a reading pace:
 *  - READ speed (22%) while text is in the reading zone, slower where the text is dense
 *    (measured in words per pixel so the visible text is read at ~WPM words/minute);
 *  - a short eased pause ("dwell") when a new block of text (paragraph group, card row,
 *    dossier) reaches the reading line;
 *  - a smooth sin² speed-up to TRAVEL through the empty gap between sections, which only
 *    starts once the previous section's LAST text line has risen above FINISH_AT, and
 *    eases back to READ as the next section's first text reaches ARRIVE_AT.
 * Any wheel / touch / pointer / key input pauses it; it resumes after RESUME_AFTER idle.
 */
(() => {
  /* ---------- tunables ---------- */
  const BASE = 120;            // px/s at factor 1.0
  const READ = 0.22;           // reading speed factor (0.22 × 120 ≈ 26 px/s) — the ceiling while text is being read
  const TRAVEL = 1.0;          // peak factor in the gap between sections (≈120 px/s)
  const WPM = 200;             // assumed reading speed for the text in the reading zone
  const ZONE_TOP = 0.12;       // reading zone, as fractions of viewport height (just under the 70px nav …
  const ZONE_BOTTOM = 0.80;    // … down to where new text is first noticed)
  const FINISH_AT = 0.38;      // previous section counts as "read" once its last text bottom is above this
  const ARRIVE_AT = 0.18;      // speed-up has eased back to READ when the next section's first text top is here
  const DWELL_AT = 0.50;       // a new text block triggers a dwell when its top crosses this line
  const DWELL_MIN = 1.5, DWELL_MAX = 4;  // dwell length range, seconds
  const DWELL_SHARE = 0.12;    // dwell = words-to-read-the-block × this, clamped to [MIN, MAX]
  const DWELL_EASE = 0.6;      // seconds to ease into / out of a dwell
  const SMOOTH = 2.2;          // low-pass rate (1/s) applied to every speed change
  const START_DELAY = 3500, RESUME_AFTER = 8000;

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const root = document.documentElement;
  const SECTIONS = ['#top', '#story', '#chapters', '.mechanics', '#signal', 'footer'];
  const TEXT = 'p,h1,h2,h3,dt,dd,blockquote,.section-id,.eyebrow,.series-tagline,.dossier-title,.dossier-foot,.timeline-entry>span,.num,.label,.value,.signal';
  const BLOCKS = '.hero-content p,.intro .body-copy,.dossier,.timeline-entry,.mechanics-header,.feature,.mechanical-panel,.transmission p';
  const WPS = WPM / 60;

  let running = false, last = 0, acc = 0, speed = 0, userTouched = false, resumeTimer = 0, raf = 0;
  let texts = [], gaps = [], rows = [], measuredAt = -1e9, dwellStart = -1, dwellLen = 0;

  const words = el => (el.textContent.trim().match(/\S+/g) || []).length;
  const docTop = el => el.getBoundingClientRect().top + scrollY;
  const visible = el => el.offsetParent !== null && !el.closest('[aria-hidden="true"]');
  const atBottom = () => innerHeight + scrollY >= root.scrollHeight - 2;
  const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);

  /* Measure text blocks (doc coordinates). Re-run every second: fonts, reveals and resizes move things. */
  function measure(now) {
    measuredAt = now;
    const vh = innerHeight;
    const secs = SECTIONS.map(q => document.querySelector(q)).filter(Boolean);
    texts = [];
    const bySec = secs.map(() => []);
    secs.forEach((sec, i) => sec.querySelectorAll(TEXT).forEach(el => {
      if (!visible(el) || (el.parentElement.closest(TEXT) && sec.contains(el.parentElement.closest(TEXT)))) return; // skip hidden / nested
      const r = el.getBoundingClientRect(), w = words(el);
      if (!w || r.height < 1) return;
      const t = { top: r.top + scrollY, bot: r.bottom + scrollY, w };
      texts.push(t); bySec[i].push(t);
    }));
    /* Travel gaps: from "previous section's last text is above FINISH_AT" to "next section's first text is at ARRIVE_AT" */
    gaps = [];
    const maxY = root.scrollHeight - vh;
    for (let i = 0; i + 1 < secs.length; i++) {
      const a = bySec[i], b = bySec[i + 1];
      if (!a.length || !b.length) continue;
      const s0 = Math.max(...a.map(t => t.bot)) - FINISH_AT * vh;
      const s1 = Math.min(maxY, Math.min(...b.map(t => t.top)) - ARRIVE_AT * vh); // ease back before the page ends
      if (s1 - s0 > 40) gaps.push([s0, s1]);
    }
    /* Dwell blocks, grouped into rows (side-by-side cards share one dwell) */
    const old = rows; rows = [];
    document.querySelectorAll(BLOCKS).forEach(el => {
      if (!visible(el)) return;
      const top = docTop(el), w = words(el);
      const row = rows.find(r => Math.abs(r.top - top) < 30);
      if (row) row.w += w; else rows.push({ top, w, fired: false });
    });
    rows.forEach(r => { const o = old.find(x => Math.abs(x.top - r.top) < 60); if (o) r.fired = o.fired; });
  }

  /* Target speed (px/s) at the current scroll position */
  function target(now) {
    const vh = innerHeight, y = scrollY;
    const left = root.scrollHeight - vh - y;              // ease to a stop on the last few px
    return Math.min(6 + left * 0.6, rawTarget(now, vh, y));
  }
  function rawTarget(now, vh, y) {
    /* 1. Between sections: sin² bump over the empty stretch */
    for (const [s0, s1] of gaps) {
      if (y > s0 && y < s1) {
        const k = Math.sin(Math.PI * (y - s0) / (s1 - s0));
        return (READ + (TRAVEL - READ) * k * k) * BASE;
      }
    }
    /* 2. Reading: cap speed so the words in the zone are consumed at ≤ WPS.
       Each text element spreads its words over its height; time spent ≈ words / WPS. */
    const z0 = y + ZONE_TOP * vh, z1 = y + ZONE_BOTTOM * vh;
    let w = 0;
    for (const t of texts) {
      const ov = Math.min(t.bot, z1) - Math.max(t.top, z0);
      if (ov > 0) w += t.w * ov / (t.bot - t.top);
    }
    let v = READ * BASE;
    if (w > 0) v = Math.min(v, WPS * (z1 - z0) / w);
    /* 3. Dwell: when a new text block reaches DWELL_AT, ease to a stop, hold, ease back */
    const line = y + DWELL_AT * vh;
    for (const r of rows) {
      if (r.top > line + 60) r.fired = false;                // scrolled back above it → may dwell again
      else if (!r.fired && r.top <= line) {
        r.fired = true;
        if (r.top > line - 200 && dwellStart < 0) {          // only if it just arrived (not skipped past)
          dwellStart = now;
          dwellLen = Math.min(DWELL_MAX, Math.max(DWELL_MIN, r.w / WPS * DWELL_SHARE));
        }
      }
    }
    if (dwellStart >= 0) {
      const e = (now - dwellStart) / 1000, end = DWELL_EASE * 2 + dwellLen;
      if (e >= end) dwellStart = -1;
      else v *= 1 - Math.min(smooth(e / DWELL_EASE), smooth((end - e) / DWELL_EASE));
    }
    return v;
  }

  function step(t) {
    if (!running) return;
    const dt = Math.min(250, t - (last || t)) / 1000; last = t;
    if (t - measuredAt > 1000) measure(t);
    speed += (target(t) - speed) * Math.min(1, dt * SMOOTH);   // always low-pass: no jerks
    acc += speed * dt;
    const px = Math.floor(acc);
    if (px >= 1) { acc -= px; window.scrollTo({ top: scrollY + px, behavior: 'instant' }); }
    if (atBottom()) { stop(); return; }
    raf = requestAnimationFrame(step);
  }

  function start() {
    if (running || atBottom() || document.hidden) return;
    running = true; last = 0; acc = 0; speed = 0; dwellStart = -1; measuredAt = -1e9;
    root.style.scrollBehavior = 'auto';
    root.classList.add('autoscrolling');   // the ghost animation depends on this class
    raf = requestAnimationFrame(step);
  }
  function stop() {
    running = false; cancelAnimationFrame(raf);
    root.style.scrollBehavior = '';
    root.classList.remove('autoscrolling');
  }
  function interrupt(e) {
    if (e && e.target && e.target.closest && e.target.closest('#music')) return;
    userTouched = true; stop();
    clearTimeout(resumeTimer); resumeTimer = setTimeout(start, RESUME_AFTER);
  }

  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(ev => addEventListener(ev, interrupt, { passive: true }));
  addEventListener('resize', () => { measuredAt = -1e9; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (!userTouched) setTimeout(start, 1500); });

  const begin = () => setTimeout(() => { if (!userTouched) start(); }, START_DELAY);
  if (document.body.classList.contains('loaded')) begin();
  else new MutationObserver((m, o) => { if (document.body.classList.contains('loaded')) { o.disconnect(); begin(); } })
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
