/* Php Scanner, web build.
   Screens, spoken lines and requirement IDs follow SRS Tables 13 to 15 (thesis appendix, 04b).
   The scanning screen has two sources:
   - 'sim': drawn banknotes picked on the demo bench (the clickable SRS prototype of 2026-10-04);
   - 'cam': this device's camera and a real LiteRT model that runs in the browser (detector.js). */

import { openCamera } from './camera.js';

const VERSION = '0.1.0';
const $ = (s, r) => (r || document).querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- Content (SRS Table 15) ---------- */
const NAME = 'Php Scanner';
const WORDS = { 20: 'Twenty', 50: 'Fifty', 100: 'One hundred', 200: 'Two hundred', 500: 'Five hundred', 1000: 'One thousand' };
const NOTES = {
  '20a': [20, 'a'], '50a': [50, 'a'], '100a': [100, 'a'], '200a': [200, 'a'], '500a': [500, 'a'], '1000a': [1000, 'a'],
  '50p': [50, 'p'], '100p': [100, 'p'], '500p': [500, 'p'], '1000p': [1000, 'p']
};
/* Drawing colors per value: [paper, ink, light]. Plain colour blocks, not likenesses. */
const COL = {
  20: ['#E58A3C', '#6E340A', '#F6C79A'], 50: ['#D45A4E', '#661A14', '#F1B3AB'], 100: ['#9C80BC', '#3F2A57', '#D9CAEA'],
  200: ['#6FA65D', '#264520', '#C3E0B8'], 500: ['#D9B44A', '#5C4510', '#F0DC96'], 1000: ['#5288C4', '#1B3A5E', '#BCD4EE']
};
const RATES = [{ v: 0.5, l: 'Very slow' }, { v: 0.75, l: 'Slow' }, { v: 1, l: 'Normal' }, { v: 1.5, l: 'Fast' }, { v: 2, l: 'Very fast' }];
const VOLS = [25, 50, 75, 100];
const LINES = {
  W1: 'Welcome to ' + NAME + '. This app says the value of a Philippine banknote. Hold one banknote in front of the camera on the back of the phone. When the app finds it, the phone vibrates and says the value. To hear the value again, tap the middle of the screen. With TalkBack, double-tap. The flashlight and settings buttons are at the bottom. Select Continue to start.',
  W2: NAME + ' needs the camera to see your banknotes. The images stay on this phone. Android will now ask for permission. Choose the option that allows the camera.',
  W3: 'The camera is off for this app, so it cannot see banknotes. Select Open settings, then allow the camera.',
  S1: NAME + ' ready.',
  S3: 'No banknote found. Hold the banknote flat in front of the back camera, and move it slowly. If the room is dark, turn on the flashlight.',
  none: 'No banknote announced yet.'
};
const SCREEN_NAMES = { W1: 'W1 Welcome', W2: 'W2 Camera permission', W2b: 'W2b Permission question of Android', W3: 'W3 Camera turned off', S1: 'S1 Scanning', S2: 'S2 Banknote announced', S3: 'S3 No banknote found', S4: 'S4 Flashlight on', S5: 'S5 Settings' };
const pesoMark = (v) => '<span class="peso" aria-hidden="true">P</span>' + v;

/* What the app announces: a drawn banknote ('500a') or a model label. A label that contains a
   denomination ('500', 'P500', '500_polymer') is a banknote; any other label is a test object. */
