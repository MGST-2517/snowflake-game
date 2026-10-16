'use strict';

/* ==========================================================
   ✏️  EDIT ME: personal text and game settings
   ========================================================== */
const RECIPIENT_NAME = "Sakshi";                    // her name, used on the welcome screen, the finale and the credit
const ACHIEVEMENT_TITLE = "My Favourite Snowflake"; // shown when she wins
const NICKNAME = "Snowflake";                       // what you call her
const UNIVERSE_TITLE = "Our Little Universe";       // the name of this world: welcome screen, map and book buttons
const INTRO_LINE = `Somewhere beneath a quiet winter sky, a little world was waiting for its ${NICKNAME}.`;   // welcome screen
const INVITE_LINE = "Come in, and catch a few snowflakes.";   // gentle invitation under her name
// The letter shown at the end. Use \n inside the quotes for a new line.
const BIRTHDAY_MESSAGE =
  "Happy Birthday, my Snowflake. In a world full of ordinary days, you make mine feel magical. ❤️";
const TARGET_SCORE = 500;   // points needed to win
const GAME_SECONDS = 90;    // length of a Standard round (Relaxed Mode has no timer)
const RAMP_SECONDS = 45;    // difficulty is tuned as if the ramp took this long; it is stretched over GAME_SECONDS
const RELAXED_CAP = 0.5;    // Relaxed Mode never gets harder than half way up the ramp
const WIN_TITLE = `You caught ${TARGET_SCORE} points of magic, ${RECIPIENT_NAME}! ❄️`;   // built from the values above
// ---- Memory Snowflakes: the story pages (edit text here; keep the ids as they are) ----
// They appear in this order. "scene" picks the little animated picture on each page.
const MEMORIES = [
  { id: 'beginning', scene: 'fest', mapName: "The Beginning", photo: "photos/01-the-beginning.jpg", date: "February 10, 2024", title: "The Day Our Story Began",
    story: "This is the day we met, at a college fest. Neither of us knew then how important that ordinary-looking day would become." },
  { id: 'first-text', scene: 'text', mapName: "Our First Conversation", photo: "photos/02-first-conversation.jpg", date: "February 11, 2024", title: "Our First Conversation",
    story: "The day after we met, we sent our first text. It was such a small beginning, and it became the start of something much bigger." },
  { id: 'rainy-day', scene: 'rain', mapName: "The Rainy Crossing", photo: "photos/03-rainy-crossing.jpg", place: "Rajiv Chowk", date: "September 2, 2024", title: "Hold My Hand",
    story: "We met again at Rajiv Chowk. You wore a blue T-shirt and black jeans. It rained, and you asked me to hold your hand so you wouldn't slip. This is one of the moments I wanted to keep safe in this little game." },
  { id: 'three-words', scene: 'words', mapName: "Three Little Words", photo: "photos/04-three-little-words.jpg", date: "September 14, 2024", title: "Three Little Words",
    story: "During a word dare, I told you that I liked you. It was a small moment, but it deserves its own place in our story." },
  { id: 'lodhi-garden', scene: 'garden', mapName: "The Garden of Golden Leaves", photo: "photos/05-lodhi-garden.jpg", place: "Lodhi Garden", date: "October 9, 2024", title: "Our Lodhi Garden Memory",
    story: "We met at Lodhi Garden. You wore a yellow T-shirt and black jeans. This was a particularly meaningful day for me, and I want to keep this memory alive." }
];
/* ========================================================== */

const GOLD_CHANCE = 0.12;   // chance that a snowflake is golden
const NORMAL_POINTS = 10;
const GOLD_POINTS = 50;
const BEST_KEY = 'catchSnowflakesBest';
const MEMORY_KEY = 'catchSnowflakesMemories';   // where found memories are saved in the browser
const MEMORY_POINTS = 20;                      // small bonus for catching a Memory Snowflake
const MEM_TEST = String(window.location && window.location.search).indexOf('memtest') >= 0;   // open index.html?memtest to see memories quickly

// ---- Collectibles, combo and power-up tuning ----
const HEART_POINTS = 20;                     // bonus for a heart
const SLOW_SECONDS = 5, SLOW_FACTOR = 0.5;   // slow-mo: how long, and how fast things fall (0.5 = half speed)
const MULTI_SECONDS = 6, MULTI_VALUE = 2;    // double points: how long, and the multiplier
const COMBO_MIN_SHOW = 3;                    // "COMBO xN!" text appears from this many catches
const COMBO_STEP = 5, COMBO_BONUS_CAP = 20;  // bonus every 5th catch, at most +20
const COMBO_LIVES = 3;                       // miss this many in a row and the combo ends
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Page elements ----------
const $ = (id) => document.getElementById(id);
const stage = $('stage'), canvas = $('game'), ctx = canvas.getContext('2d');
const scoreEl = $('score'), timeEl = $('time'), bestEl = $('best'), meterFill = $('meterFill');
const pauseBtn = $('pauseBtn'), restartBtn = $('restartBtn'), muteBtn = $('muteBtn');
const overlays = ['startOverlay', 'pauseOverlay', 'overOverlay', 'winOverlay', 'memoryOverlay', 'bookOverlay'].map($);
const bookOverlay = $('bookOverlay');
const meterEl = $('meter'), timeLabel = $('timeLabel');
const comboBadge = $('comboBadge'), slowBadge = $('slowBadge'), multiBadge = $('multiBadge');
const slowBar = $('slowBar'), multiBar = $('multiBar'), slowSecs = $('slowSecs'), multiSecs = $('multiSecs');
const comboText = $('comboText'), bannerEl = $('banner'), srEl = $('sr');

// ---------- Game state ----------
// state is one of: 'menu', 'playing', 'paused', 'over', 'won'
let state = 'menu';
let W = 0, H = 0;
let score = 0, timeLeft = GAME_SECONDS, playT = 0, best = 0, spawnTimer = 0;   // playT = seconds actually played
let mode = 'standard';   // 'standard' (timed) or 'relaxed' (no timer), chosen on the welcome screen
let flakes = [], particles = [], floaters = [], ambient = [], rings = [];
let shownScore = 0, fireworkT = 0;
let combo = 0, misses = 0, maxCombo = 0, slowT = 0, multiT = 0, slowFactor = 1, powerGap = 0, comboShowT = 0, bannerT = 0;
const cool = { heart: 0, slow: 0, multi: 0, memory: 0 };   // cooldowns so special items stay rare
let ambientSlow = 1;                           // 1 = normal snowfall, lower = calmer (used in the finale)
const win = { t: 0, parts: [], revealed: false, cardTop: 0, fw: 0 };   // finale state
let memRound = 0, memGap = 0, pendingMemory = null, bookReturn = 'startOverlay';
let winAfterMemory = false;   // the winning catch was a Memory Snowflake: show its page first, then the finale
const memScene = { open: false, pending: 0, start: null, name: 'fest', returnTo: null, current: null, photo: false };   // memory page state
let targetX = 0;
const keys = { left: false, right: false };
const basket = { x: 0, w: 120, h: 72, squash: 0 };
let rafId = 0, lastTime = 0;

try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { best = 0; }
bestEl.textContent = best;
let found = loadFound();   // ids of the memories she has discovered (saved between visits)
$('winTitle').textContent = WIN_TITLE;
$('achTitle').textContent = ACHIEVEMENT_TITLE;
setLetter(BIRTHDAY_MESSAGE);
$('universeTitle').textContent = UNIVERSE_TITLE;
$('introLine').textContent = INTRO_LINE;
$('inviteLine').textContent = INVITE_LINE;
['forName', 'creditName', 'creditName2'].forEach((id) => { $(id).textContent = RECIPIENT_NAME; });

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Twinkling stars (DOM) ----------
(function makeStars() {
  const box = $('stars');
  const count = reducedMotion ? 40 : 70;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    const size = rand(1.5, 3.5);
    s.className = 'star';
    s.style.cssText = `left:${rand(0, 100)}%;top:${rand(0, 100)}%;width:${size}px;height:${size}px;` +
      `--d:${rand(2, 5)}s;--delay:${rand(0, 4)}s`;
    box.appendChild(s);
  }
})();

// ---------- Sound (Web Audio, safe if blocked) ----------
let audioCtx = null, muted = false;

function initAudio() {            // call from a user click/tap/key
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  } catch (e) { audioCtx = null; }
}

function tone(freq, dur, type = 'sine', vol = 0.12, delay = 0, slideTo = 0) {
  if (muted || !audioCtx) return;
  try {
    const t = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  } catch (e) { /* audio is optional */ }
}

const sfx = {
  catch: () => tone(rand(700, 900), 0.15, 'sine', 0.12, 0, 1200),
  gold: () => [880, 1109, 1319, 1760].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, i * 0.07)),
  start: () => [523, 659, 784].forEach((f, i) => tone(f, 0.2, 'sine', 0.1, i * 0.08)),
  over: () => [440, 392, 330].forEach((f, i) => tone(f, 0.3, 'sine', 0.1, i * 0.15)),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, 'sine', 0.07, i * 0.14)),
  reveal: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.6, 'sine', 0.06, i * 0.12)),
  tick: () => tone(1000, 0.06, 'square', 0.04),
  heart: () => [784, 988].forEach((f, i) => tone(f, 0.22, 'sine', 0.11, i * 0.08)),
  slow: () => tone(900, 0.55, 'sine', 0.12, 0, 260),
  multi: () => [440, 660, 880, 1320].forEach((f, i) => tone(f, 0.18, 'triangle', 0.11, i * 0.06)),
  expire: () => tone(520, 0.35, 'sine', 0.08, 0, 240),
  combo: (c) => tone(500 + Math.min(c, 20) * 30, 0.12, 'triangle', 0.08),
  lost: () => tone(300, 0.25, 'sine', 0.07, 0, 180),
  memory: () => [784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.7, 'sine', 0.07, i * 0.11))
};

