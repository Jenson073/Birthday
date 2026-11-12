/* Timeline controller + configuration.
   Edit MESSAGES below to personalise the wish – no need to touch the engine.
   You can also personalise via the URL:  index.html?name=Priya  */
(function () {
  'use strict';

  const MESSAGES = [
    'Hey {name} 💕',
    'Happy Birthday 🎈',
    'May God bless you 🍀',
    'And give u many happiness 💕',
    "Just saying... you're pretty awesome ❤️",
    'Sending good vibes and maybe a wink 😉',
    'Hope u have a great day today ❤️🎉',
    'And a wonderful year ahead 🎂',
    'With lots of love ❤️',
    'From your best friend 💕',
  ];

  const { createScene, Typewriter } = window.Birthday;
  const sleep = Typewriter.sleep;

  const $ = (id) => document.getElementById(id);
  const intro = $('intro'), startBtn = $('start');
  const muteBtn = $('mute'), replayBtn = $('replay');
  const bgm = $('bgm');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const name = (new URLSearchParams(location.search).get('name') || 'you').trim().slice(0, 40) || 'you';
  const lines = MESSAGES.map((m) => m.replace('{name}', name));

  const scene = createScene($('stage'), { timeScale: reduced ? 0.5 : 1 });
  const typer = Typewriter.create($('typed'), lines, { instant: reduced });

  // ---- optional background music (silent if assets/music.mp3 is missing) ----
  let musicOk = true;
  bgm.querySelector('source').addEventListener('error', () => { musicOk = false; muteBtn.hidden = true; });
  bgm.addEventListener('playing', () => { muteBtn.hidden = false; });
  function startMusic() {
    if (!musicOk) return;
    const p = bgm.play();
    if (p && p.catch) p.catch(() => {});
  }
  muteBtn.addEventListener('click', () => {
    bgm.muted = !bgm.muted;
    muteBtn.setAttribute('aria-pressed', String(bgm.muted));
    muteBtn.setAttribute('aria-label', bgm.muted ? 'Unmute music' : 'Mute music');
    muteBtn.style.opacity = bgm.muted ? '.5' : '1';
  });

  // ---- the show ----
  let running = false;
  async function run() {
    if (running) return;
    running = true;
    intro.classList.add('is-hidden');
    startMusic();

    await scene.dropSeed();        // Phase 2: heart falls as a seed
    await scene.growTree();        //          trunk + branches grow
    await scene.bloom();           // Phase 3: heart-shaped canopy blooms
    scene.startPetals();           //          leaves start to drift down
    await sleep(500);

    const sliding = scene.slide(); // Phase 4: tree glides to the right half…
    await sleep(900);
    await typer.play();            //          …while the message types out on the left
    await sliding;

    $('message-sr').textContent = lines.join('. ');
    replayBtn.hidden = false;
    running = false;
  }

  startBtn.addEventListener('click', run);

  replayBtn.addEventListener('click', () => {
    replayBtn.hidden = true;
    typer.reset();
    $('message-sr').textContent = '';
    scene.reset();
    intro.classList.remove('is-hidden');
    startBtn.focus({ preventScroll: true });
  });
})();
