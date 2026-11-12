/* Sequential typewriter with a blinking cursor.
   Every line is created up-front with its full text hidden, so the layout is
   stable (no jumping) while characters are revealed one by one. */
(function (global) {
  'use strict';

  const segmenter = (typeof Intl !== 'undefined' && Intl.Segmenter)
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

  // Grapheme-aware split so emoji like "❤️" or "🎉" are never cut in half.
  function split(text) {
    return segmenter
      ? Array.from(segmenter.segment(text), (s) => s.segment)
      : Array.from(text);
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const isEmoji = (g) => /\p{Extended_Pictographic}/u.test(g);

  function create(container, lines, options) {
    const opts = Object.assign({ speed: 38, linePause: 380, instant: false }, options);
    let rows = [];

    function build() {
      container.textContent = '';
      rows = lines.map((text) => {
        const p = document.createElement('p');
        p.className = 'line';
        const typed = document.createElement('span');
        typed.className = 'typed';
        const cursor = document.createElement('span');
        cursor.className = 'cursor';
        cursor.textContent = '_';
        cursor.hidden = true;
        const rest = document.createElement('span');
        rest.className = 'rest';
        rest.textContent = text;
        p.append(typed, cursor, rest);
        container.appendChild(p);
        return { text, chars: split(text), typed, cursor, rest };
      });
    }

    function charDelay(g) {
      if (isEmoji(g)) return 200;
      if (g === ',') return 180;
      if (g === '.') return 130;
      return opts.speed + Math.random() * 30;
    }

    async function play() {
      build();
      if (opts.instant) {
        rows.forEach((r) => { r.typed.textContent = r.text; r.rest.textContent = ''; });
        return;
      }
      let last = null;
      for (const row of rows) {
        if (last) last.cursor.hidden = true;
        row.cursor.hidden = false;
        last = row;
        let shown = '';
        for (let i = 0; i < row.chars.length; i++) {
          shown += row.chars[i];
          row.typed.textContent = shown;
          row.rest.textContent = row.chars.slice(i + 1).join('');
          await sleep(charDelay(row.chars[i]));
        }
        await sleep(opts.linePause);
      }
      // The final line keeps its blinking cursor.
    }

    function reset() { container.textContent = ''; rows = []; }

    return { play, reset };
  }

  global.Birthday = global.Birthday || {};
  global.Birthday.Typewriter = { create, sleep };
})(window);