// ---------- Sizing ----------
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const oldW = W || window.innerWidth;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  basket.w = clamp(W * 0.2, 96, 150);
  basket.h = basket.w * 0.6;
  basket.x = clamp((basket.x || W / 2) * (W / oldW), 0, W);
  targetX = basket.x;
  const n = reducedMotion ? 25 : 70;
  while (ambient.length < n) ambient.push(newAmbient(true));
  if (!layers.length) buildScene();                       // first time: build immediately
  else { clearTimeout(sceneTimer); sceneTimer = setTimeout(buildScene, 120); }   // while resizing: wait a moment
  if (state === 'won' && win.revealed) measureCard();
}
function newAmbient(anywhere) {
  return { x: rand(0, W), y: anywhere ? rand(0, H) : -5, r: rand(0.8, 2.4), vy: rand(10, 35), ph: rand(0, 6.28) };
}
window.addEventListener('resize', resize);

/* ==========================================================
   🏔️  SCENERY: moon, aurora, mountains, pines and parallax.
   The static layers are painted ONCE into off-screen canvases
   (buildScene) and only copied each frame, which keeps it fast.
   ========================================================== */
const sceneCanvas = $('scene'), sctx = sceneCanvas.getContext('2d');
let SDPR = 1, layers = [], moonSprite = null, moonSize = 0, glowSprites = [], bokeh = [], parallax = 0;
let sceneTimer = 0;
const PAD = 0.06;   // extra width each side of a layer, so it can slide for parallax
const AURORA = [['191,230,255', 0.2, 0.15], ['201,184,255', 0.22, 0.2], ['255,194,221', 0.14, 0.17]];

function seeded(seed) {   // tiny repeatable random generator: the scenery looks the same every time
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeLayer(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * SDPR); c.height = Math.round(h * SDPR);
  const g = c.getContext('2d');
  g.scale(SDPR, SDPR);
  draw(g, w, h);
  return c;
}
// returns y(x): a ridge line built from three waves ("sharp" makes pointy mountain peaks)
function ridge(seed, base, amp, freq, sharp) {
  const r = seeded(seed);
  const waves = [0, 1, 2].map((i) => ({ f: freq * (1 + i * 1.9), p: r() * 6.28, a: [0.55, 0.3, 0.15][i] }));
  return (x) => base - amp * waves.reduce((s, w) => {
    const v = sharp ? 1 - Math.abs(Math.sin(x * w.f + w.p)) : 0.5 + 0.5 * Math.sin(x * w.f + w.p);
    return s + v * w.a;
  }, 0);
}
function fillRidge(g, w, h, fn, y0, y1, stops, rim) {
  const grad = g.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
  g.fillStyle = grad;
  g.beginPath(); g.moveTo(0, h);
  for (let x = 0; x <= w; x += 6) g.lineTo(x, fn(x));
  g.lineTo(w, h); g.closePath(); g.fill();
  if (rim) {
    g.strokeStyle = rim; g.lineWidth = 1.5; g.beginPath();
    for (let x = 0; x <= w; x += 6) { if (x) g.lineTo(x, fn(x)); else g.moveTo(x, fn(x)); }
    g.stroke();
  }
}
function pine(g, x, y, h, color, snow) {
  g.fillStyle = color;
  g.fillRect(x - h * 0.03, y - h * 0.14, h * 0.06, h * 0.14);
  for (let k = 0; k < 3; k++) {
    const base = y - h * 0.1 - k * h * 0.27, top = base - h * 0.42, hw = h * 0.27 * (1 - k * 0.22);
    g.fillStyle = color;
    g.beginPath(); g.moveTo(x - hw, base); g.lineTo(x, top); g.lineTo(x + hw, base); g.closePath(); g.fill();
    g.fillStyle = snow;   // a little snow on one side of each tier
    g.beginPath(); g.moveTo(x, top); g.lineTo(x + hw * 0.5, top + (base - top) * 0.5);
    g.lineTo(x - hw * 0.1, top + (base - top) * 0.42); g.closePath(); g.fill();
  }
}
function forest(g, fn, from, to, hMin, hMax, gapMin, gapMax, color, snow, r) {
  for (let x = from; x < to; x += gapMin + r() * (gapMax - gapMin)) {
    if (r() < 0.15) continue;   // leave natural clearings
    pine(g, x, fn(x) + 4, hMin + r() * (hMax - hMin), color, snow);
  }
}

function buildScene() {
  SDPR = Math.min(window.devicePixelRatio || 1, 1.5);
  sceneCanvas.width = Math.round(W * SDPR);
  sceneCanvas.height = Math.round(H * SDPR);
  const lw = W * (1 + PAD * 2), unit = Math.min(W, H), r = seeded(7);
  const sf = 5.6 / clamp(lw, 600, 1500);   // wave frequency that scales with screen width
  layers = [
    { k: 0.02, img: makeLayer(lw, H, (g) => {            // far mountains
      fillRidge(g, lw, H, ridge(11, H * 0.78, H * 0.4, sf, true), H * 0.38, H * 0.8,
        ['#e4daff', '#8f80dc', '#3a2b84'], 'rgba(255,255,255,0.45)');
    }) },
    { k: 0.05, img: makeLayer(lw, H, (g) => {            // nearer mountains
      fillRidge(g, lw, H, ridge(23, H * 0.84, H * 0.3, sf * 1.5, true), H * 0.5, H * 0.86,
        ['#cfe9ff', '#6a5bbf', '#241657'], 'rgba(220,240,255,0.5)');
    }) },
    { k: 0.08, img: makeLayer(lw, H, (g) => {            // snowy hills with distant pines
      const fn = ridge(31, H * 0.9, H * 0.07, sf * 0.8, false);
      forest(g, fn, 0, lw, unit * 0.06, unit * 0.1, unit * 0.03, unit * 0.07, '#2d1f6e', 'rgba(215,230,255,0.55)', r);
      fillRidge(g, lw, H, fn, H * 0.8, H * 0.95, ['#a89bec', '#5a49aa', '#2a1c63'], 'rgba(255,255,255,0.5)');
    }) },
    { k: 0.12, img: makeLayer(lw, H, (g) => {            // foreground snow with big pines at the edges
      const fn = ridge(47, H * 0.955, H * 0.02, sf * 1.2, false), edge = lw * 0.2;
      forest(g, fn, 0, edge, unit * 0.14, unit * 0.22, unit * 0.07, unit * 0.12, '#1d1350', 'rgba(225,238,255,0.7)', r);
      forest(g, fn, lw - edge, lw, unit * 0.14, unit * 0.22, unit * 0.07, unit * 0.12, '#1d1350', 'rgba(225,238,255,0.7)', r);
      fillRidge(g, lw, H, fn, H * 0.9, H, ['#cfc4f6', '#9d8ce0', '#6f5cbc'], 'rgba(255,255,255,0.85)');
    }) }
  ];

  const mr = clamp(unit * 0.075, 26, 64);                // glowing moon sprite
  moonSize = mr * 8;
  moonSprite = makeLayer(moonSize, moonSize, (g, s) => {
    const c = s / 2;
    const gl = g.createRadialGradient(c, c, mr * 0.8, c, c, c);
    gl.addColorStop(0, 'rgba(255,236,250,0.5)');
    gl.addColorStop(0.4, 'rgba(201,184,255,0.18)');
    gl.addColorStop(1, 'rgba(201,184,255,0)');
    g.fillStyle = gl; g.fillRect(0, 0, s, s);
    const d = g.createRadialGradient(c - mr * 0.3, c - mr * 0.3, mr * 0.1, c, c, mr);
    d.addColorStop(0, '#fffdf8'); d.addColorStop(1, '#e6d9ff');
    g.fillStyle = d; g.shadowColor = '#ffe9f6'; g.shadowBlur = mr * 0.8;
    g.beginPath(); g.arc(c, c, mr, 0, 6.28); g.fill();
    g.shadowBlur = 0; g.fillStyle = 'rgba(170,150,220,0.28)';
    [[-0.3, -0.1, 0.2], [0.25, 0.2, 0.28], [0.1, -0.4, 0.13], [-0.2, 0.4, 0.12]].forEach(([dx, dy, rr]) => {
      g.beginPath(); g.arc(c + dx * mr, c + dy * mr, rr * mr, 0, 6.28); g.fill();
    });
  });

  glowSprites = ['255,194,221', '191,230,255'].map((rgb) => makeLayer(64, 64, (g) => {   // soft bokeh orbs
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${rgb},0.9)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }));
  bokeh = [];
  const n = reducedMotion ? 6 : 14;
  for (let i = 0; i < n; i++) {
    bokeh.push({ x: rand(0, W), y: rand(0, H), r: rand(10, 36), vy: -rand(4, 12), a: rand(0.1, 0.25), s: i % 2, ph: rand(0, 6.28) });
  }
}

