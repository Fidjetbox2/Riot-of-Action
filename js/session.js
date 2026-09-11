/* ═══ Session player ══════════════════════════════════════════════════
   The timed viewer: a schedule of durations, one image at a time, with
   the study tools (flip, greyscale, blur, grid) an artist actually uses.
   ═════════════════════════════════════════════════════════════════════ */

const Session = (function () {
  'use strict';

  const SEEN_KEY = 'riotofaction.seen.v1';
  const SEEN_CAP = 1200;

  let playlist = [];          // records
  let schedule = [];          // ms per image, 0 = untimed
  let index = -1;
  let remaining = 0;
  let duration = 0;
  let paused = false;
  let running = false;
  let clockId = null;
  let lastTick = 0;
  let opts = {};
  let idleTimer = null;
  let uiPinned = false;
  let audioCtx = null;

  /* ── Presets ─────────────────────────────────────────────────────── */

  const CLASS_PRESETS = [
    { id: 'quick', name: 'Quick gestures', blocks: [[30, 10]],
      note: '30s throughout' },
    { id: 'warmup', name: 'Warm-up', blocks: [[30, 5], [60, 5]],
      note: '30s, then 1m' },
    { id: 'standard', name: 'Standard class', blocks: [[30, 8], [60, 6], [300, 2], [600, 1]],
      note: '30s building up to 10m' },
    { id: 'long', name: 'Long study', blocks: [[300, 3], [600, 2], [1500, 1]],
      note: '5m, 10m, then a 25m study' },
    { id: 'marathon', name: 'Marathon', blocks: [[600, 6]],
      note: '10m each' },
    { id: 'ramp', name: 'Slow ramp', blocks: [[15, 6], [30, 6], [60, 4], [120, 3], [300, 2]],
      note: '15s building up to 5m' }
  ];

  /* ── Playlist construction ───────────────────────────────────────── */

  function readSeen() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]') || []; }
    catch (e) { return []; }
  }

  function writeSeen(ids) {
    try {
      const trimmed = ids.slice(-SEEN_CAP);
      localStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
    } catch (e) { /* ignore */ }
  }

  function expandSchedule(config, wanted) {
    // Returns an array of per-image durations in ms.
    if (config.mode === 'none') return new Array(wanted).fill(0);

    if (config.mode === 'fixed') {
      return new Array(wanted).fill(config.interval * 1000);
    }

    const blocks = config.blocks || [];
    const out = [];
    blocks.forEach(function (b) {
      for (let i = 0; i < b[1]; i++) out.push(b[0] * 1000);
    });
    if (!out.length) return new Array(wanted).fill(60000);
    // Endless sessions loop the pattern; finite ones are as long as the plan.
    if (wanted === 0) return out;
    while (out.length < wanted) out.push(out[out.length - 1]);
    return out.slice(0, wanted);
  }

  function buildPlaylist(pool, config) {
    let list = pool.slice();
    if (config.onePerChampion) list = SP.onePerChampion(list);

    // Blocks-based modes have their length dictated by the plan.
    let wanted = config.count;
    if (config.mode === 'class' || config.mode === 'custom') {
      wanted = (config.blocks || []).reduce(function (n, b) { return n + b[1]; }, 0);
    }
    if (!wanted) wanted = list.length;          // "endless" = the whole pool

    if (config.avoidRepeats) {
      const seen = {};
      readSeen().forEach(function (id) { seen[id] = 1; });
      const fresh = list.filter(function (r) { return !seen[r.id]; });
      const stale = list.filter(function (r) { return seen[r.id]; });
      list = (config.shuffle ? SP.shuffle(fresh) : fresh)
        .concat(config.shuffle ? SP.shuffle(stale) : stale);
    } else if (config.shuffle) {
      list = SP.shuffle(list);
    }

    if (list.length && wanted > list.length) {
      // Small pool, long session: cycle through it rather than stopping early.
      const grown = [];
      while (grown.length < wanted) grown.push(list[grown.length % list.length]);
      list = grown;
    }
    return list.slice(0, wanted);
  }

  /* ── Sound ───────────────────────────────────────────────────────── */

  /* Browsers refuse to start an AudioContext until the page has been
     interacted with. Creating one lazily inside the timer tick meant it was
     born suspended and stayed that way, so nothing ever played: currentTime
     does not advance while suspended, so notes were also being scheduled into
     the past. Instead the context is opened and unlocked from a real click
     (starting a session, or ticking the sound box) and beep() simply declines
     to schedule anything unless it is actually running. */
  function unlockAudio() {
    try {
      if (!audioCtx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return false;
        audioCtx = new Ctor();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      // A single silent sample is what satisfies the stricter policies.
      const buf = audioCtx.createBuffer(1, 1, 22050);
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(audioCtx.destination);
      src.start(0);
      return true;
    } catch (e) {
      return false;
    }
  }

  function audioReady() {
    return !!audioCtx && audioCtx.state === 'running';
  }

  function beep(freq, ms, when) {
    if (!opts.sound) return;
    if (!audioReady()) {
      // Nudge it, and let the next beep be the one that lands.
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      return;
    }
    try {
      const t0 = audioCtx.currentTime + (when || 0);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + ms / 1000 + 0.02);
    } catch (e) { /* audio is a nicety, never a blocker */ }
  }

  function chime() { beep(880, 180, 0); beep(1320, 260, 0.16); }

  /* ── Rendering ───────────────────────────────────────────────────── */

  function fmt(ms) {
    if (ms <= 0) return '0:00';
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      return h + ':' + String(m % 60).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    return m + ':' + String(s).padStart(2, '0');
  }

  function show(i) {
    if (i < 0 || i >= playlist.length) { finish(); return; }
    index = i;
    const rec = playlist[i];
    const player = document.getElementById('player');
    const img = document.getElementById('stage-img');
    const msg = document.getElementById('stage-msg');

    msg.hidden = true;
    if (opts.mirror) player.dataset.flip = Math.random() < 0.5 ? '1' : '0';

    SP.loadInto(img, rec, opts.framing, function (ok) {
      if (ok) { fitGrid(); return; }
      msg.hidden = false;
      msg.textContent = 'That image would not load. Skipping.';
      setTimeout(function () { if (index === i) next(); }, 900);
    });

    document.getElementById('np-skin').textContent = rec.name;
    document.getElementById('np-champ').textContent =
      rec.champ + (rec.lineNames.length ? ' · ' + rec.lineNames[0] : '');
    document.getElementById('np-progress').textContent =
      (i + 1) + ' / ' + playlist.length;

    duration = schedule[i] != null ? schedule[i] : (schedule[schedule.length - 1] || 0);
    remaining = duration;
    paused = false;
    setPauseIcon();
    tickUI();

    // Warm the next image so the transition is instant.
    if (playlist[i + 1]) SP.preload(playlist[i + 1], opts.framing);

    markSeen(rec.id);
  }

  let seenBuffer = [];
  function markSeen(id) {
    seenBuffer.push(id);
    if (seenBuffer.length > 12) flushSeen();
  }
  function flushSeen() {
    if (!seenBuffer.length) return;
    writeSeen(readSeen().concat(seenBuffer));
    seenBuffer = [];
  }

  function tickUI() {
    const bar = document.getElementById('timer-bar');
    const fill = document.getElementById('timer-fill');
    const clock = document.getElementById('np-clock');

    if (!duration) {
      bar.style.visibility = 'hidden';
      clock.textContent = '∞';
      clock.classList.remove('warn');
      return;
    }
    bar.style.visibility = '';
    const frac = Math.max(0, remaining / duration);
    fill.style.transform = 'scaleX(' + frac + ')';
    clock.textContent = fmt(remaining);

    const warn = remaining <= 5000;
    clock.classList.toggle('warn', warn);
    bar.classList.toggle('warn', warn);
    bar.classList.toggle('paused', paused);
  }

  /* Driven by setInterval against the wall clock rather than
     requestAnimationFrame: rAF stops whenever the browser decides not to
     paint, which would silently freeze a running timer, and measuring real
     elapsed time keeps the countdown honest regardless of tick jitter. */
  function loop() {
    if (!running) return;
    const now = Date.now();
    const dt = now - lastTick;
    lastTick = now;
    if (paused || !duration) return;

    const before = remaining;
    remaining -= dt;

    // Three soft ticks in the final countdown, then the chime on zero.
    if (opts.sound) {
      for (let s = 3; s >= 1; s--) {
        const mark = s * 1000;
        if (before > mark && remaining <= mark) beep(660, 70, 0);
      }
    }
    if (remaining <= 0) {
      remaining = 0;
      tickUI();
      chime();
      next();
      return;
    }
    tickUI();
  }

  function startClock() {
    clearInterval(clockId);
    lastTick = Date.now();
    clockId = setInterval(loop, 100);
  }

  /* ── Controls ────────────────────────────────────────────────────── */

  function next() { show(index + 1); }
  function prev() { if (index > 0) show(index - 1); }

  function togglePause() {
    if (!duration) return;
    paused = !paused;
    setPauseIcon();
    tickUI();
  }

  function setPauseIcon() {
    document.getElementById('ico-pause').hidden = paused || !duration;
    document.getElementById('ico-play').hidden = !(paused || !duration);
  }

  function addTime(sec) {
    if (!duration) return;
    duration += sec * 1000;
    remaining += sec * 1000;
    tickUI();
  }

  function toggleFlag(name) {
    const p = document.getElementById('player');
    const on = p.dataset[name] === '1';
    p.dataset[name] = on ? '0' : '1';
    if (name === 'grid') {
      document.getElementById('grid-overlay').hidden = on;
      fitGrid();
    }
    if (name === 'native') {
      // A display preference rather than a per-image study tool, so unlike
      // flip/grey/blur it carries over to the next session. Merged, not
      // replaced, so it does not clobber the dismissed-tip flag.
      const v = readView();
      v.native = on ? 0 : 1;
      writeView(v);
      fitGrid();
      syncHint();
    }
    syncToolButtons();
  }

  /* ── Display preference (upscale small crops, or show them 1:1) ──── */

  const VIEW_KEY = 'riotofaction.view.v1';

  function readView() {
    try { return JSON.parse(localStorage.getItem(VIEW_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }

  function writeView(v) {
    try { localStorage.setItem(VIEW_KEY, JSON.stringify(v)); }
    catch (e) { /* ignore */ }
  }

  /* The 1:1 toggle only means anything for the two crops Riot ships small. */
  /* Every framing is scaled to fit the screen now, so 1:1 means something on
     all of them. It matters most on the two small crops, which is where the
     tip points people to it. */
  function syncNativeButton() {
    const btn = document.querySelector('.tool[data-toggle="native"]');
    if (!btn) return;
    btn.disabled = false;
    btn.title = 'Show the image at its original size instead of scaling it to fit (S)';
    syncHint();
  }

  function isSmallCrop() {
    return opts.framing === 'tile' || opts.framing === 'portrait';
  }

  /* The tip only earns its place while it is actionable: a small crop that is
     currently being scaled up. Turning 1:1 on answers it, so it goes away. */
  function syncHint() {
    const hint = document.getElementById('stage-hint');
    if (!hint) return;
    const p = document.getElementById('player');
    const scaled = isSmallCrop() && p.dataset.native !== '1';
    hint.hidden = !scaled || !!readView().hintDismissed;
  }

  function dismissHint() {
    const v = readView();
    v.hintDismissed = 1;
    writeView(v);
    syncHint();
  }

  /* Park the grid exactly over the rendered image. */
  /* The <img> box can be bigger than the picture: object-fit: contain
     letterboxes it whenever the screen is a different shape from the art. So
     work out where the pixels actually land rather than trusting the box, or
     the grid would stretch across the empty bars. */
  function fitGrid() {
    const ov = document.getElementById('grid-overlay');
    if (ov.hidden) return;
    const img = document.getElementById('stage-img');
    const stage = document.getElementById('stage');
    const a = img.getBoundingClientRect();
    const b = stage.getBoundingClientRect();
    if (!a.width || !a.height || !img.naturalWidth) return;
    const scale = Math.min(a.width / img.naturalWidth, a.height / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ov.style.left = (a.left - b.left + (a.width - w) / 2) + 'px';
    ov.style.top = (a.top - b.top + (a.height - h) / 2) + 'px';
    ov.style.width = w + 'px';
    ov.style.height = h + 'px';
  }

  function syncToolButtons() {
    const p = document.getElementById('player');
    document.querySelectorAll('.tool[data-toggle]').forEach(function (b) {
      b.classList.toggle('on', p.dataset[b.dataset.toggle] === '1');
    });
  }

  /* ── UI auto-hide ────────────────────────────────────────────────── */

  function wakeUI() {
    const p = document.getElementById('player');
    if (uiPinned) return;
    p.classList.remove('ui-hidden');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (!uiPinned && running) p.classList.add('ui-hidden');
    }, 4000);
  }

  /* ── Lifecycle ───────────────────────────────────────────────────── */

  function start(pool, config) {
    opts = config;
    playlist = buildPlaylist(pool, config);
    if (!playlist.length) return false;

    schedule = expandSchedule(config, playlist.length);

    const p = document.getElementById('player');
    p.hidden = false;
    p.dataset.framing = config.framing;      // drives the size cap in the CSS
    p.dataset.flip = '0';
    p.dataset.gray = config.grayscale ? '1' : '0';
    p.dataset.blur = '0';
    p.dataset.grid = '0';
    p.dataset.dim = '0';
    p.dataset.native = readView().native ? '1' : '0';
    syncNativeButton();
    document.getElementById('grid-overlay').hidden = true;
    document.getElementById('summary').hidden = true;
    document.getElementById('help-sheet').hidden = true;
    document.body.classList.add('player-open');
    syncToolButtons();

    // start() runs inside the Start button's click handler, so this counts
    // as the user gesture that lets audio play.
    if (config.sound) {
      unlockAudio();
      // Resuming is async, so check once it has had a chance to settle.
      setTimeout(function () {
        if (running && opts.sound && !audioReady()) {
          flash('Sound is switched on but this browser is blocking it.');
        }
      }, 900);
    }

    running = true;
    uiPinned = false;
    index = -1;
    show(0);
    startClock();
    wakeUI();
    return true;
  }

  function finish() {
    running = false;
    clearInterval(clockId);
    flushSeen();

    // finish() is only reached by running off the end of the schedule, so
    // every image in the playlist was actually shown.
    const done = playlist.slice();
    const secs = schedule.slice(0, done.length).reduce(function (a, b) { return a + b; }, 0) / 1000;
    document.getElementById('summary-line').textContent =
      done.length + ' illustration' + (done.length === 1 ? '' : 's') +
      (secs ? ' · ' + Math.round(secs / 60) + ' minutes of drawing time' : '');

    const strip = document.getElementById('summary-strip');
    strip.innerHTML = '';
    done.slice(-24).forEach(function (rec) {
      const im = document.createElement('img');
      im.alt = rec.name;
      im.title = rec.name + ', ' + rec.champ;
      SP.loadInto(im, rec, 'tile');
      strip.appendChild(im);
    });

    document.getElementById('player').classList.remove('ui-hidden');
    document.getElementById('summary').hidden = false;
    chime();
  }

  function stop() {
    running = false;
    clearInterval(clockId);
    clearTimeout(idleTimer);
    flushSeen();
    document.getElementById('player').hidden = true;
    document.body.classList.remove('player-open');
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
  }

  let flashTimer = null;

  /* Say something when an action does not work. Silently doing nothing is
     indistinguishable from a broken button. */
  function flash(text, ms) {
    const msg = document.getElementById('stage-msg');
    if (!msg) return;
    msg.textContent = text;
    msg.hidden = false;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { msg.hidden = true; }, ms || 2800);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen()['catch'](function () {});
      return;
    }
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!req) {
      flash('This browser has no fullscreen API. Try F11.');
      return;
    }
    try {
      const p = req.call(el);
      if (p && p['catch']) {
        p['catch'](function () { flash('The browser blocked fullscreen. Try F11 instead.'); });
      }
    } catch (e) {
      flash('The browser blocked fullscreen. Try F11 instead.');
    }
  }

  /* ── Wiring ──────────────────────────────────────────────────────── */

  function init(onExit, onAgain, onSettings) {
    document.getElementById('btn-next').addEventListener('click', next);
    document.getElementById('btn-prev').addEventListener('click', prev);
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    document.getElementById('btn-more-time').addEventListener('click', function () { addTime(30); });
    document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
    document.getElementById('btn-exit').addEventListener('click', function () { stop(); onExit(); });
    document.getElementById('btn-again').addEventListener('click', function () { onAgain(); });
    document.getElementById('btn-back-setup').addEventListener('click', function () { stop(); onSettings(); });

    document.querySelectorAll('.tool[data-toggle]').forEach(function (b) {
      b.addEventListener('click', function () { toggleFlag(b.dataset.toggle); });
    });

    const hintClose = document.getElementById('stage-hint-close');
    if (hintClose) hintClose.addEventListener('click', dismissHint);

    const help = document.getElementById('help-sheet');
    document.getElementById('btn-help').addEventListener('click', function () { help.hidden = false; });
    document.getElementById('btn-help-close').addEventListener('click', function () { help.hidden = true; });

    window.addEventListener('resize', fitGrid);
    document.addEventListener('fullscreenchange', function () { setTimeout(fitGrid, 60); });

    /* fitGrid bails when the image has no layout yet (still decoding, tab not
       painted). Watching the element means it gets sized the moment it does,
       instead of staying stuck at whatever it was. */
    if (window.ResizeObserver) {
      new ResizeObserver(fitGrid).observe(document.getElementById('stage-img'));
    }

    const player = document.getElementById('player');
    player.addEventListener('mousemove', wakeUI);
    player.addEventListener('touchstart', wakeUI, { passive: true });
    document.getElementById('stage').addEventListener('click', function () { togglePause(); });

    /* Tabbing away pauses rather than burning through the schedule while
       nobody is drawing. Resume with Space, same as any other pause. */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && running && duration && !paused) {
        paused = true;
        setPauseIcon();
        tickUI();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (player.hidden) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      const summaryOpen = !document.getElementById('summary').hidden;
      if (e.key === 'Escape') { stop(); onExit(); return; }
      if (summaryOpen) return;

      switch (e.key) {
        case ' ': e.preventDefault(); togglePause(); break;
        case 'ArrowRight': case 'Enter': e.preventDefault(); next(); break;
        case 'ArrowLeft': e.preventDefault(); prev(); break;
        case 'f': case 'F': toggleFlag('flip'); break;
        case 'g': case 'G': toggleFlag('gray'); break;
        case 'b': case 'B': toggleFlag('blur'); break;
        case 'r': case 'R': toggleFlag('grid'); break;
        case 'd': case 'D': toggleFlag('dim'); break;
        case 's': case 'S': toggleFlag('native'); break;
        case 't': case 'T': addTime(30); break;
        case 'v': case 'V': toggleFullscreen(); break;
        case 'h': case 'H':
          uiPinned = !uiPinned;
          player.classList.toggle('ui-hidden', uiPinned);
          if (!uiPinned) wakeUI();
          break;
        case '?': help.hidden = !help.hidden; break;
        default: return;
      }
      wakeUI();
    });
  }

  return {
    init: init,
    start: start,
    testSound: function () {
      // Called from the sound checkbox, which is itself a user gesture.
      if (!unlockAudio()) return false;
      const wasOn = opts.sound;
      opts.sound = true;
      chime();
      opts.sound = wasOn;
      return true;
    },
    stop: stop,
    presets: CLASS_PRESETS,
    expandSchedule: expandSchedule,
    isRunning: function () { return running; }
  };
}());
