# SANTA CLAWS — Original series website (v18, 3D)

Static HTML/CSS/JS site, ready for GitHub Pages. No build step.

## Deploy
Upload everything in this folder (`index.html`, `assets/`, `.nojekyll`, `README.md`) to the root of your GitHub repository, replacing the old files. In Settings > Pages, deploy from the main branch / root.

## Preview locally
The 3D layer is a JavaScript module, which browsers won't load from a double-clicked file. From this folder run `python3 -m http.server 8000` and visit http://localhost:8000.

## What's in v18
- **v18**: "BUILT TO PROTECT. / TURNED TO VENGEANCE." on two lines at the same size as its neighbouring card titles (each card grid shares one title size); arrival animations — section and card reveals and the title decrypts — now play one after another in reading order through a single queue, so during auto-scroll each section unfolds in sequence.
- **v17**: the white Morse heartbeat is a thin 1px white line with no glow (the gradient rail under it keeps its glow).
- **v16**: nav indicator restored to the original look — the 2px red→pale-pink→red gradient rail with its glow and pulsing halo — but the white dot is replaced by a white Morse-code heartbeat that writes the active link's name left to right along the rail with a glowing trail, then starts again from the left.
- **v15 (update)**: titles inside each section (timeline and feature card titles, case-report values, status readout) are set in bold IBM Plex Mono (the paragraph font, bundled in `assets/fonts`) and decrypt themselves — letters scramble then lock in left to right as they scroll into view, a red scan-line sweeps under them, they re-decode on hover, and now and then one glitches and re-decodes. Every label/title pair is coloured the same way: the small label (e.g. "01 / SERVICE", section labels, case-report field names) in white, the title it introduces in red.
- **v15**: the nav ECG is a fine 1px line over a flat baseline; each sweep writes the active link's full Morse message left to right, then resets to the flat line and starts again, like a real ECG monitor. It is centred exactly under each active link (or the logo). Below 1200px wide the nav becomes a compact single line — logo, SOUND and MENU — and MENU opens a full-width panel with every link (the active section is marked); the heart monitor under the logo then spells the active section.
- **v14**: nav logo CLAWS recoloured in the site red (#e42c38) with its metal texture kept; every title glows; the hero's icicles glint and drip (drops form at 36 traced icicle/blood-drip tips and fall); the nav heart monitor is now drawn live — a write-head sweeps left to right drawing the active link's name in Morse code as an ECG trace, fading behind it like phosphor; every local file link carries ?v=14 so browsers can't show an older copy; a small BUILD V14 stamp sits in the footer.
- **v13**: nav logo is the hero lettering on one line (`assets/logo-nav.png`); the nav heartbeat line spells the active link in Morse code (dot = sharp spike, dash = wide raised beat) and scrolls like a monitor; a red neon outline traces only the black background inside the "A" in CLAWS (`assets/a-outline.png`, traced from the artwork) and never crosses the lettering; titles set in New Rocker (self-hosted, SIL Open Font License), red lines upright; reading-aware auto-scroll in `assets/js/autoscroll.js`.
- **Layering**: snow, embers and the ghost sit behind all text and containers; containers are 70% opaque, the top nav and footer 80%.
- **Typography**: every title and subtitle stays on one line (auto-sized); justified paragraphs never hyphenate or split a word.
- **Hero blends into the page**: the 3D artwork's edges are feathered on every side, so there's no visible rectangle.
- **3D hero (WebGL / Three.js r160, bundled in `assets/vendor`)**: the key art is rendered as a lit 3D relief. The camera follows the cursor (idle sway on phones), a red key light rakes across the metal, the eyes glow and pulse together, and the hero tilts back in 3D as you scroll away.
- **3D snow and embers**: a full-page particle field the camera travels through as you scroll; scroll speed adds a gust of wind.
- **3D card tilt** on the case report, timeline and feature cards (desktop mouse only).
- **Mobile loader**: logo and loader are vertically centred; at 100% the logo flies up into its hero position.
- **Ghost Santa**: while the page is auto-scrolling, a translucent cut-out of Santa (`assets/santa-ghost.png`) fades in and out at random spots behind the content.
- **Titles**: every white line and red line of the headings stays on one line, auto-sized to fit any screen.
- **Nav highlight**: glows under the SANTA CLAWS logo on the hero, then slides to each section as you (or the auto-scroll) reach it.
- **Fallbacks**: devices without WebGL get the 2D version automatically; "reduce motion" settings get still frames and no auto-scroll.

## Other behaviour
- Auto-scroll after the intro if nobody interacts: 28% speed while a section is on screen, speeding up between sections and easing back (`READ` / `TRAVEL` in the script). Any wheel, touch, click or key press pauses it for 8 seconds.
- Background music streams from YouTube ("3 Hours of Scary, Ominous & Creepy Horror Music" by Spooky Night). It tries to start with sound immediately; where the browser blocks that, it plays muted and fades in on the visitor's first click, tap, key press or scroll (browsers that don't count scrolling as permission will wait for the first click/tap/key). For a presentation, allow autoplay for the site in the presenting browser (Safari: Settings for this website > Auto-Play > Allow All; Firefox: Permissions > Autoplay > Allow Audio and Video; Edge: edge://settings/content/mediaAutoplay) so it starts with no interaction. The MUSIC pill in the nav toggles it. It only plays when the site is served over https (e.g. GitHub Pages).
- The notify form is not connected to a mailing service.

Three.js is MIT-licensed (see `assets/vendor/three-LICENSE.txt`).