function drawAurora(t) {
  sctx.save();
  sctx.globalCompositeOperation = 'lighter';
  AURORA.forEach(([rgb, alpha, y0], i) => {
    const base = H * y0, amp = H * 0.045, depth = H * 0.3, sp = t * (0.18 + i * 0.07);
    const g = sctx.createLinearGradient(0, base - amp, 0, base + depth);
    g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.25, `rgba(${rgb},${alpha})`); g.addColorStop(1, `rgba(${rgb},0)`);
    sctx.fillStyle = g;
    sctx.beginPath(); sctx.moveTo(0, base + depth);
    for (let x = 0; x <= W + 24; x += 24) {
      sctx.lineTo(x, base + Math.sin(x * 0.006 * (1 + i * 0.4) + sp) * amp + Math.sin(x * 0.015 + sp * 1.7) * amp * 0.4);
    }
    sctx.lineTo(W + 24, base + depth); sctx.closePath(); sctx.fill();
  });
  sctx.restore();
}
function drawBokeh(dt) {
  for (const b of bokeh) {
    if (!reducedMotion) {
      b.y += b.vy * dt * ambientSlow; b.x += Math.sin(b.ph += dt * 0.4) * 6 * dt;
      if (b.y < -b.r * 2) { b.y = H + b.r * 2; b.x = rand(0, W); }
    }
    sctx.globalAlpha = b.a;
    sctx.drawImage(glowSprites[b.s], b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
  sctx.globalAlpha = 1;
}
function drawScene(t, dt) {
  if (!moonSprite) return;
  sctx.setTransform(SDPR, 0, 0, SDPR, 0, 0);
  sctx.clearRect(0, 0, W, H);
  const target = reducedMotion ? 0 : basket.x / W - 0.5;      // parallax follows the basket
  parallax += (target - parallax) * Math.min(1, dt * 4);
  drawAurora(t);
  sctx.drawImage(moonSprite, W * 0.78 - parallax * W * 0.015 - moonSize / 2, H * 0.27 - moonSize / 2, moonSize, moonSize);
  layers.forEach((L, i) => {
    if (i === 2) drawBokeh(dt);                               // orbs float between mountains and hills
    sctx.drawImage(L.img, -W * PAD - parallax * L.k * W, 0, W * (1 + PAD * 2), H);
  });
}

/* ==========================================================
   ✦  MEMORY SNOWFLAKES
   A rare snowflake that opens a page from your story. Memories come out
   in the order of the MEMORIES list at the top of this file. Found ones
   are saved in this browser and can be reread in the Memory book.
   ========================================================== */
const MW = 480, MH = 220;   // size of the little picture on each page
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };   // repeatable "random"
const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
function mixRgb(a, b, k) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',');
}
const mix = (a, b, k) => 'rgb(' + mixRgb(a, b, k) + ')';
function glowDot(c, x, y, r, rgb, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
  g.addColorStop(1, 'rgba(' + rgb + ',0)');
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}
function skyGrad(c, stops) {
  const g = c.createLinearGradient(0, 0, 0, MH);
  stops.forEach(([p, col]) => g.addColorStop(p, col));
  c.fillStyle = g; c.fillRect(0, 0, MW, MH);
}
function sparkles(c, t, n, rgb) {   // soft particles floating upward
  for (let i = 0; i < n; i++) {
    const x = hash(i * 3) * MW + Math.sin(t * 0.5 + i) * 10;
    const y = MH + 10 - ((t * (8 + hash(i * 5) * 14) + hash(i * 7) * MH) % (MH + 20));
    c.fillStyle = 'rgba(' + rgb + ',' + (0.25 + 0.5 * hash(i * 13)) + ')';
    c.beginPath(); c.arc(x, y, 1 + hash(i * 11) * 1.8, 0, 6.28); c.fill();
  }
}
function starfield(c, t, n) {
  for (let i = 0; i < n; i++) {
    const a = 0.3 + 0.7 * Math.abs(Math.sin(t * (0.5 + hash(i + 200)) + i));
    c.fillStyle = 'rgba(255,255,255,' + a * 0.85 + ')';
    c.beginPath(); c.arc(hash(i) * MW, hash(i + 100) * MH * 0.85, 0.7 + hash(i + 50) * 1.2, 0, 6.28); c.fill();
  }
}

// One small animated picture per memory. Each is a pure function of time t (seconds).
const MEM_SCENES = {
  fest(c, t) {     // college-fest evening: warm lights in the distance, floating particles, winter glow
    skyGrad(c, [[0, '#1d1040'], [0.55, '#4a2a8a'], [1, '#b0587a']]);
    c.strokeStyle = 'rgba(255,220,170,0.25)'; c.lineWidth = 1; c.beginPath();
    for (let x = 0; x <= MW; x += 8) { const y = 52 + Math.sin((x / MW) * Math.PI) * 18; if (x) c.lineTo(x, y); else c.moveTo(x, y); }
    c.stroke();
    for (let i = 0; i < 14; i++) {
      const x = 20 + i * 33, y = 52 + Math.sin((x / MW) * Math.PI) * 18;
      glowDot(c, x, y, 16, '255,200,130', 0.55 * (0.6 + 0.4 * Math.sin(t * 2 + i * 1.7)) * ease(t - i * 0.12));
    }
    for (let i = 0; i < 16; i++) {
      const x = hash(i) * MW, y = 120 + hash(i + 40) * 70, r = 8 + hash(i + 80) * 16;
      glowDot(c, x, y, r, i % 3 ? '255,180,120' : '255,194,221', (0.25 + 0.2 * Math.sin(t * 1.3 + i)) * ease(t * 0.8));
    }
    sparkles(c, t, 26, '255,255,255');
    glowDot(c, MW / 2, MH, 220, '191,230,255', 0.18);
  },
  text(c, t) {     // two tiny lights appear, one after the other, in a quiet starlit sky
    skyGrad(c, [[0, '#0f0a2e'], [1, '#2a2468']]);
    starfield(c, t, 40);
    const a = ease(t - 0.8), b = ease(t - 2.0);
    const y1 = 112 + Math.sin(t * 1.2) * 3, y2 = 104 + Math.sin(t * 1.2 + 1.5) * 3;
    glowDot(c, 170, y1, 46, '191,230,255', 0.55 * a);
    glowDot(c, 310, y2, 46, '255,194,221', 0.55 * b);
    c.fillStyle = 'rgba(255,255,255,' + a + ')'; c.beginPath(); c.arc(170, y1, 4, 0, 6.28); c.fill();
    c.fillStyle = 'rgba(255,255,255,' + b + ')'; c.beginPath(); c.arc(310, y2, 4, 0, 6.28); c.fill();
    glowDot(c, 240, 108, 70, '201,184,255', 0.18 * ease(t - 3.5));
  },
  rain(c, t) {     // blue evening: rain turns into snow, two soft silhouettes below
    skyGrad(c, [[0, '#14245a'], [0.6, '#2e4f9a'], [1, '#6d7fc4']]);
    const k = ease((t - 2) / 4);   // 0 = rain, 1 = snow
    for (let i = 0; i < 70; i++) {
      const sp = 110 + hash(i) * 90, y = ((hash(i + 3) * MH + t * sp) % (MH + 20)) - 10;
      const x = hash(i + 9) * MW + Math.sin(t * 0.8 + i) * 8 * k - (1 - k) * y * 0.15, len = (1 - k) * 14;
      if (len > 1) { c.strokeStyle = 'rgba(200,225,255,' + (0.5 * (1 - k) + 0.1) + ')'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x - len * 0.25, y - len); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,' + (0.15 + 0.75 * k) + ')'; c.beginPath(); c.arc(x, y, 0.8 + k * 1.6 * hash(i + 5), 0, 6.28); c.fill();
    }
    glowDot(c, MW / 2, MH - 40, 90, '120,160,255', 0.18);
    const fig = (x, h) => {   // plain, soft silhouettes (no details)
      c.fillStyle = 'rgba(10,16,48,0.85)';
      c.beginPath(); c.arc(x, MH - h - 14, 9, 0, 6.28); c.fill();
      c.beginPath(); c.moveTo(x - 13, MH); c.quadraticCurveTo(x - 14, MH - h + 4, x, MH - h); c.quadraticCurveTo(x + 14, MH - h + 4, x + 13, MH); c.fill();
    };
    fig(MW / 2 - 18, 52); fig(MW / 2 + 18, 48);
  },
  words(c, t) {    // "I like you." appears one word at a time
    skyGrad(c, [[0, '#120a2e'], [1, '#2c1a5e']]);
    starfield(c, t, 30);
    const parts = ['I', 'like', 'you.'];
    c.font = 'italic 700 34px Georgia, serif'; c.textBaseline = 'middle'; c.textAlign = 'left';
    const gap = 12, widths = parts.map((p) => c.measureText(p).width);
    let x = (MW - (widths.reduce((s, w) => s + w, 0) + gap * 2)) / 2;
    parts.forEach((p, i) => {
      const a = ease((t - 0.8 - i * 1.0) / 0.8);
      c.save(); c.globalAlpha = a; c.shadowColor = 'rgba(255,194,221,0.9)'; c.shadowBlur = 18; c.fillStyle = '#fff1f8';
      c.fillText(p, x, MH / 2 - 8 - (1 - a) * 6); c.restore();
      x += widths[i] + gap;
    });
    sparkles(c, t, 14, '255,194,221');
  },
  garden(c, t) {   // golden hour under the trees, gently turning into the winter palette
    const k = ease((t - 3) / 4);
    const g = c.createLinearGradient(0, 0, 0, MH);
    g.addColorStop(0, mix('#ff9a5a', '#2a1c63', k)); g.addColorStop(0.6, mix('#ffd08a', '#5a49aa', k)); g.addColorStop(1, mix('#fff0c4', '#bfe6ff', k));
    c.fillStyle = g; c.fillRect(0, 0, MW, MH);
    glowDot(c, 390, 36, 130, mixRgb('#ffe6a0', '#c9b8ff', k), 0.55);
    c.fillStyle = 'rgba(255,240,200,' + 0.13 * (1 - k * 0.6) + ')';
    for (let i = 0; i < 4; i++) { const x = 300 + i * 55 + Math.sin(t * 0.3 + i) * 6; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 40, 0); c.lineTo(x - 130, MH); c.lineTo(x - 190, MH); c.closePath(); c.fill(); }
    c.fillStyle = 'rgba(' + mixRgb('#4a2a30', '#1d1040', k) + ',0.55)';
    for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(i * 62 - 10, -6 + hash(i + 2) * 26, 40 + hash(i + 9) * 22, 0, 6.28); c.fill(); }
    c.fillRect(54, 40, 12, MH); c.fillRect(404, 40, 12, MH);
    for (let i = 0; i < 26; i++) {   // warm leaves that fade into soft snow
      const sp = 22 + hash(i) * 30, x = hash(i + 1) * MW + Math.sin(t * 0.9 + i) * 18, y = ((hash(i + 7) * MH + t * sp) % (MH + 20)) - 10;
      c.save(); c.translate(x, y); c.rotate(t * 1.5 + i);
      c.fillStyle = 'rgba(' + mixRgb(hash(i + 3) > 0.5 ? '#e8923a' : '#f2c14e', '#eaf6ff', k) + ',0.9)';
      c.beginPath(); c.ellipse(0, 0, 6.5, 3.2, 0, 0, 6.28); c.fill(); c.restore();
    }
    sparkles(c, t, 12, '255,240,200');
  }
};
const MEM_STATIC = { fest: 8, text: 8, rain: 5.5, words: 8, garden: 4.2 };   // the still frame used with reduced motion

