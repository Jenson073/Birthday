# Birthday Wish 🎈

An interactive, purely client-side birthday greeting. A pulsing heart turns into a seed, grows into a tree with a heart-shaped canopy of hundreds of coloured heart leaves, and a typewriter message appears beside it.

No backend, no build step, no dependencies: HTML5 + CSS3 + vanilla JavaScript (ES6) on a 2D `<canvas>`.

## Run it

Open `index.html` in a browser (double-click works). Scripts are classic `<script>` tags rather than ES modules, so it runs straight from `file://`. To serve it instead: `python3 -m http.server` in this folder.

Personalise via the URL: `index.html?name=Priya` turns the first line into "Hey Priya 💕" (defaults to "you", max 40 characters).

## Project structure

```
birthday/
├── index.html           canvas, intro button, message container, controls, <audio>
├── css/style.css        dark theme, layout, typography, cursor blink
├── js/
│   ├── tree.js          canvas scene: seed, branches, leaves, petals, slide
│   ├── typewriter.js    sequential typewriter + cursor
│   └── main.js          messages, timeline controller, music, replay
└── assets/music.mp3     OPTIONAL, not included (see "Music")
```

## What is implemented

### The animation sequence

| Phase | What happens | Duration |
|---|---|---|
| 1. Intro | Pulsing gradient heart with a glow on a `#000` canvas, plus an underlined "tap the heart" prompt. Clicking starts the show. | until clicked |
| 2a. Seed drop | The heart shrinks into a seed and falls to the baseline with gravity-style easing and a fading motion trail. A soft pink ground glow appears where it lands. | 1.0 s |
| 2b. Tree growth | A tapered pink trunk grows up and splits into recursive curved (quadratic Bézier) branches, 4 levels deep. Each branch grows progressively from its parent. | 2.7 s |
| 3. Bloom | 1,150 heart leaves bloom outward from the top of the trunk with an overshoot ("back") ease. A faint pink glow fades in behind the canopy. | 3.8 s |
| 3b. Ambient | Leaves sway gently. Every 0.25–0.7 s a leaf detaches and drifts down as a petal, then fades on the ground. The leaf regrows 2.5–4.5 s later, so the canopy never empties. | continuous |
| 4. Slide + text | The tree glides to the right half of the viewport while the message types out on the left. | slide 1.8 s, typing ≈ 15 s |

### Heart canopy

- Leaves are placed inside the parametric heart `x = 16 sin³t`, `y = 13 cos t − 5 cos 2t − 2 cos 3t − cos 4t`.
- About 28% of leaves are sampled on the outer rim for a crisp silhouette; the rest fill the interior.
- 13-colour palette: hot pinks, crimson/red, coral/orange, peach, warm yellows. Each leaf has a random size, tilt and sway phase.
- Leaves are pre-rendered into small sprites (radial-gradient highlight) and stamped with `drawImage`, which keeps ~1,150 leaves smooth.
- Branch tips are kept inside the heart silhouette so no bare twigs poke out.
- The tree is generated with a seeded PRNG, so it looks the same every time.

### Typewriter message

- 10 lines (the guide's 7, plus "And a wonderful year ahead 🎂", "With lots of love ❤️", "From your best friend 💕"). They live in the `MESSAGES` array at the top of `js/main.js`.
- Characters appear one at a time, with longer pauses on `,`, `.` and emoji. A random jitter makes it feel hand-typed.
- Grapheme-aware splitting (`Intl.Segmenter`, with an `Array.from` fallback) means emoji like ❤️ are never cut in half.
- Every line is laid out up-front with its untyped part invisible, so the text never jumps or re-wraps while typing.
- The blinking `_` cursor follows the active line and stays blinking after the last line.

### Interactivity

- **Tap/click the heart** (a real `<button>`, so Enter/Space work too) to start.
- **Click or tap the tree** after it blooms to release a burst of 22 petals at the pointer.
- **Replay** button appears when the show finishes and resets back to the intro heart.
- **Mute** button appears only if background music actually starts playing.

### Responsive layout

- **Wide screens:** the tree is centred during growth, then slides to ~74% of the width. Text sits in the left ~40%.
- **Narrow/portrait screens** (width < 720 px, or height > 1.15 × width): the tree stays centred in the lower ~60% of the screen and the text goes on top. The tree does not slide in this mode.
- Tree size is computed from the viewport, and the layout recalculates on resize.
- The canvas is scaled by `devicePixelRatio` (capped at 2) so small hearts stay sharp on Retina and mobile displays.

### Accessibility

- The canvas is `aria-hidden`; the typed text is `aria-hidden` while animating. The full message is then written once into a `role="status"` element for screen readers when typing finishes.
- Visible focus rings on the heart and control buttons.
- `prefers-reduced-motion`: animation durations are halved, the message appears instantly, and the prompt/cursor stop pulsing and blinking.
- Animation uses a clamped time step, so a stalled tab doesn't cause a huge jump on return.

### Music

An `<audio>` element points at `assets/music.mp3`. The file is **not included**. Add any track there and it starts on the first click, which also satisfies browser autoplay rules, with a mute toggle. If the file is missing, the page runs silently, the mute button stays hidden, and the browser console shows one harmless 404.

## Customising

| To change | Edit |
|---|---|
| Message lines | `MESSAGES` in `js/main.js` (`{name}` is replaced by the `?name=` value) |
| Typing speed and pauses | defaults in `js/typewriter.js` (`speed: 38`, `linePause: 380` ms) |
| Leaf colours | `PALETTE` in `js/tree.js` |
| Leaf count | the `buildLeaves(1150)` call in `js/tree.js` |
| Phase durations | the `tween(...)` calls at the end of `createScene` in `js/tree.js` |
| Trunk colour | `TRUNK_COLOR` in `js/tree.js` |

If you move the intro heart, `INTRO_Y` in `js/tree.js` and `#intro { top }` in `css/style.css` must stay in sync (both 42%).

## How it was verified

Tested in headless Chromium (desktop 1280×720 and phone 390×844) by clicking through the whole sequence and taking screenshots at each phase. A complete run, a replay and a second complete run produced no JavaScript errors; the only console message was the optional music file's 404. It has not been tested in Safari or Firefox.

## Known limitations

- No music file is bundled.
- Pale pink trunk branches are faintly visible between leaves on the right side of the canopy. This is intentional but easy to hide with more leaves.
- Total runtime from click to the last typed character is roughly 25–30 s; shorten it via the durations and typing speed above.