function describe(key) {
  if (NOTES[key]) return { note: true, value: NOTES[key][0] };
  const m = String(key).match(/(?:^|\D)(1000|500|200|100|50|20)(?!\d)/);
  if (m) return { note: true, value: +m[1] };
  return { note: false, name: String(key) };
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function spoken(key) {
  const d = describe(key);
  return d.note ? WORDS[d.value] + ' pesos' : cap(d.name);
}
function bannerHTML(key) {
  const d = describe(key);
  if (d.note) return '<div class="hero" aria-hidden="true">' + pesoMark(d.value) + '</div><div class="t24">' + WORDS[d.value] + ' pesos</div>';
  return '<div class="hero word">' + esc(cap(d.name)) + '</div><div class="t20">Test object, not a banknote</div>';
}

/* ---------- Icons: one filled set, 36-unit grid ---------- */
const ICON = {
  flash(on, size) {
    const s = size || 36;
    const rays = on ? '<path d="M18 2v5M7 5l3 4M29 5l-3 4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>' : '<path d="M6 33L30 5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>';
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><path d="M10 11h16l-3 8H13z" fill="currentColor"/><rect x="13" y="20" width="10" height="14" rx="2" fill="currentColor"/>' + rays + '</svg>';
  },
  gear(size) {
    const s = size || 36;
    let t = '';
    for (let i = 0; i < 8; i++) t += '<rect x="15.5" y="2" width="5" height="8" rx="1.5" fill="currentColor" transform="rotate(' + (i * 45) + ' 18 18)"/>';
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 36 36" aria-hidden="true" focusable="false">' + t + '<path fill-rule="evenodd" fill="currentColor" d="M18 8a10 10 0 1 1 0 20a10 10 0 1 1 0-20zM18 13.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9z"/></svg>';
  },
  camera(off, size) {
    const s = size || 36;
    const slash = off ? '<path d="M4 33L32 3" stroke="#000" stroke-width="7" stroke-linecap="round"/><path d="M4 33L32 3" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' : '';
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><path fill-rule="evenodd" fill="currentColor" d="M7 10h5l2.5-4h7L24 10h5a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4zM18 14a7 7 0 1 0 0 14a7 7 0 1 0 0-14z"/>' + slash + '</svg>';
  }
};

/* Logo: peso sign with sound waves, drawn as paths so it can become the launcher icon */
const LOGO = '<svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true" focusable="false"><circle cx="30" cy="40" r="27" fill="#FFD60A"/>' +
  '<rect x="20" y="25" width="6.5" height="31" fill="#000"/><path d="M23 28.2h10.5a7.3 7.3 0 0 1 0 14.6H23" fill="none" stroke="#000" stroke-width="6.5"/>' +
  '<rect x="15" y="30.6" width="29" height="2.8" fill="#000"/><rect x="15" y="36.4" width="29" height="2.8" fill="#000"/>' +
  '<path d="M62 30a14 14 0 0 1 0 20M69 23a24 24 0 0 1 0 34" fill="none" stroke="#FFD60A" stroke-width="4" stroke-linecap="round"/></svg>';

/* ---------- Camera view drawing (simulated source) ---------- */
function noteSVG(id, cx, cy, rot, o) {
  const n = NOTES[id], c = COL[n[0]], poly = n[1] === 'p';
  const hand = o.hand ? '<rect x="-128" y="22" width="22" height="58" rx="11" fill="#B47A55"/><rect x="-102" y="28" width="22" height="56" rx="11" fill="#B47A55"/><rect x="-76" y="32" width="21" height="50" rx="10.5" fill="#B47A55"/>' : '';
  const thumb = o.hand ? '<rect x="-150" y="-6" width="30" height="64" rx="15" fill="#C38A63" transform="rotate(18 -135 26)"/>' : '';
  const mark = poly
    ? '<rect x="70" y="-40" width="44" height="80" rx="9" fill="' + o.table + '" opacity=".9"/><rect x="70" y="-40" width="44" height="80" rx="9" fill="none" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="2"/>'
    : '<ellipse cx="90" cy="0" rx="30" ry="38" fill="' + c[2] + '" opacity=".75"/>';
  return '<g transform="translate(' + cx + ' ' + cy + ') rotate(' + rot + ')">' + hand +
    '<rect x="-140" y="-58" width="280" height="116" rx="4" fill="' + c[0] + '"/>' +
    '<rect x="-132" y="-50" width="264" height="100" rx="2" fill="none" stroke="' + c[1] + '" stroke-opacity=".45" stroke-width="1.5"/>' + mark +
    '<circle cx="-34" cy="4" r="25" fill="none" stroke="' + c[1] + '" stroke-opacity=".5" stroke-width="2"/>' +
    '<rect x="-112" y="34" width="118" height="5" rx="2" fill="' + c[1] + '" opacity=".4"/><rect x="-112" y="-22" width="44" height="5" rx="2" fill="' + c[1] + '" opacity=".35"/>' +
    '<text x="-124" y="-28" font-size="22" font-weight="700" fill="' + c[1] + '" font-family="AH, Arial, sans-serif">' + n[0] + '</text>' +
    '<text x="' + (poly ? 62 : 124) + '" y="48" text-anchor="end" font-size="22" font-weight="700" fill="' + c[1] + '" font-family="AH, Arial, sans-serif">' + n[0] + '</text>' +
    thumb + (o.glare ? '<ellipse cx="-24" cy="-14" rx="74" ry="20" fill="#FFFFFF" opacity=".6"/>' : '') + '</g>';
}
function boxSVG(x, y, w, h) {
  return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="9"/>' +
    '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8" fill="none" stroke="#FFD60A" stroke-width="4.5"/>';
}
function sceneSVG(st) {
  const table = st.flash ? '#6E655A' : '#4A433B';
  let s = '<rect width="360" height="600" fill="' + table + '"/>';
  for (let i = 0; i < 8; i++) s += '<rect x="0" y="' + (36 + i * 76) + '" width="360" height="3" fill="#000" opacity=".14"/>';
  if (st.scene === 'enter') s += noteSVG(st.den || '500a', 318, 338, -14, { hand: true, table: table });
  else if (st.scene === 'note') s += noteSVG(st.den, 180, 300, -5, { hand: true, glare: st.flash, table: table });
  else if (st.scene === 'two') s += noteSVG('100a', 214, 382, 9, { table: table }) + noteSVG('500a', 168, 262, -6, { glare: st.flash, table: table });
  else if (st.scene === 'other') {
    s += '<g transform="translate(190 300) rotate(7)"><rect x="-80" y="-130" width="160" height="260" fill="#ECE9E1"/>';
    for (let i = 0; i < 9; i++) s += '<rect x="-60" y="' + (-104 + i * 24) + '" width="' + (i % 3 === 2 ? 70 : 120) + '" height="6" rx="3" fill="#9A968C"/>';
    s += '</g>';
  }
  if (st.flash) s += '<rect width="360" height="600" fill="#FFFFFF" opacity=".07"/>';
  if (st.box) s += st.scene === 'two' ? boxSVG(15, 182, 307, 161) : boxSVG(27, 222, 306, 156);
  return '<svg width="360" height="600" viewBox="0 0 360 600" aria-hidden="true" focusable="false">' + s + '</svg>';
}

/* ---------- Screens ---------- */
const STATUS = '<div class="sbar" aria-hidden="true"><span>10:30</span><svg width="44" height="12" viewBox="0 0 44 12"><path d="M0 11h3V8H0zM5 11h3V5H5zM10 11h3V2h-3z" fill="currentColor"/><rect x="20" y="1" width="20" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="22" y="3" width="13" height="6" rx="1" fill="currentColor"/><rect x="41" y="4" width="2" height="4" rx="1" fill="currentColor"/></svg></div>';
const GESTURE = '<div class="gbar" aria-hidden="true"><i></i></div>';

const VIEWS = {
  W1: () => '<section class="view page" tabindex="-1" aria-label="Welcome">' + LOGO +
    '<h1 class="t32">Welcome to ' + NAME + '</h1>' +
    '<ol class="steps"><li><span class="n" aria-hidden="true">1</span><span>Hold one banknote in front of the back camera.</span></li>' +
    '<li><span class="n" aria-hidden="true">2</span><span>The phone vibrates and says the value.</span></li>' +
    '<li><span class="n" aria-hidden="true">3</span><span>Tap the middle of the screen to hear it again.</span></li></ol>' +
    '<div class="grow"></div><button type="button" class="cta" data-act="w1Continue">Continue</button></section>',
  W2: () => '<section class="view page" tabindex="-1" aria-label="Camera permission"><span class="acc">' + ICON.camera(false, 96) + '</span>' +
    '<div class="stack"><h1 class="t24b">' + NAME + ' needs the camera to see your banknotes.</h1><p class="t20">The images stay on this phone.</p></div>' +
    '<div class="grow"></div><button type="button" class="cta" data-act="w2Continue">Continue</button></section>',
  W3: () => '<section class="view page" tabindex="-1" aria-label="Camera turned off"><span class="acc">' + ICON.camera(true, 96) + '</span>' +
    '<div class="stack"><h1 class="t32 acc">The camera is off for this app.</h1><p class="t20">' + NAME + ' cannot see banknotes without the camera.</p></div>' +
    '<div class="grow"></div><div class="stack"><button type="button" class="cta" data-act="openSettings">Open settings</button><button type="button" class="cta alt" data-act="tryAgain">Try again</button></div></section>',
  W2b: () => VIEWS.W2().replace('tabindex="-1"', 'inert').replace(' data-act="w2Continue"', '') +
    '<div class="dim" aria-hidden="true"></div><div class="sysdlg" role="dialog" aria-modal="true" aria-label="Camera permission">' +
    '<span style="color:#A8C7FA">' + ICON.camera(false, 32) + '</span><p>Allow <b>' + NAME + '</b> to take pictures and record video?</p>' +
    '<button type="button" data-act="allow">While using the app</button><button type="button" data-act="allow">Only this time</button><button type="button" data-act="deny">Don’t allow</button></div>',
  SCAN: () => '<section class="view" tabindex="-1" aria-label="Scanning"><button type="button" class="cam" id="cam" data-act="repeat" aria-label="Repeat last announcement"></button>' +
    '<div class="banner" id="banner"></div><div class="bbar"><button type="button" class="abtn" id="flash" data-act="flash"></button>' +
    '<button type="button" class="abtn" data-act="settings">' + ICON.gear() + '<span>Settings</span></button></div></section>',
  S5: () => '<section class="view page" tabindex="-1" aria-label="Settings"><h1 class="t32">Settings</h1>' +
    '<div class="setg"><h2 class="t20">Speech rate</h2><p class="val" id="vRate"></p><div class="pair"><button type="button" class="pbtn" data-act="slower" aria-label="Slower speech">Slower</button><button type="button" class="pbtn" data-act="faster" aria-label="Faster speech">Faster</button></div></div>' +
    '<div class="setg"><h2 class="t20">Speech volume</h2><p class="val" id="vVol"></p><div class="pair"><button type="button" class="pbtn" data-act="quieter" aria-label="Quieter speech">Quieter</button><button type="button" class="pbtn" data-act="louder" aria-label="Louder speech">Louder</button></div></div>' +
    '<div class="grow"></div><div class="stack"><button type="button" class="pbtn wide" data-act="replay">Replay tutorial</button><button type="button" class="pbtn wide" data-act="back">Back</button></div></section>'
};
const isScan = (sc) => sc === 'S1' || sc === 'S2' || sc === 'S3' || sc === 'S4';

function mount(root, sc) {
  root.innerHTML = STATUS + (isScan(sc) ? VIEWS.SCAN() : VIEWS[sc]()) + GESTURE;
}
/* st: { live, scene, den, flash, box, banner: 'scan'|'note'|'guide', shown } */
function paintScan(root, st) {
  const cam = $('#cam', root);
  if (st.live) {
    if (!$('canvas', cam)) cam.innerHTML = '<canvas class="feed" width="720" height="1200" aria-hidden="true"></canvas>';
  } else cam.innerHTML = sceneSVG(st);
  const b = $('#banner', root);
  if (st.banner === 'note') b.innerHTML = bannerHTML(st.shown);
  else if (st.banner === 'guide') b.innerHTML = '<div class="t24b acc">No banknote found</div><div class="t20">Hold the banknote flat and move it slowly</div>';
  else b.innerHTML = '<div class="t32">Scanning</div>';
  const f = $('#flash', root);
  f.className = 'abtn' + (st.flash ? ' on' : '');
  f.setAttribute('aria-label', st.flash ? 'Flashlight, on' : 'Flashlight, off');
  f.innerHTML = ICON.flash(st.flash) + '<span>Flashlight ' + (st.flash ? 'on' : 'off') + '</span>';
}
function paintSettings(root, rate, vol) {
  $('#vRate', root).textContent = RATES[rate].l;
  $('#vVol', root).textContent = VOLS[vol] + '%';
}

/* ---------- Figure sheets (#fig7, #fig8, #fig9, #screens) for the SRS appendix ---------- */
const FIGS = {
  fig7: [['W1'], ['W2'], ['W3']],
  fig8: [['S1', { scene: 'enter', den: '500a', banner: 'scan' }], ['S2', { scene: 'note', den: '500a', box: true, banner: 'note', shown: '500a' }], ['S3', { scene: 'empty', banner: 'guide' }]],
  fig9: [['S4', { scene: 'note', den: '500a', box: true, banner: 'note', shown: '500a', flash: true }], ['S5']]
};
FIGS.screens = [['W1'], ['W2'], ['W2b'], ['W3']].concat(FIGS.fig8, FIGS.fig9);
const figKey = location.hash.replace('#', '');
if (FIGS[figKey]) renderFigures(figKey);
else startApp();

function renderFigures(key) {
  document.documentElement.classList.add('figmode');
  const sheet = $('#sheet');
  FIGS[key].forEach(function (f, i) {
    const shot = document.createElement('div');
    shot.className = 'shot';
    const scr = document.createElement('div');
    scr.className = 'scr';
    mount(scr, f[0]);
    if (isScan(f[0])) paintScan(scr, f[1]);
    if (f[0] === 'S5') paintSettings(scr, 2, 3);
    const lab = document.createElement('div');
    lab.className = 'lab';
    lab.textContent = key === 'screens' ? f[0] : '(' + 'abc'[i] + ')';
    shot.append(scr, lab);
    sheet.append(shot);
  });
}

/* ---------- Live app ---------- */
function startApp() {
  const app = $('#app'), logEl = $('#log'), device = $('#device');
  const KEY = 'php-scanner-v0';
  const S = { screen: 'W1', replay: false, flash: false, rate: 2, vol: 3, spoken: 'word', sound: true, source: 'sim',
    scene: 'empty', den: null, placedAt: 0, latency: 500, inView: null, lastDetect: 0, lastGuide: 0, guiding: false, last: null, boxOn: false, sig: '' };
  /* Camera source: c = opened camera, det = loaded detector, stable = label seen in 2 frames in a row */
  const CAM = { on: false, gen: 0, c: null, det: null, D: null, busy: false, video: $('#srcVideo'), models: [],
    modelId: null, acc: 'webgpu', threshold: 0.5, ignorePeople: true, status: 'Camera off', error: false,
    candKey: null, candN: 0, stable: null, stableScore: 0, box: null, lastSeen: 0, seq: 0, lastSeq: -1, paced: false, top: [],
    total: [], infer: [], done: [], torchNoted: false };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) {
      ['rate', 'vol', 'spoken', 'sound'].forEach(function (k) { if (k in saved) S[k] = saved[k]; });
      ['modelId', 'acc', 'threshold', 'ignorePeople'].forEach(function (k) { if (k in saved) CAM[k] = saved[k]; });
    }
  } catch (e) { /* storage blocked: use defaults */ }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ rate: S.rate, vol: S.vol, spoken: S.spoken, sound: S.sound,
        modelId: CAM.modelId, acc: CAM.acc, threshold: CAM.threshold, ignorePeople: CAM.ignorePeople }));
    } catch (e) { /* ignore */ }
  }
  const t0 = performance.now();

  /* Speech (Web Speech API). Prefer an offline English voice, as the app uses the offline TTS of the phone. */
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let voice = null;
  function pickVoice() {
    const label = $('#voice');
    if (!synth) { label.textContent = 'this browser has no speech voice, so only the captions show.'; return; }
    const vs = synth.getVoices().filter(function (v) { return /^en/i.test(v.lang); });
    const score = function (v) { return (v.localService ? 4 : 0) + (/en[-_]PH/i.test(v.lang) ? 2 : 0) + (/en[-_](US|GB)/i.test(v.lang) ? 1 : 0); };
    vs.sort(function (a, b) { return score(b) - score(a); });
    voice = vs[0] || null;
    label.textContent = voice ? voice.name + (voice.localService ? ' (works offline)' : ' (needs internet)') : 'no English voice found yet.';
  }
  if (synth) { pickVoice(); synth.addEventListener('voiceschanged', pickVoice); } else pickVoice();

  function log(text, o) {
    const li = document.createElement('li');
    const sec = Math.floor((performance.now() - t0) / 1000);
    li.className = o.note ? 'note' : 'line';
    let meta = '';
    if (o.vib) meta += '<span class="chip">Vibrates</span>';
    if (o.score != null) meta += '<span class="fr">score ' + o.score.toFixed(2) + '</span>';
    if (o.tags) meta += '<span class="fr">' + o.tags.join(' ') + '</span>';
    li.innerHTML = '<span class="ts">' + String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0') + '</span>' +
      '<span class="tx">' + (o.note ? esc(text) : '“' + esc(text) + '”') + '</span>' + (meta ? '<span class="meta">' + meta + '</span>' : '');
    logEl.append(li);
    while (logEl.children.length > 40) logEl.firstChild.remove();
    logEl.scrollTop = logEl.scrollHeight;
  }
  function say(text, o) {
    o = o || {};
    log(text, o);
    if (o.vib) buzz();
    if (!S.sound || !synth) return;
    synth.cancel();
    const words = S.spoken === 'letters' ? text.split(NAME).join('P H P Scanner') : text;
    (words.match(/[^.?!]+[.?!]*/g) || [words]).forEach(function (part) {
      const u = new SpeechSynthesisUtterance(part.trim());
      if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-US';
      u.rate = RATES[S.rate].v;
      u.volume = VOLS[S.vol] / 100;
      synth.speak(u);
    });
  }
  const note = (text, tags) => log(text, { note: true, tags: tags });
  function buzz() {
    try { if (navigator.vibrate) navigator.vibrate(150); } catch (e) { /* ignore */ }
    device.classList.add('buzz');
    setTimeout(function () { device.classList.remove('buzz'); }, 300);
  }

  /* Keep the screen on while scanning only (the Android app will use FLAG_KEEP_SCREEN_ON) */
  let lock = null;
  function keepAwake(on) {
    try {
      if (on && !lock && navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { lock = l; }, function () {});
      if (!on && lock) { lock.release(); lock = null; }
    } catch (e) { /* ignore */ }
  }

  function screenCode() {
    if (!isScan(S.screen)) return S.screen;
    if (S.flash) return 'S4';
    if (S.inView) return 'S2';
    return S.guiding ? 'S3' : 'S1';
  }
  function updateNow() { $('#now').textContent = SCREEN_NAMES[screenCode()]; }

  function go(sc, opts) {
    opts = opts || {};
    S.screen = sc;
    mount(app, sc);
    if (isScan(sc)) {
      S.flash = false;
      if (CAM.c) CAM.c.setTorch(false);
      S.inView = null; S.guiding = false; S.boxOn = false;
      S.lastDetect = performance.now(); S.lastGuide = 0; S.placedAt = performance.now(); S.sig = '';
      paintLive();
      keepAwake(true);
    } else keepAwake(false);
    if (sc === 'S5') paintSettings(app, S.rate, S.vol);
    if (opts.focus !== false) { const v = $('.view', app); if (v) v.focus({ preventScroll: true }); if (sc === 'W2b') $('.sysdlg button', app).focus({ preventScroll: true }); }
    updateNow();
  }

  function paintLive() {
    const live = S.source === 'cam';
    const banner = S.inView ? 'note' : (S.guiding ? 'guide' : 'scan');
    const st = live ? { live: true, flash: S.flash, banner: banner, shown: S.inView }
      : { scene: S.scene, den: S.den, flash: S.flash, box: S.boxOn, banner: banner, shown: S.inView };
    const sig = JSON.stringify(st);
    if (sig === S.sig) return;
    S.sig = sig;
    paintScan(app, st);
    updateNow();
  }

  /* One announcement loop for both sources (FR-05 to FR-12 and the 2-second rule under Table 13) */
  function tick() {
    if (!isScan(S.screen)) return;
    const now = performance.now();
    const live = S.source === 'cam';
    const raw = live ? CAM.stable : (S.scene === 'note' ? S.den : S.scene === 'two' ? '500a' : null);
    const target = raw && (live || now - S.placedAt >= S.latency) ? raw : null;
    if (target) {
      S.lastDetect = now; S.guiding = false; S.boxOn = true;
      if (S.inView !== target) {
        S.inView = target; S.last = target;
        const tags = ['FR-05', 'FR-06', 'FR-07', 'FR-08', 'FR-23'];
        if (!live && S.scene === 'two') tags.push('FR-10');
        say(spoken(target) + '.', { vib: true, tags: tags, score: live ? CAM.stableScore : null });
      }
    } else {
      S.boxOn = false;
      if (!raw) {
        if (S.inView && now - S.lastDetect >= 2000) S.inView = null;
        if (now - S.lastDetect >= 5000 && (S.lastGuide < S.lastDetect || now - S.lastGuide >= 10000)) {
          S.lastGuide = now; S.guiding = true;
          say(LINES.S3, { tags: ['FR-11', 'FR-12'] });
        }
      }
    }
    paintLive();
  }
  setInterval(tick, 150);

  /* ---------- Source: drawn banknotes ---------- */
  function setScene(kind, den) {
    if (kind === S.scene && den === S.den) return;
    S.scene = kind; S.den = den || null;
    S.placedAt = performance.now();
    S.latency = 300 + Math.random() * 400;
    document.querySelectorAll('.nb').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.kind === kind && (b.dataset.den || null) === S.den)); });
    if (kind === 'two') note('Two banknotes in view. The app announces only the one with the higher confidence score.', ['FR-10']);
    if (kind === 'other') note('Another object in view. No detection passes the threshold, so the app says nothing.', ['FR-06']);
    if (!isScan(S.screen)) note('Scanning is paused on this screen. Go to the scanning screen to see the result.');
    if (isScan(S.screen)) paintLive();
  }
  function noteButton(id) {
    const v = NOTES[id][0];
    return '<button type="button" class="nb" data-kind="note" data-den="' + id + '" aria-pressed="false"><i style="background:' + COL[v][0] + '"></i>₱' + v + '</button>';
  }
  $('#nAbaca').innerHTML = ['20a', '50a', '100a', '200a', '500a', '1000a'].map(noteButton).join('');
  $('#nPoly').innerHTML = ['50p', '100p', '500p', '1000p'].map(noteButton).join('');
  $('#nOther').innerHTML = '<button type="button" class="nb" data-kind="empty" aria-pressed="true">No banknote</button>' +
    '<button type="button" class="nb" data-kind="two" aria-pressed="false">Two banknotes</button>' +
    '<button type="button" class="nb" data-kind="other" aria-pressed="false">Another object</button>';
  $('#simBox').addEventListener('click', function (e) {
    const b = e.target.closest('.nb');
    if (b) setScene(b.dataset.kind, b.dataset.den);
  });

  /* ---------- Source: this device's camera and a real model ---------- */
  const ACC_NAMES = { webgpu: 'GPU (WebGPU)', wasm: 'CPU (WebAssembly)' };
  const gpuOK = 'gpu' in navigator;
  const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const push = (a, v) => { a.push(v); if (a.length > 30) a.shift(); };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  /* The phone screen shows a 360 x 600 window, so the app uses the centre of the frame with that shape. */
  function cropRect(vw, vh) {
    const a = 360 / 600;
    if (vw / vh > a) { const w = vh * a; return { x: (vw - w) / 2, y: 0, w: w, h: vh }; }
    const h = vw / a; return { x: 0, y: (vh - h) / 2, w: vw, h: h };
  }
  function setStatus(text, error) {
    CAM.status = text; CAM.error = !!error;
    renderReadout();
  }
  function camError(e) {
    const n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'The browser blocked the camera. Allow it with the camera icon in the address bar, then choose the camera again.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No camera was found on this device.';
    if (n === 'NotReadableError') return 'Another app is using the camera. Close it, then choose the camera again.';
    return 'The camera did not start: ' + ((e && e.message) || e);
  }
  const waitIdle = () => new Promise(function (res) { (function chk() { if (CAM.busy) setTimeout(chk, 10); else res(); })(); });

  async function loadRegistry() {
    if (CAM.models.length) return;
    const r = await fetch('models/models.json');
    CAM.models = (await r.json()).models;
    if (!CAM.models.some(function (m) { return m.id === CAM.modelId; })) CAM.modelId = CAM.models[0].id;
    $('#selModel').innerHTML = CAM.models.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name + ', ' + m.trainedOn) + '</option>'; }).join('');
    $('#selModel').value = CAM.modelId;
  }

  async function loadModel(gen) {
    const spec = CAM.models.find(function (m) { return m.id === CAM.modelId; });
    const old = CAM.det;
    CAM.det = null;
    await waitIdle();
    if (old) old.dispose();
    CAM.total = []; CAM.infer = []; CAM.done = []; CAM.top = [];
    CAM.stable = null; CAM.candKey = null; CAM.candN = 0;
    const acc = CAM.acc === 'webgpu' && !gpuOK ? 'wasm' : CAM.acc;
    setStatus('Loading ' + spec.name + ' on the ' + ACC_NAMES[acc]);
    try {
      if (!CAM.D) CAM.D = await import('./detector.js');
      const det = await CAM.D.createDetector(spec, acc);
      if (gen !== CAM.gen) { det.dispose(); return; }
      CAM.det = det;
      setStatus('Running');
      note('Model loaded: ' + spec.name + ' (' + spec.trainedOn + ') on the ' + ACC_NAMES[acc] + ', in ' + Math.round(det.loadMs) + ' ms.', ['NFR-12']);
    } catch (e) {
      if (gen === CAM.gen) setStatus('The model did not load: ' + ((e && e.message) || e), true);
    }
  }

  async function startCam() {
    const gen = ++CAM.gen;
    setStatus('Starting the camera');
    try { await loadRegistry(); } catch (e) { setStatus('models/models.json did not load: ' + e.message, true); return; }
    let c;
    try { c = await openCamera(CAM.video); } catch (e) {
      if (gen !== CAM.gen) return;
      setStatus(camError(e), true);
      note('The camera did not start, so the demo stays on the drawn banknotes.');
      setSource('sim', { keepStatus: true });
      return;
    }
    if (gen !== CAM.gen) { c.stop(); return; }
    CAM.c = c; CAM.on = true;
    note('Camera on: ' + c.label + '. Each frame stays in this browser and is dropped after detection.', ['NFR-09']);
    if (!isScan(S.screen)) note('Go to the scanning screen to see the camera.');
    S.sig = ''; if (isScan(S.screen)) paintLive();
    drawLoop(gen);
    await loadModel(gen);
    inferLoop(gen);
  }

  function stopCam() {
    CAM.gen++; CAM.on = false;
    const det = CAM.det;
    CAM.det = null;
    waitIdle().then(function () { if (det) det.dispose(); });
    if (CAM.c) { CAM.c.stop(); CAM.c = null; }
    CAM.stable = null; CAM.candKey = null; CAM.candN = 0; CAM.top = [];
  }

  /* Count new camera frames, so each frame is detected at most once. When the model is slower than
     the camera, the loop takes the newest frame and skips the rest (like CameraX STRATEGY_KEEP_ONLY_LATEST). */
  function watchFrames(gen) {
    const v = CAM.video;
    if (!v.requestVideoFrameCallback) return;
    v.requestVideoFrameCallback(function () {
      if (gen !== CAM.gen) return;
      CAM.seq++; CAM.paced = true;
      watchFrames(gen);
    });
  }
  const nextFrame = () => new Promise(function (res) { requestAnimationFrame(function () { res(); }); });
  async function inferLoop(gen) {
    CAM.seq = 0; CAM.lastSeq = -1; CAM.paced = false;
    watchFrames(gen);
    while (CAM.on && gen === CAM.gen) {
      const det = CAM.det, v = CAM.video;
      if (det && isScan(S.screen) && v.readyState >= 2 && v.videoWidth && (!CAM.paced || CAM.seq !== CAM.lastSeq)) {
        CAM.lastSeq = CAM.seq;
        const c = cropRect(v.videoWidth, v.videoHeight);
        CAM.busy = true;
        try {
          const r = await det.detect(v, c.x, c.y, c.w, c.h, Math.min(0.25, CAM.threshold));
          if (det === CAM.det && gen === CAM.gen) onResult(r);
        } catch (e) {
          if (det === CAM.det) { CAM.det = null; setStatus('Detection stopped: ' + ((e && e.message) || e), true); }
        }
        CAM.busy = false;
      }
      await nextFrame();
    }
  }

  function onResult(r) {
    const now = performance.now();
    push(CAM.total, r.ms.total); push(CAM.infer, r.ms.inference);
    CAM.done.push(now);
    while (CAM.done.length && now - CAM.done[0] > 1000) CAM.done.shift();
    const usable = r.dets.filter(function (d) { return !(CAM.ignorePeople && d.label === 'person'); });
    CAM.top = usable.slice(0, 3);
    const best = usable[0] && usable[0].score >= CAM.threshold ? usable[0] : null; /* FR-06, FR-10 */
    if (best) {
      if (best.label === CAM.candKey) CAM.candN++; else { CAM.candKey = best.label; CAM.candN = 1; }
      if (CAM.candN >= 2) { CAM.stable = best.label; CAM.stableScore = best.score; CAM.box = best; CAM.lastSeen = now; }
      else if (best.label !== CAM.stable) CAM.stable = null;
    } else { CAM.candKey = null; CAM.candN = 0; CAM.stable = null; }
  }

  function drawLoop(gen) {
    if (!CAM.on || gen !== CAM.gen) return;
    const cv = $('canvas.feed', app), v = CAM.video;
    if (cv && v.readyState >= 2 && v.videoWidth) {
      const g = cv.getContext('2d');
      const c = cropRect(v.videoWidth, v.videoHeight);
      g.save();
      if (CAM.c && CAM.c.mirror) { g.translate(cv.width, 0); g.scale(-1, 1); }
      g.drawImage(v, c.x, c.y, c.w, c.h, 0, 0, cv.width, cv.height);
      const b = CAM.box;
      if (S.inView && b && b.label === S.inView && performance.now() - CAM.lastSeen < 400) { /* FR-23 */
        const x = clamp01(b.x0) * cv.width, y = clamp01(b.y0) * cv.height;
        const w = clamp01(b.x1) * cv.width - x, h = clamp01(b.y1) * cv.height - y;
        g.beginPath();
        if (g.roundRect) g.roundRect(x, y, w, h, 16); else g.rect(x, y, w, h);
        g.lineWidth = 18; g.strokeStyle = 'rgba(0, 0, 0, .55)'; g.stroke();
        g.lineWidth = 9; g.strokeStyle = '#FFD60A'; g.stroke();
      }
      g.restore();
    }
    requestAnimationFrame(function () { drawLoop(gen); });
  }

  const ro = {
    status: $('#roStatus'), camera: $('#roCamera'), model: $('#roModel'), input: $('#roInput'), acc: $('#roAcc'),
    infer: $('#roInfer'), total: $('#roTotal'), fps: $('#roFps'), seen: $('#roSeen')
  };
  function renderReadout() {
    if ($('#camBox').hidden) return;
    const spec = CAM.models.find(function (m) { return m.id === CAM.modelId; });
    const det = CAM.det;
    const ms = (v) => v == null ? 'waiting' : Math.round(v) + ' ms';
    ro.status.textContent = CAM.status;
    ro.status.classList.toggle('bad', CAM.error);
    ro.camera.textContent = CAM.c ? CAM.c.label + (CAM.c.mirror ? ', view mirrored' : '') : 'Off';
    ro.model.textContent = spec ? spec.name + ', ' + spec.trainedOn : 'None';
    ro.input.textContent = det ? det.input.width + ' × ' + det.input.height + ' px, ' + det.input.dtype + (spec.sizeMB ? ', ' + spec.sizeMB + ' MB file' : '') : 'Not loaded';
    ro.acc.textContent = det ? ACC_NAMES[det.accelerator] + (det.accelerator === 'webgpu' && det.fullyAccelerated === false ? ', some layers on the CPU' : '') : 'Not loaded';
    ro.infer.textContent = det ? ms(median(CAM.infer)) + ' median of the last ' + CAM.infer.length : 'Not loaded';
    ro.total.textContent = det ? ms(median(CAM.total)) + ' median' : 'Not loaded';
    ro.fps.textContent = det ? String(CAM.done.length) : 'Not loaded';
    ro.seen.textContent = !det ? 'Not loaded' : CAM.top.length ? CAM.top.map(function (d) { return d.label + ' ' + d.score.toFixed(2); }).join(', ') : 'Nothing above 0.25';
  }
  setInterval(renderReadout, 300);

  function setSource(src, o) {
    o = o || {};
    if (src === S.source) return;
    S.source = src;
    document.querySelectorAll('input[name="src"]').forEach(function (r) { r.checked = r.value === src; });
    $('#simBox').hidden = src !== 'sim';
    $('#camBox').hidden = src !== 'cam';
    S.inView = null; S.boxOn = false; S.guiding = false; S.lastDetect = performance.now(); S.lastGuide = 0; S.sig = '';
    if (src === 'cam') startCam();
    else { stopCam(); if (!o.keepStatus) setStatus('Camera off'); }
    if (isScan(S.screen)) paintLive();
    updateNow();
  }
  document.querySelectorAll('input[name="src"]').forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) setSource(r.value); });
  });
  $('#selModel').addEventListener('change', function () {
    CAM.modelId = $('#selModel').value; save();
    if (CAM.on) loadModel(CAM.gen);
  });
  const selAcc = $('#selAcc');
  if (!gpuOK) { selAcc.querySelector('option[value="webgpu"]').disabled = true; CAM.acc = 'wasm'; }
  selAcc.value = CAM.acc;
  selAcc.addEventListener('change', function () {
    CAM.acc = selAcc.value; save();
    if (CAM.on) loadModel(CAM.gen);
  });
  const thr = $('#thr'), thrOut = $('#thrOut');
  thr.value = CAM.threshold; thrOut.textContent = Number(CAM.threshold).toFixed(2);
  thr.addEventListener('input', function () { CAM.threshold = Number(thr.value); thrOut.textContent = CAM.threshold.toFixed(2); save(); });
  const optPeople = $('#optPeople');
  optPeople.checked = CAM.ignorePeople;
  optPeople.addEventListener('change', function () { CAM.ignorePeople = optPeople.checked; save(); });

  /* ---------- App actions (SRS Table 15) ---------- */
  const ACT = {
    w1Continue() {
      if (S.replay) { S.replay = false; go('S1'); say(LINES.S1, { tags: ['FR-01', 'FR-15'] }); }
      else { go('W2'); say(LINES.W2, { tags: ['FR-03'] }); }
    },
    w2Continue() { go('W2b'); note('Android asks for the camera permission. Its wording differs between Android versions.', ['FR-03']); },
    allow() { go('S1'); say(LINES.S1, { tags: ['FR-01', 'FR-15'] }); },
    deny() { go('W3'); say(LINES.W3, { tags: ['FR-04'] }); },
    openSettings() { note('Android opens the settings of the app here. The demo assumes that the user allowed the camera.', ['FR-04']); go('S1'); say(LINES.S1, { tags: ['FR-01', 'FR-15'] }); },
    tryAgain() { go('W2b'); note('Android asks for the camera permission again.', ['FR-04']); },
    repeat() {
      if (S.last) say(spoken(S.last) + '.', { tags: ['FR-13'] });
      else say(LINES.none, { tags: ['FR-14'] });
    },
    flash() {
      S.flash = !S.flash; S.sig = '';
      paintLive();
      say(S.flash ? 'Flashlight on.' : 'Flashlight off.', { tags: ['FR-16'] });
      if (S.source === 'cam' && CAM.c) {
        if (CAM.c.hasTorch) CAM.c.setTorch(S.flash);
        else if (!CAM.torchNoted) { CAM.torchNoted = true; note('This camera has no flashlight, so only the button changes. A phone with a flashlight turns it on.'); }
      }
      const f = $('#flash', app); if (f) f.focus({ preventScroll: true });
    },
    settings() { go('S5'); say('Settings.', { tags: ['FR-22'] }); },
    slower() { stepRate(-1); }, faster() { stepRate(1); },
    quieter() { stepVol(-1); }, louder() { stepVol(1); },
    replay() { S.replay = true; go('W1'); say(LINES.W1, { tags: ['FR-21'] }); },
    back() { go('S1'); say(LINES.S1, { tags: ['FR-01', 'FR-15'] }); }
  };
  function stepRate(d) {
    const n = S.rate + d;
    if (n < 0 || n >= RATES.length) { say(d > 0 ? 'Already the fastest.' : 'Already the slowest.', { tags: ['FR-17'] }); return; }
    S.rate = n; save(); paintSettings(app, S.rate, S.vol);
    say(RATES[n].l + '. Five hundred pesos.', { tags: ['FR-17', 'FR-19', 'FR-20'] });
  }
  function stepVol(d) {
    const n = S.vol + d;
    if (n < 0 || n >= VOLS.length) { say(d > 0 ? 'Already the loudest.' : 'Already the quietest.', { tags: ['FR-18'] }); return; }
    S.vol = n; save(); paintSettings(app, S.rate, S.vol);
    say(VOLS[n] + ' percent. Five hundred pesos.', { tags: ['FR-18', 'FR-19', 'FR-20'] });
  }
  app.addEventListener('click', function (e) {
    const b = e.target.closest('[data-act]');
    if (b && ACT[b.dataset.act]) ACT[b.dataset.act]();
  });

  /* Start buttons */
  $('#startFirst').addEventListener('click', function () {
    S.replay = false; S.last = null;
    go('W1', { focus: false });
    say(LINES.W1, { tags: ['FR-02'] });
  });
  $('#startLater').addEventListener('click', function () {
    S.replay = false;
    go('S1', { focus: false });
    say(LINES.S1, { tags: ['FR-01', 'FR-15'] });
  });

  /* Options */
  const optSound = $('#optSound');
  optSound.checked = S.sound;
  optSound.addEventListener('change', function () { S.sound = optSound.checked; if (!S.sound && synth) synth.cancel(); save(); });
  $(S.spoken === 'letters' ? '#spLetters' : '#spWord').checked = true;
  document.querySelectorAll('input[name="spoken"]').forEach(function (r) {
    r.addEventListener('change', function () { S.spoken = r.value; save(); if (S.sound) say('Welcome to ' + NAME + '.', { tags: ['name test'] }); });
  });
  $('#ver').textContent = 'v' + VERSION;

  /* Fit the phone to the window */
  function fit() {
    const wide = window.matchMedia('(min-width: 861px)').matches;
    const cellW = wide ? Infinity : document.querySelector('.wrap').clientWidth - 32;
    const h = window.innerHeight - (wide ? 40 : 24);
    const k = Math.max(0.55, Math.min(1.1, cellW / 380, h / 800));
    document.documentElement.style.setProperty('--k', k.toFixed(3));
  }
  window.addEventListener('resize', fit);
  fit();

  /* Resting state: W1, silent until the viewer presses a button */
  go('W1', { focus: false });
  note('Press "Play first launch" to hear the app from the start, or "Play later launch" to go straight to scanning.');

  /* Hooks for the automated check in tools/ (no effect on the app) */
  window.__app = { S: S, CAM: CAM, setSource: setSource, go: go };
}