const memCanvas = $('memCanvas'), mctx = memCanvas.getContext('2d');

function loadFound() {
  try {
    const a = JSON.parse(localStorage.getItem(MEMORY_KEY));
    return Array.isArray(a) ? a.filter((id) => MEMORIES.some((m) => m.id === id)) : [];
  } catch (e) { return []; }
}
function saveFound() { try { localStorage.setItem(MEMORY_KEY, JSON.stringify(found)); } catch (e) { /* ignore */ } }
const nextMemory = () => MEMORIES.find((m) => found.indexOf(m.id) < 0);

function updateBookButtons() {   // the "Memory book" buttons only appear once she has found something
  ['startBookBtn', 'overBookBtn', 'winBookBtn', 'pauseBookBtn'].forEach((id) => {
    const b = $(id);
    b.hidden = found.length === 0;
    b.textContent = '✦ ' + UNIVERSE_TITLE + ' (' + found.length + '/' + MEMORIES.length + ')';
  });
}

function discoverMemory() {   // called from collect() when the basket catches a Memory Snowflake
  // The memory is only picked here. It is saved as "found" in openMemory(), at the moment its page
  // really opens, so a memory can never be marked as discovered without having been shown.
  pendingMemory = nextMemory() || null;
}
function markFound(m) {       // saves a memory as discovered (once)
  if (found.indexOf(m.id) >= 0) return;
  found.push(m.id);
  saveFound();
  updateBookButtons();
}
function cancelMemory() {     // restart/new game while a memory burst or page is in progress
  pendingMemory = null; winAfterMemory = false;
  memScene.pending = 0; memScene.open = false; memScene.returnTo = null; memScene.current = null;
}
function beginMemory() {      // game freezes, the sparkle burst plays, then the page opens
  memScene.current = pendingMemory; memScene.returnTo = null;
  pendingMemory = null;
  state = 'memory';
  memScene.pending = reducedMotion ? 0.2 : 0.55;
}
const photoState = {};   // memory id -> 'ok' | 'missing' (so a missing photo is only looked for once)
function setPhoto(on) {   // true: show the real photo, false: show the animated illustration
  memScene.photo = on;
  $('memPhoto').hidden = !on;
  memCanvas.hidden = on;
  $('memMedia').classList.toggle('has-photo', on);
}
function showPhoto(m) {   // starts with the illustration; swaps in the photo only if the file really loads
  setPhoto(false);
  if (!m.photo || photoState[m.id] === 'missing') return;
  const use = () => { if (memScene.current !== m || !memScene.open) return; $('memPhoto').alt = 'A photo from ' + m.date; $('memPhoto').src = m.photo; setPhoto(true); };
  if (photoState[m.id] === 'ok') { use(); return; }
  const probe = new Image();
  probe.onload = () => { photoState[m.id] = 'ok'; use(); };
  probe.onerror = () => { photoState[m.id] = 'missing'; };
  probe.src = m.photo;
}
function openMemory(m, returnTo) {
  memScene.current = m; memScene.returnTo = returnTo; memScene.open = true; memScene.start = null;
  if (!returnTo) markFound(m);   // shown for the first time during play: now it counts as discovered
  memScene.name = m.scene in MEM_SCENES ? m.scene : 'fest';
  $('memDate').textContent = m.date;
  $('memTitle').textContent = m.title;
  setLetter(m.story, $('memStory'));
  $('memCount').textContent = found.length + ' of ' + MEMORIES.length + ' memories found';
  $('memContinue').textContent = returnTo ? 'Back to the map' : 'Continue';
  showPhoto(m);   // the illustration stays unless a real photo file is present
  showOverlay('memoryOverlay');
  say('Memory: ' + m.title);
}
function closeMemory() {
  if (!memScene.open) return;
  memScene.open = false;
  if (memScene.returnTo) showOverlay(memScene.returnTo);               // opened from the Memory book
  else if (state === 'memory') {
    hideOverlays();
    if (winAfterMemory) { winAfterMemory = false; winGame(); }          // the memory came with the winning catch: now the finale
    else state = 'playing';                                              // back to the game
  }
}
function drawMemScene(now) {
  if (memScene.start === null) memScene.start = now;
  const t = reducedMotion ? MEM_STATIC[memScene.name] : now - memScene.start;
  mctx.clearRect(0, 0, MW, MH);
  MEM_SCENES[memScene.name](mctx, t);
  const v = mctx.createLinearGradient(0, MH - 60, 0, MH);   // fade the picture into the card
  v.addColorStop(0, 'rgba(36,20,76,0)'); v.addColorStop(1, 'rgba(36,20,76,0.95)');
  mctx.fillStyle = v; mctx.fillRect(0, MH - 60, MW, 60);
}

const MAP_POS = [[22, 8], [78, 28], [22, 48], [78, 68], [22, 88]];   // where each place sits on the map (% across, % down)
const mapSeen = new Set(found);   // places already shown lit, so only newly found ones play the "lighting up" animation
function renderBook() {   // draws the story map: locked places stay mysterious, found places glow and can be opened
  const ul = $('bookList');
  ul.textContent = '';
  MEMORIES.forEach((m, i) => {
    const open = found.indexOf(m.id) >= 0, fresh = open && !mapSeen.has(m.id), pos = MAP_POS[i % MAP_POS.length];
    const li = document.createElement('li'), b = document.createElement('button');
    const dot = document.createElement('span'), txt = document.createElement('span');
    const t = document.createElement('span'), d = document.createElement('span');
    li.style.setProperty('--x', pos[0] + '%'); li.style.setProperty('--y', pos[1] + '%');
    b.type = 'button'; b.disabled = !open;
    b.className = 'map-node ' + (pos[0] < 50 ? 'right' : 'left') + (open ? ' lit' : ' locked') + (fresh ? ' fresh' : '');
    b.setAttribute('aria-label', open ? 'Open memory: ' + (m.mapName || m.title) + ', ' + m.date : 'Undiscovered memory');
    dot.className = 'node-dot'; txt.className = 'node-text'; t.className = 'bi-title'; d.className = 'bi-date';
    t.textContent = open ? (m.mapName || m.title) : 'Undiscovered';              // locked places reveal nothing
    d.textContent = open ? (m.place ? m.place + ' · ' : '') + m.date : '';
    txt.appendChild(t); txt.appendChild(d); b.appendChild(dot); b.appendChild(txt); li.appendChild(b); ul.appendChild(li);
    if (open) { b.addEventListener('click', () => openMemory(m, 'bookOverlay')); mapSeen.add(m.id); }
    const halo = $('glow' + (i + 1)), seg = i ? $('seg' + i) : null;               // the picture behind the nodes
    if (halo) { halo.classList.toggle('lit', open); halo.classList.toggle('fresh', fresh); }
    if (seg) seg.classList.toggle('lit', open);
  });
  $('bookHint').textContent = found.length + ' of ' + MEMORIES.length + ' memories discovered';
  $('bookBar').style.width = (found.length / MEMORIES.length) * 100 + '%';
}
function showBook(returnTo) { bookReturn = returnTo; renderBook(); showOverlay('bookOverlay'); }

function drawMemoryItem(f) {   // rose-gold snowflake with a soft aura and orbiting sparkles
  const r = f.r, pulse = reducedMotion ? 1 : 1 + 0.1 * Math.sin(f.t * 2.5);
  ctx.save(); ctx.translate(f.x, f.y);
  const g = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2.4 * pulse);
  g.addColorStop(0, 'rgba(255,194,221,0.55)'); g.addColorStop(1, 'rgba(255,194,221,0)');
  ctx.fillStyle = g; ctx.fillRect(-r * 2.6, -r * 2.6, r * 5.2, r * 5.2);
  if (!reducedMotion) ctx.rotate(f.t * 0.4);
  ctx.strokeStyle = '#ffe3f0'; ctx.shadowColor = '#ff9fc8'; ctx.shadowBlur = 18; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, r);
    ctx.moveTo(0, r * 0.55); ctx.lineTo(-r * 0.32, r * 0.85);
    ctx.moveTo(0, r * 0.55); ctx.lineTo(r * 0.32, r * 0.85);
    ctx.stroke();
  }
  ctx.shadowBlur = 0; ctx.fillStyle = '#ffd978';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, 6.28); ctx.fill();
  ctx.restore();
  if (!reducedMotion) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      const a = f.t * 1.6 + i * 2.094;
      ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * r * 1.5, f.y + Math.sin(a) * r * 1.5, 2, 0, 6.28); ctx.fill();
    }
  }
}

// ---------- Overlays ----------
function showOverlay(id) {
  overlays.forEach((o) => { o.hidden = o.id !== id; });
  if (id) {
    const btn = $(id).querySelector('.btn');
    if (btn) btn.focus({ preventScroll: true });
  }
}
function hideOverlays() { overlays.forEach((o) => { o.hidden = true; }); }

// ---------- Game flow ----------
function startGame() {
  if (state === 'playing' || state === 'paused' || state === 'memory') saveBest();   // restarting never loses a good score
  initAudio();
  cancelMemory();
  score = 0;
  timeLeft = mode === 'relaxed' ? Infinity : GAME_SECONDS;   // Infinity: nothing to count down
  playT = 0;
  spawnTimer = 0.4;
  flakes = []; particles = []; floaters = []; rings = []; fireworkT = 0;
  resetGameplay();
  basket.x = W / 2; targetX = W / 2;
  $('confetti').textContent = '';
  win.parts = []; win.revealed = false; win.t = 0; win.fw = 0;
  hideOverlays();
  state = 'playing';
  setControls(true);
  updateHud();
  sfx.start();
  canvas.focus({ preventScroll: true });
}

function setControls(playing) {
  pauseBtn.disabled = !playing;
  restartBtn.disabled = !playing;
  pauseBtn.textContent = '⏸';
  pauseBtn.setAttribute('aria-label', 'Pause game');
}

function togglePause() {
  if (!bookOverlay.hidden || (memScene.open && memScene.returnTo)) return;   // not while the map or a memory page is open
  if (state === 'playing') {
    state = 'paused';
    pauseBtn.textContent = '▶';
    pauseBtn.setAttribute('aria-label', 'Resume game');
    showOverlay('pauseOverlay');
  } else if (state === 'paused') {
    state = 'playing';
    pauseBtn.textContent = '⏸';
    pauseBtn.setAttribute('aria-label', 'Pause game');
    hideOverlays();
  }
}

function saveBest() {
  if (mode === 'standard' && score > best) {   // Relaxed scores are not compared with timed ones
    best = score;
    bestEl.textContent = best;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* ignore */ }
  }
}

function endGame() {
  state = 'over';
  setControls(false);
  clearEffects();
  saveBest();
  sfx.over();
  $('overScore').textContent = score;
  const left = TARGET_SCORE - score;
  $('overNote').textContent = left > 0
    ? `points. Just ${left} short of ${TARGET_SCORE}, try again!`
    : 'points.';
  if (maxCombo >= COMBO_MIN_SHOW) $('overNote').textContent += ` Best combo: x${maxCombo}.`;
  showOverlay('overOverlay');
}

function winGame() {
  state = 'won';
  setControls(false);
  clearEffects();
  saveBest();
  sfx.win();
  $('winScore').textContent = score;
  const spare = Math.ceil(timeLeft);
  $('winNote').textContent = mode === 'relaxed' ? 'Adventure complete.' : spare + (spare === 1 ? ' second' : ' seconds') + ' to spare.';
  beginFinale();   // heart forms, then the letter is revealed (see FINALE below)
}

function makeConfetti() {
  const box = $('confetti');
  const colors = ['#c9b8ff', '#bfe6ff', '#ffc2dd', '#ffd978', '#ffffff'];
  const k = W < 600 ? 0.55 : 1;   // fewer pieces on phones
  for (let i = 0; i < 70 * k; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.cssText = `left:${rand(0, 100)}%;background:${colors[i % colors.length]};` +
      `width:${rand(6, 11)}px;height:${rand(8, 18)}px;${i % 3 === 0 ? 'border-radius:50%;' : ''}` +
      `--dur:${rand(3.5, 7)}s;--delay:${rand(-7, 0)}s;--sway:${rand(-80, 80)}px`;
    box.appendChild(c);
  }
  for (let i = 0; i < 22 * k; i++) {
    const f = document.createElement('div');
    f.className = 'flake-fall';
    f.textContent = '❄';
    f.style.cssText = `left:${rand(0, 100)}%;font-size:${rand(16, 40)}px;` +
      `--dur:${rand(6, 11)}s;--delay:${rand(-10, 0)}s;--sway:${rand(-60, 60)}px`;
    box.appendChild(f);
  }
  for (let i = 0; i < 12; i++) {   // hearts drift upward
    const h = document.createElement('div');
    h.className = 'heart-rise';
    h.textContent = '❤';
    h.style.cssText = `left:${rand(5, 95)}%;font-size:${rand(14, 30)}px;` +
      `--dur:${rand(6, 10)}s;--delay:${rand(-8, 0)}s;--sway:${rand(-50, 50)}px`;
    box.appendChild(h);
  }
}

/* ==========================================================
   🎂  FINALE: the snowfall calms, glowing snowflakes gather into a
   heart, then the letter appears. It takes about 2 seconds, and a tap,
   click or Space/Enter jumps straight to the letter.
   ========================================================== */
const REVEAL_AT = 2.0;   // seconds until the letter appears

function setLetter(text, target) {   // shows text word by word (the letter, and each memory page)
  const el = target || $('winMessage');
  el.textContent = '';
  let idx = 0;
  text.split('\n').forEach((line, li) => {
    if (li) el.appendChild(document.createElement('br'));
    line.split(/\s+/).filter(Boolean).forEach((word) => {
      const s = document.createElement('span');
      s.className = 'w';
      s.textContent = word;
      s.style.setProperty('--d', Math.min(idx * 60, 1800));   // staggered fade-in, never longer than ~2 s
      el.appendChild(s);
      el.appendChild(document.createTextNode(' '));
      idx++;
    });
  });
}

function heartShape(i, n) {   // point i of n along a heart outline, scaled to roughly -1..1
  const t = (i / n) * Math.PI * 2;
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  return { u: x / 17, v: (y - 2.5) / 17 };
}
function heartPose() {   // where the heart sits: middle of the screen first, then above the letter
  const big = clamp(Math.min(W, H) * 0.24, 56, 150);
  if (!win.revealed) return { x: W / 2, y: H * 0.42, s: big };
  return { x: W / 2, y: win.cardTop / 2 + 4, s: clamp((win.cardTop - 28) / 1.9, 24, big) };
}
function measureCard() { win.cardTop = $('winOverlay').querySelector('.card').offsetTop; }

function beginFinale() {
  win.t = 0; win.revealed = false; win.fw = 0;
  const n = W < 600 ? 30 : 40;
  win.parts = [];
  for (let i = 0; i < n; i++) {
    const f = flakes[i], h = heartShape(i, n);   // snowflakes already falling are gathered first
    win.parts.push({
      x: f ? f.x : rand(0, W), y: f ? f.y : rand(-20, H * 0.6), vy: f ? f.vy * 0.5 : rand(20, 60),
      u: h.u, v: h.v, delay: rand(0, 0.7), rot: rand(0, 6.28), spin: rand(-1.2, 1.2),
      a: f ? 1 : 0, gold: f ? f.gold : Math.random() < 0.25
    });
  }
  flakes.length = 0;
  if (reducedMotion) {                              // no travelling: show the heart and the letter at once
    win.t = REVEAL_AT;
    revealWin();
    const pose = heartPose();
    win.parts.forEach((p) => { p.x = pose.x + p.u * pose.s; p.y = pose.y + p.v * pose.s; p.a = 1; });
  }
}

function revealWin() {
  if (win.revealed) return;
  win.revealed = true;
  makeConfetti();
  showOverlay('winOverlay');
  measureCard();
  sfx.reveal();
  say(WIN_TITLE + ' ' + ACHIEVEMENT_TITLE);
  fireworkT = 0.5;
}

function updateWin(dt) {
  win.t += dt;
  const pose = heartPose(), k = 1 - Math.exp(-dt * 3.2);
  for (const p of win.parts) {
    p.a = Math.min(1, p.a + dt * 2);
    if (win.t < p.delay) { p.vy *= Math.exp(-2.5 * dt); p.y += p.vy * dt; continue; }   // drift, slowing down
    p.x += (pose.x + p.u * pose.s - p.x) * k;                                            // then glide into the heart
    p.y += (pose.y + p.v * pose.s - p.y) * k;
    p.rot += p.spin * dt;
  }
  if (!win.revealed && win.t >= REVEAL_AT) revealWin();
  if (win.revealed && !reducedMotion && win.fw < 6) {   // a few gentle fireworks, then calm
    fireworkT -= dt;
    if (fireworkT <= 0) {
      fireworkT = rand(0.9, 1.6); win.fw++;
      firework(rand(W * 0.1, W * 0.9), rand(H * 0.06, Math.max(H * 0.14, win.cardTop * 0.85)));
    }
  }
}

function drawWin() {
  const pose = heartPose(), r = clamp(pose.s * 0.08, 4, 11);
  const pulse = reducedMotion || !win.revealed ? 1 : 1 + 0.03 * Math.sin(win.t * 3);
  const glow = Math.min(1, Math.max(0, (win.t - 0.6) / 1.2));
  const g = ctx.createRadialGradient(pose.x, pose.y, 0, pose.x, pose.y, pose.s * 1.5);
  g.addColorStop(0, 'rgba(255,194,221,' + 0.35 * glow + ')');
  g.addColorStop(1, 'rgba(255,194,221,0)');
  ctx.fillStyle = g;
  ctx.fillRect(pose.x - pose.s * 1.5, pose.y - pose.s * 1.5, pose.s * 3, pose.s * 3);
  for (const p of win.parts) { ctx.globalAlpha = p.a; drawFlake(p.x, p.y, r * pulse, p.rot, p.gold); }
  ctx.globalAlpha = 1;
}

/* ==========================================================
   ⏱  GAME MODES
   Standard: a GAME_SECONDS countdown. Relaxed: no countdown, same scoring,
   and the adventure finishes when the target score is reached.
   The clock only ever moves inside update() while state === 'playing', so
   memory pages, the map, pause, restart and hidden tabs can never use up
   her time. Difficulty follows time played, stretched across GAME_SECONDS.
   ========================================================== */
function difficulty() {   // 0 = gentle start, 1 = hardest; Relaxed stops at RELAXED_CAP so it stays calm
  const d = clamp(playT / GAME_SECONDS, 0, 1);
  return mode === 'relaxed' ? d * RELAXED_CAP : d;
}
const memCap = () => (mode === 'relaxed' ? MEMORIES.length : 3);   // memory snowflakes per run
function setMode(m) {      // called from the welcome screen
  mode = m;
  $('modeStd').setAttribute('aria-pressed', String(m === 'standard'));
  $('modeRelax').setAttribute('aria-pressed', String(m === 'relaxed'));
  $('modeNote').textContent = m === 'relaxed'
    ? 'No timer. Take your time: the adventure finishes when you reach ' + TARGET_SCORE + ' points.'
    : 'Reach ' + TARGET_SCORE + ' points in ' + GAME_SECONDS + ' seconds.';
  if (state !== 'playing' && state !== 'paused' && state !== 'memory') {   // only the idle HUD changes, never a game in progress
    timeLeft = m === 'relaxed' ? Infinity : GAME_SECONDS;
    updateHud();
  }
}

// ---------- Spawning, difficulty ----------
function spawnFlake() {
  const kind = pickKind(), gold = kind === 'gold';
  const elapsed = difficulty() * RAMP_SECONDS;
  const scale = clamp(H / 700, 0.7, 1.4);
  const r = kind === 'memory' ? 22 : kind === 'heart' ? rand(16, 19) : kind === 'slow' ? 20 : kind === 'multi' ? 21 : gold ? rand(17, 21) : rand(11, 18);
  flakes.push({
    x: rand(r + 10, W - r - 10), y: -r,
    r, gold, kind,
    vy: (rand(110, 160) + elapsed * 5.5 + (gold ? 40 : 0)) * scale * (kind === 'memory' ? 0.7 : 1),   // faster over time (memories fall gently)
    rot: rand(0, 6.28), spin: kind === 'normal' || gold ? rand(-1.5, 1.5) : 0,
    sway: rand(1, 2.5), drift: rand(8, 28), t: rand(0, 6.28)
  });
}
function spawnInterval() {
  const elapsed = difficulty() * RAMP_SECONDS;
  return Math.max(0.28, 0.85 - elapsed * 0.013);                       // more often over time
}

// ---------- Effects ----------
function drawSpark(x, y, s) {   // 4-point sparkle
  ctx.beginPath();
  ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill();
}
const BURST = {   // particle recipe for each kind of catch
  normal: { colors: ['#bfe6ff', '#c9b8ff', '#ffc2dd', '#ffffff'], n: 14, speed: 180, rr: 46 },
  gold:   { colors: ['#ffd978', '#fff3c4', '#ffffff'], n: 30, speed: 280, rr: 80, ring: '#ffd978' },
  heart:  { colors: ['#ff8fbd', '#ffc2dd', '#ffffff'], n: 18, speed: 200, rr: 60, ring: '#ff8fbd', hearts: true },
  slow:   { colors: ['#8fdcff', '#bfe6ff', '#ffffff'], n: 26, speed: 240, rr: 110, ring: '#8fdcff' },
  multi:  { colors: ['#ffd978', '#c58bff', '#ffffff'], n: 30, speed: 280, rr: 110, ring: '#c58bff' },
  memory: { colors: ['#ffc2dd', '#ffd978', '#ffffff'], n: 34, speed: 260, rr: 120, ring: '#ffc2dd' }
};
function burst(x, y, kind) {
  const b = BURST[kind] || BURST.normal;
  for (let i = 0; i < b.n; i++) {
    const a = rand(0, 6.28), s = rand(40, b.speed), star = !b.hearts && i % 3 === 0;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0, max: rand(0.4, 0.95),
      size: star ? rand(3, 6) : b.hearts && i % 2 === 0 ? rand(3, 5) : rand(1.5, 3.5), star,
      heart: !!b.hearts && i % 2 === 0, color: b.colors[(Math.random() * b.colors.length) | 0] });
  }
  rings.push({ x, y, life: 0, max: kind === 'normal' ? 0.5 : 0.75, r: b.rr, color: b.ring });   // expanding shock ring
  if (kind === 'slow' || kind === 'multi' || kind === 'memory') rings.push({ x, y, life: 0, max: 1, r: b.rr * 1.6, color: kind === 'multi' ? '#ffd978' : '#dff3ff' });
}
function firework(x, y) {   // used by the birthday victory screen
  if (particles.length > 350) return;
  const pal = ['#ffd978', '#ffc2dd', '#bfe6ff', '#c9b8ff', '#ffffff'];
  const c1 = pal[(Math.random() * pal.length) | 0];
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * 6.28, s = rand(90, 210);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rand(0.9, 1.5),
      size: rand(2, 4), star: i % 5 === 0, color: i % 4 ? c1 : '#ffffff' });
  }
  rings.push({ x, y, life: 0, max: 0.8, r: 70, gold: Math.random() < 0.5 });
  tone(rand(500, 900), 0.2, 'sine', 0.05, 0, 1400);
}
function animateScore(dt) {   // score number glides up instead of jumping
  if (shownScore === score) return;
  shownScore = reducedMotion ? score : shownScore + (score - shownScore) * Math.min(1, dt * 9);
  if (Math.abs(score - shownScore) < 0.5) shownScore = score;
  scoreEl.textContent = Math.round(shownScore);
}
function kick(cls) {
  if (reducedMotion) return;
  stage.classList.remove(cls);
  void stage.offsetWidth;          // restarts the CSS animation
  stage.classList.add(cls);
}
function popScore() {
  if (reducedMotion) return;
  scoreEl.classList.remove('pop');
  void scoreEl.offsetWidth;
  scoreEl.classList.add('pop');
}

/* ==========================================================
   🎁  GAMEPLAY: collectibles, combos and power-ups
   Rules in one place:
   - Normal 10, golden 50, heart HEART_POINTS.
   - Slow-mo: falling objects move at SLOW_FACTOR speed for SLOW_SECONDS.
   - Double points: every point you earn is doubled for MULTI_SECONDS.
   - Combo: each catch adds 1. Every COMBO_STEP-th catch pays a bonus.
     Missing COMBO_LIVES snowflakes/hearts in a row ends the combo
     (any catch refills the lives). Missing a power-up costs nothing.
   - All timers count down inside the one game loop, so pause, restart
     and a hidden tab can never leave a power-up running by accident.
   ========================================================== */
const POINTS = { normal: NORMAL_POINTS, gold: GOLD_POINTS, heart: HEART_POINTS, slow: 0, multi: 0, memory: MEMORY_POINTS };
const FLOAT_COLOR = { heart: '#ff9fc8', slow: '#9fe3ff', multi: '#ffd978', memory: '#ffc2dd' };

function pickKind() {   // decides what the next falling object is
  const elapsed = playT;   // real seconds played
  // Memory Snowflake: rare, at most 2 per round, never two at once, and only while memories remain
  if (nextMemory() && timeLeft > 6 && cool.memory <= 0 && memRound < memCap() && !flakes.some((f) => f.kind === 'memory') &&
      (memGap > (MEM_TEST ? 3 : 22) || (elapsed > (MEM_TEST ? 2 : 8) && Math.random() < (MEM_TEST ? 0.3 : 0.025)))) {
    cool.memory = MEM_TEST ? 4 : 15; memRound++; memGap = 0;
    if (memRound === 1) { showBanner('A memory snowflake ✦', 'heart'); say('A memory snowflake is falling'); }
    return 'memory';
  }
  const useful = timeLeft > 8;                               // a power-up in the last 8 s would be wasted
  const canMulti = useful && elapsed > 6 && multiT <= 0 && cool.multi <= 0;
  const canSlow = useful && elapsed > 10 && slowT <= 0 && cool.slow <= 0;
  const pity = powerGap > 14;                                // make sure one shows up now and then
  if (canMulti && (Math.random() < 0.03 || (pity && (!canSlow || Math.random() < 0.5)))) { cool.multi = 12; powerGap = 0; return 'multi'; }
  if (canSlow && (Math.random() < 0.025 || pity)) { cool.slow = 14; powerGap = 0; return 'slow'; }
  if (cool.heart <= 0 && Math.random() < 0.06) { cool.heart = 6; return 'heart'; }
  return Math.random() < GOLD_CHANCE ? 'gold' : 'normal';
}

const say = (text) => { srEl.textContent = text; };          // screen-reader announcement
const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
const setHidden = (el, h) => { if (el.hidden !== h) el.hidden = h; };

function showBanner(text, cls) {
  bannerEl.className = 'banner';
  void bannerEl.offsetWidth;                                 // restart the pop animation
  bannerEl.textContent = text;
  bannerEl.className = 'banner show ' + (cls || '');
  bannerT = 1.4;
}

function addCombo(mult) {   // returns the bonus points (before the multiplier)
  combo++; misses = 0;
  if (combo > maxCombo) maxCombo = combo;
  const bonus = combo % COMBO_STEP === 0 ? Math.min(COMBO_BONUS_CAP, combo) : 0;
  if (combo >= COMBO_MIN_SHOW) {
    comboText.textContent = `COMBO x${combo}!` + (bonus ? `  +${bonus * mult}` : '');
    comboText.className = 'combo-text';
    void comboText.offsetWidth;
    comboText.className = 'combo-text show' + (bonus ? ' big' : '');
    comboShowT = 1.1;
    sfx.combo(combo);
  }
  if (bonus) say(`Combo ${combo}, bonus ${bonus * mult} points`);
  return bonus;
}

function registerMiss(f) {   // called when a flake falls past the basket
  if (f.kind === 'memory') { memRound = Math.max(0, memRound - 1); cool.memory = 3; memGap = Math.max(memGap, 18); return; }   // a missed memory comes back soon, and costs no combo
  if (combo === 0 || !(f.kind === 'normal' || f.kind === 'gold' || f.kind === 'heart')) return;
  misses++;
  if (misses >= COMBO_LIVES) {
    if (combo >= COMBO_MIN_SHOW) { showBanner('Combo lost', 'soft'); sfx.lost(); say('Combo lost'); }
    combo = 0; misses = 0;
  }
  renderEffects();
}

function startSlow() {
  const fresh = slowT <= 0;
  slowT = SLOW_SECONDS;                                      // refreshing, never stacking
  stage.classList.add('slow-fx');
  showBanner(fresh ? 'Slow-mo ❄' : 'Slow-mo refreshed', 'slow');
  say('Slow motion active');
}
function startMulti() {
  const fresh = multiT <= 0;
  multiT = MULTI_SECONDS;
  stage.classList.add('multi-fx');
  showBanner(fresh ? 'Double points ✦' : 'Double points refreshed', 'multi');
  say('Double points active');
}
function endEffect(which) {   // power-up ran out
  if (which === 'slow') { slowT = 0; stage.classList.remove('slow-fx'); showBanner('Slow-mo ended', 'soft'); say('Slow motion ended'); }
  else { multiT = 0; stage.classList.remove('multi-fx'); showBanner('Double points ended', 'soft'); say('Double points ended'); }
  rings.push({ x: basket.x, y: H - basket.h / 2 - 18, life: 0, max: 0.5, r: 60, color: which === 'slow' ? '#8fdcff' : '#ffd978' });
  sfx.expire();
}
function clearEffects() {     // used on start, restart, win and game over
  slowT = 0; multiT = 0; slowFactor = 1; bannerT = 0; comboShowT = 0;
  stage.classList.remove('slow-fx', 'multi-fx');
  bannerEl.classList.remove('show');
  comboText.classList.remove('show');
  renderEffects();
}
function resetGameplay() {
  combo = 0; misses = 0; maxCombo = 0; powerGap = 0;
  cool.heart = 3; cool.slow = 0; cool.multi = 0; cool.memory = 0;
  memRound = 0; memGap = 0; pendingMemory = null; memScene.pending = 0; memScene.open = false;
  clearEffects();
}

function tickEffects(dt) {    // runs every frame while playing
  cool.heart -= dt; cool.slow -= dt; cool.multi -= dt; cool.memory -= dt; powerGap += dt; memGap += dt;
  if (slowT > 0 && (slowT -= dt) <= 0) endEffect('slow');
  if (multiT > 0 && (multiT -= dt) <= 0) endEffect('multi');
  slowFactor += ((slowT > 0 ? SLOW_FACTOR : 1) - slowFactor) * Math.min(1, dt * 6);   // eases in and out
  renderEffects();
}
function renderEffects() {    // keeps the badges in sync (only touches the page when something changed)
  setHidden(slowBadge, slowT <= 0);
  if (slowT > 0) {
    setText(slowSecs, slowT.toFixed(1) + 's');
    slowBar.style.width = (slowT / SLOW_SECONDS) * 100 + '%';
    slowBadge.classList.toggle('ending', slowT < 1.5);
  }
  setHidden(multiBadge, multiT <= 0);
  if (multiT > 0) {
    setText(multiSecs, multiT.toFixed(1) + 's');
    multiBar.style.width = (multiT / MULTI_SECONDS) * 100 + '%';
    multiBadge.classList.toggle('ending', multiT < 1.5);
  }
  setHidden(comboBadge, combo < 2);
  if (combo >= 2) {
    setText(comboBadge, `Combo x${combo}  ${'●'.repeat(COMBO_LIVES - misses)}${'○'.repeat(misses)}`);
    comboBadge.classList.toggle('warn', misses > 0);
  }
}

function collect(f, y) {      // the basket caught something
  const kind = f.kind, mult = multiT > 0 ? MULTI_VALUE : 1;
  const bonus = addCombo(mult);
  const pts = (POINTS[kind] + bonus) * mult;
  score += pts;
  burst(f.x, y, kind);
  const label = kind === 'slow' ? 'SLOW-MO' : kind === 'multi' ? 'x2 POINTS' : '+' + pts + (kind === 'heart' ? ' ❤' : kind === 'memory' ? ' ✦' : '');
  floaters.push({ x: f.x, y: y - 10, text: label, gold: kind === 'gold', color: FLOAT_COLOR[kind] || (mult > 1 ? '#ffd978' : null), life: 0 });
  basket.squash = 1;
  sfx[kind === 'normal' ? 'catch' : kind]();
  if (kind === 'slow') startSlow();
  else if (kind === 'multi') startMulti();
  else if (kind === 'heart') { showBanner('Lucky heart! +' + pts + ' ❤', 'heart'); say('Heart bonus, ' + pts + ' points'); }
  else if (kind === 'memory') discoverMemory();
  kick(kind === 'gold' ? 'shake' : 'pulse');
  popScore();
  updateHud();
  renderEffects();   // badges update immediately, not a frame later
}

// ----- drawing the special items (each has its own shape, not just a colour) -----
function heartPath(x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.6, y - s * 0.1, x - s * 0.9, y - s * 1.2, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.9, y - s * 1.2, x + s * 1.6, y - s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}
function drawHeartItem(f) {
  const pulse = reducedMotion ? 1 : 1 + 0.08 * Math.sin(f.t * 3);
  ctx.save();
  ctx.shadowColor = '#ff6fa8'; ctx.shadowBlur = 22;
  const g = ctx.createRadialGradient(f.x - f.r * 0.3, f.y - f.r * 0.4, 1, f.x, f.y, f.r * 1.4);
  g.addColorStop(0, '#ffd1e6'); g.addColorStop(1, '#ff5f9f');
  ctx.fillStyle = g;
  heartPath(f.x, f.y, f.r * 0.95 * pulse); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath(); ctx.ellipse(f.x - f.r * 0.4, f.y - f.r * 0.4, f.r * 0.18, f.r * 0.1, -0.6, 0, 6.28); ctx.fill();
  ctx.restore();
}
function drawSlowItem(f) {    // icy ring with an hourglass
  const r = f.r;
  ctx.save(); ctx.translate(f.x, f.y);
  ctx.shadowColor = '#6fd0ff'; ctx.shadowBlur = 22;
  ctx.fillStyle = 'rgba(40,90,170,0.45)'; ctx.strokeStyle = '#9fe3ff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.28); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = '#eaf9ff';
  const h = r * 0.55, w = r * 0.45;
  ctx.beginPath(); ctx.moveTo(-w, -h); ctx.lineTo(w, -h); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-w, h); ctx.lineTo(w, h); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
  const a = reducedMotion ? 0 : f.t * 2;                      // little orbiting dot
  ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 3, 0, 6.28); ctx.fill();
  ctx.restore();
}
function drawMultiItem(f) {   // gold and violet starburst with "x2"
  const r = f.r;
  ctx.save(); ctx.translate(f.x, f.y);
  if (!reducedMotion) ctx.rotate(Math.sin(f.t * 1.5) * 0.15);
  ctx.shadowColor = '#c58bff'; ctx.shadowBlur = 24;
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.2);
  g.addColorStop(0, '#fff3c4'); g.addColorStop(0.6, '#ffd978'); g.addColorStop(1, '#c58bff');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const rad = i % 2 ? r * 0.62 : r * 1.1, a = (i / 16) * 6.28 - 1.57;
    if (i) ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); else ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#3a1f6e';
  ctx.font = `bold ${Math.round(r * 0.9)}px "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('x2', 0, 1);
  ctx.restore();
}
function drawItem(f) {
  if (f.kind === 'heart') drawHeartItem(f);
  else if (f.kind === 'slow') drawSlowItem(f);
  else if (f.kind === 'multi') drawMultiItem(f);
  else if (f.kind === 'memory') drawMemoryItem(f);
  else drawFlake(f.x, f.y, f.r, f.rot, f.gold);
}

// ---------- Update ----------
function update(dt) {
  ambientSlow += ((state === 'won' ? 0.12 : 1) - ambientSlow) * Math.min(1, dt * 1.2);   // snowfall calms in the finale
  // ambient snow always drifts
  for (const a of ambient) {
    a.y += a.vy * dt * (reducedMotion ? 0.3 : 1) * ambientSlow;
    a.x += Math.sin(a.ph += dt) * 8 * dt;
    if (a.y > H + 5) Object.assign(a, newAmbient(false), { x: rand(0, W) });
  }
  // particles and floating texts always animate
  particles = particles.filter((p) => (p.life += dt) < p.max);
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; }
  floaters = floaters.filter((f) => (f.life += dt) < 0.9);
  rings = rings.filter((r) => (r.life += dt) < r.max);
  basket.squash = Math.max(0, basket.squash - dt * 4);
  animateScore(dt);
  if (memScene.pending > 0 && (memScene.pending -= dt) <= 0) openMemory(memScene.current, null);   // open the page after the burst
  if (bannerT > 0 && (bannerT -= dt) <= 0) bannerEl.classList.remove('show');
  if (comboShowT > 0 && (comboShowT -= dt) <= 0) comboText.classList.remove('show');

  if (state === 'won') updateWin(dt);               // heart formation, letter reveal, fireworks

  if (state !== 'playing') return;

  // basket movement
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (dir) targetX += dir * W * 1.1 * dt;
  targetX = clamp(targetX, basket.w / 2, W - basket.w / 2);
  basket.x += (targetX - basket.x) * Math.min(1, dt * 20);

  tickEffects(dt);   // power-up timers, cooldowns, badges

  // timer (counted from frame time, so pausing is automatically correct)
  playT += dt;
  const before = Math.ceil(timeLeft);
  timeLeft -= dt;
  if (timeLeft <= 5 && Math.ceil(timeLeft) < before && timeLeft > 0) sfx.tick();
  if (timeLeft <= 0) { timeLeft = 0; updateHud(); endGame(); return; }

  spawnTimer -= dt;
  if (spawnTimer <= 0) { spawnFlake(); spawnTimer = spawnInterval() * rand(0.8, 1.2); }

  const basketTop = H - basket.h - 18;
  for (let i = flakes.length - 1; i >= 0; i--) {
    const f = flakes[i];
    const sdt = dt * slowFactor;     // slow-mo scales how fast things fall
    f.t += sdt * f.sway;
    f.y += f.vy * sdt;
    f.x += Math.sin(f.t) * f.drift * sdt;
    f.rot += f.spin * sdt;

    // collision: flake reaches the basket opening and lines up horizontally
    const inRow = f.y + f.r >= basketTop && f.y <= basketTop + basket.h * 0.55;
    const inCol = Math.abs(f.x - basket.x) <= basket.w / 2 + f.r * 0.3;
    if (inRow && inCol) {
      flakes.splice(i, 1);
      collect(f, basketTop);         // points, combo, power-ups, effects
      if (pendingMemory) { winAfterMemory = score >= TARGET_SCORE; beginMemory(); return; }   // a Memory Snowflake: freeze and show its page (the finale follows if this was the winning catch)
      if (score >= TARGET_SCORE) { winGame(); return; }
    } else if (f.y - f.r > H) {
      flakes.splice(i, 1);          // missed: just remove it (cleanup)
      registerMiss(f);              // may use up a combo life
    }
  }
  updateHud();
}

function updateHud() {
  if (score === 0) { shownScore = 0; scoreEl.textContent = 0; }   // animateScore() handles the rest
  const relaxed = mode === 'relaxed';
  setText(timeLabel, relaxed ? 'Mode' : 'Time');
  setText(timeEl, relaxed ? 'Relaxed' : String(Math.ceil(timeLeft)));   // no misleading countdown in Relaxed Mode
  timeEl.classList.toggle('small', relaxed);
  timeEl.classList.toggle('low', !relaxed && Math.ceil(timeLeft) <= 10);
  const frac = Math.min(1, score / TARGET_SCORE);
  meterFill.style.width = frac * 100 + '%';
  meterFill.style.setProperty('--p', Math.max(0.02, frac));
  meterEl.setAttribute('aria-valuenow', score);
}

// ---------- Drawing ----------
function drawFlake(x, y, r, rot, gold) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = gold ? '#ffd978' : '#e9f6ff';
  ctx.shadowColor = gold ? '#ffcf4d' : '#9fd8ff';
  ctx.shadowBlur = gold ? 22 : 10;
  ctx.lineWidth = Math.max(1.6, r / 7);
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, r);
    ctx.moveTo(0, r * 0.55); ctx.lineTo(-r * 0.3, r * 0.8);
    ctx.moveTo(0, r * 0.55); ctx.lineTo(r * 0.3, r * 0.8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBasket() {
  const { x, w, h } = basket;
  const sq = basket.squash;
  const y = H - h - 18;
  ctx.save();
  ctx.translate(x, y + h);
  ctx.scale(1 + sq * 0.08, 1 - sq * 0.08);   // little squish when catching
  ctx.translate(0, -h);
  ctx.shadowColor = multiT > 0 ? 'rgba(255, 217, 120, 0.95)' : slowT > 0 ? 'rgba(143, 220, 255, 0.95)' : 'rgba(201, 184, 255, 0.8)';
  ctx.shadowBlur = 24 + sq * 30;   // glows brighter when it catches something

  // body
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ffc2dd');
  g.addColorStop(1, '#8e6bd8');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(w / 2, 0);
  ctx.quadraticCurveTo(w * 0.42, h, w * 0.3, h);
  ctx.lineTo(-w * 0.3, h);
  ctx.quadraticCurveTo(-w * 0.42, h, -w / 2, 0);
  ctx.fill();
  ctx.shadowBlur = 0;

  // weave lines
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(i * w * 0.18, 4); ctx.lineTo(i * w * 0.13, h - 3); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(-w * 0.45, h * 0.45); ctx.lineTo(w * 0.45, h * 0.45); ctx.stroke();

  // rim
  ctx.fillStyle = '#fff1f8';
  ctx.beginPath(); ctx.ellipse(0, 0, w / 2 + 3, 7, 0, 0, 6.28); ctx.fill();
  ctx.fillStyle = '#4a2a8a';
  ctx.beginPath(); ctx.ellipse(0, 1, w / 2 - 4, 4, 0, 0, 6.28); ctx.fill();

  // cute face
  ctx.fillStyle = '#3a1f6e';
  ctx.beginPath(); ctx.arc(-w * 0.12, h * 0.62, 3.5, 0, 6.28); ctx.arc(w * 0.12, h * 0.62, 3.5, 0, 6.28); ctx.fill();
  ctx.strokeStyle = '#3a1f6e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, h * 0.64, 5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,170,0.55)';
  ctx.beginPath(); ctx.arc(-w * 0.22, h * 0.7, 4, 0, 6.28); ctx.arc(w * 0.22, h * 0.7, 4, 0, 6.28); ctx.fill();

  // magic sparkle
  ctx.fillStyle = '#ffd978';
  ctx.font = `${Math.round(w * 0.16)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('✦', w * 0.34, -4);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (const a of ambient) { ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.28); ctx.fill(); }

  for (const f of flakes) drawItem(f);
  drawBasket();
  if (state === 'won') drawWin();

  for (const r of rings) {
    const k = r.life / r.max;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = r.color || (r.gold ? '#ffd978' : '#dff3ff');
    ctx.lineWidth = 4 * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (1 - (1 - k) * (1 - k)), 0, 6.28); ctx.stroke();
  }
  for (const p of particles) {
    ctx.globalAlpha = 1 - p.life / p.max;
    ctx.fillStyle = p.color;
    if (p.heart) { heartPath(p.x, p.y, p.size * 1.6); ctx.fill(); }
    else if (p.star) drawSpark(p.x, p.y, p.size * 1.8);
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.28); ctx.fill(); }
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
  for (const f of floaters) {
    ctx.globalAlpha = 1 - f.life / 0.9;
    ctx.fillStyle = f.color || (f.gold ? '#ffd978' : '#ffffff');
    ctx.fillText(f.text, f.x, f.y - f.life * 60);
  }
  ctx.globalAlpha = 1;

  if (state === 'paused') { ctx.fillStyle = 'rgba(20,8,50,0.3)'; ctx.fillRect(0, 0, W, H); }
}

// ---------- The ONE animation loop (started once, never duplicated) ----------
function frame(now) {
  rafId = requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.05);   // cap so tab switches don't jump
  lastTime = now;
  update(dt);
  draw();
  drawScene(reducedMotion ? 0 : now / 1000, dt);   // landscape layer behind the game
  if (memScene.open && !memScene.photo) drawMemScene(now / 1000);     // animated picture on the open memory page
}
function startLoop() {
  if (rafId) cancelAnimationFrame(rafId);   // safety: never two loops
  lastTime = performance.now();
  rafId = requestAnimationFrame(frame);
}

// ---------- Input ----------
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') { keys.left = true; e.preventDefault(); }
  else if (k === 'arrowright' || k === 'd') { keys.right = true; e.preventDefault(); }
  else if (k === 'escape' && memScene.open) closeMemory();
  else if (k === 'escape' && !bookOverlay.hidden) showOverlay(bookReturn);
  else if ((k === 'p' || k === 'escape') && !e.repeat) togglePause();
  else if ((k === ' ' || k === 'enter') && state === 'won' && !win.revealed) { revealWin(); e.preventDefault(); }   // skip to the letter
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') keys.left = false;
  if (k === 'arrowright' || k === 'd') keys.right = false;
});
window.addEventListener('blur', () => { keys.left = keys.right = false; });

function pointerMove(e) {
  if (state === 'playing') targetX = e.clientX;
  else if (state === 'won' && e.type === 'pointerdown') revealWin();   // tap to skip to the letter
}
stage.addEventListener('pointermove', pointerMove);
stage.addEventListener('pointerdown', pointerMove);
// stop the page from scrolling or zooming while playing on touch screens
stage.addEventListener('touchmove', (e) => {
  if (!(e.target && e.target.closest && e.target.closest('.card'))) e.preventDefault();   // but let tall cards scroll
}, { passive: false });

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();   // auto-pause if tab is hidden
});

// ---------- Buttons ----------
$('startBtn').addEventListener('click', startGame);
$('startBookBtn').addEventListener('click', () => showBook('startOverlay'));
$('overBookBtn').addEventListener('click', () => showBook('overOverlay'));
$('winBookBtn').addEventListener('click', () => showBook('winOverlay'));
$('pauseBookBtn').addEventListener('click', () => showBook('pauseOverlay'));
$('bookBackBtn').addEventListener('click', () => showOverlay(bookReturn));
$('memContinue').addEventListener('click', closeMemory);
$('modeStd').addEventListener('click', () => setMode('standard'));
$('modeRelax').addEventListener('click', () => setMode('relaxed'));
$('overModeBtn').addEventListener('click', () => showOverlay('startOverlay'));
$('winModeBtn').addEventListener('click', () => showOverlay('startOverlay'));
$('memPhoto').addEventListener('error', () => { if (memScene.current) photoState[memScene.current.id] = 'missing'; setPhoto(false); });   // a broken photo falls back to the illustration
$('againBtn').addEventListener('click', startGame);
$('winAgainBtn').addEventListener('click', startGame);
$('pauseRestartBtn').addEventListener('click', startGame);
$('resumeBtn').addEventListener('click', togglePause);
restartBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', () => { initAudio(); togglePause(); });
muteBtn.addEventListener('click', () => {
  muted = !muted;
  initAudio();
  muteBtn.textContent = muted ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-pressed', String(muted));
  muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
});

// ---------- Go! ----------
meterEl.setAttribute('aria-label', 'Progress to ' + TARGET_SCORE + ' points');
meterEl.setAttribute('aria-valuemax', TARGET_SCORE);
setMode(mode);
updateBookButtons();
resize();
updateHud();
startLoop();
$('startBtn').focus({ preventScroll: true });
