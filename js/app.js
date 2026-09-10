/* ═══ App ═════════════════════════════════════════════════════════════
   Routing, the practice-setup panel, and the wiring between the filter
   sidebar, the gallery and the session player.
   ═════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  if (!window.RIOT_OF_ACTION_DATA || typeof SP === 'undefined' || !SP) {
    const err = document.getElementById('boot-error');
    err.hidden = false;
    err.innerHTML = '<div><strong>The illustration index did not load.</strong><br>' +
      'Make sure <code>data/skins.js</code> sits next to <code>index.html</code>, ' +
      'then reload. To regenerate it: <code>python tools/fetch_raw.py &amp;&amp; ' +
      'python tools/build_data.py</code></div>';
    return;
  }

  const CONFIG_KEY = 'riotofaction.session.v1';
  const INTERVALS = [15, 30, 45, 60, 120, 300, 600, 900, 1800, 3600];
  const DEFAULT_FRAMING = 'splash';

  /* The gallery offers three crops; the session offers four. */
  const GALLERY_CROP = {
    splash: 'splash', centered: 'splash', portrait: 'portrait', tile: 'tile'
  };

  let config = {
    mode: 'fixed',
    interval: 30,
    preset: 'standard',
    blocks: [[30, 10], [60, 5]],
    count: 30,
    framing: 'splash',
    shuffle: true,
    avoidRepeats: true,
    sound: false,
    grayscale: false,
    mirror: false,
    onePerChampion: false
  };

  let pool = [];
  let galleryDirty = true;
  let view = 'practice';
  let activePreset = null;

  const $ = function (id) { return document.getElementById(id); };

  /* ── Config persistence ──────────────────────────────────────────── */

  function loadConfig() {
    try {
      const s = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
      if (s) Object.keys(config).forEach(function (k) {
        if (s[k] !== undefined) config[k] = s[k];
      });
    } catch (e) { /* defaults are fine */ }
  }

  function saveConfig() {
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); }
    catch (e) { /* ignore */ }
  }

  /* ── Setup panel ─────────────────────────────────────────────────── */

  function fmtSeconds(s) {
    if (s < 60) return s + 's';
    if (s % 3600 === 0) return (s / 3600) + 'h';
    if (s % 60 === 0) return (s / 60) + 'm';
    return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  }

  function buildIntervalChips() {
    const host = $('interval-chips');
    host.innerHTML = '';
    INTERVALS.forEach(function (s) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = fmtSeconds(s);
      b.dataset.sec = s;
      b.addEventListener('click', function () {
        config.interval = s;
        $('interval-custom').value = '';
        syncSetup();
      });
      host.appendChild(b);
    });
  }

  function buildPresets() {
    const host = $('class-presets');
    host.innerHTML = '';
    Session.presets.forEach(function (p) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset';
      b.dataset.id = p.id;
      const strong = document.createElement('strong');
      strong.textContent = p.name;
      const span = document.createElement('span');
      const total = p.blocks.reduce(function (n, blk) { return n + blk[0] * blk[1]; }, 0);
      const imgs = p.blocks.reduce(function (n, blk) { return n + blk[1]; }, 0);
      span.textContent = p.note + ' · ' + imgs + ' images, ' + Math.round(total / 60) + ' min';
      b.appendChild(strong);
      b.appendChild(span);
      b.addEventListener('click', function () {
        config.preset = p.id;
        config.blocks = p.blocks.map(function (x) { return x.slice(); });
        syncSetup();
      });
      host.appendChild(b);
    });
  }

  const QUICK_DURATIONS = [15, 30, 60, 120, 300, 600, 1800];

  function buildQuickAdd() {
    const host = $('custom-quick');
    host.innerHTML = '';
    QUICK_DURATIONS.forEach(function (sec) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = '+ ' + fmtSeconds(sec);
      b.title = 'Add a block of ' + fmtSeconds(sec) + ' images';
      b.addEventListener('click', function () {
        const last = config.blocks[config.blocks.length - 1];
        // Tapping the same length again just grows that block instead of
        // stacking identical rows.
        if (last && last[0] === sec) last[1] += 1;
        else config.blocks.push([sec, 5]);
        config.mode = 'custom';
        syncSetup();
      });
      host.appendChild(b);
    });
  }

  function buildCustomBlocks() {
    const host = $('custom-blocks');
    host.innerHTML = '';

    if (!config.blocks.length) {
      host.appendChild(el('p', 'hint', 'No blocks yet. Add one below.'));
      return;
    }

    config.blocks.forEach(function (blk, i) {
      const row = document.createElement('div');
      row.className = 'block';

      const n = document.createElement('input');
      n.type = 'number'; n.min = '1'; n.max = '200'; n.value = blk[1];
      n.setAttribute('aria-label', 'Images in block ' + (i + 1));
      n.addEventListener('change', function () {
        config.blocks[i][1] = Math.max(1, Math.min(200, parseInt(n.value, 10) || 1));
        syncSetup();
      });

      const times = el('span', null, 'images ×');

      const sec = document.createElement('select');
      sec.setAttribute('aria-label', 'Seconds per image in block ' + (i + 1));
      const choices = QUICK_DURATIONS.slice();
      [45, 180, 900, 1500, 2700, 3600].forEach(function (s) { choices.push(s); });
      if (choices.indexOf(blk[0]) === -1) choices.push(blk[0]);
      choices.sort(function (a, b) { return a - b; });
      choices.forEach(function (s) {
        const o = document.createElement('option');
        o.value = s;
        o.textContent = fmtSeconds(s);
        if (s === blk[0]) o.selected = true;
        sec.appendChild(o);
      });
      sec.addEventListener('change', function () {
        config.blocks[i][0] = parseInt(sec.value, 10);
        syncSetup();
      });

      const each = el('span', null, 'each');

      const dup = document.createElement('button');
      dup.type = 'button';
      dup.className = 'icon-btn';
      dup.title = 'Duplicate this block';
      dup.setAttribute('aria-label', 'Duplicate block ' + (i + 1));
      dup.innerHTML = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/>' +
        '<path d="M5 15V5a2 2 0 012-2h10"/></svg>';
      dup.addEventListener('click', function () {
        config.blocks.splice(i + 1, 0, blk.slice());
        syncSetup();
      });

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'icon-btn';
      del.title = 'Remove this block';
      del.setAttribute('aria-label', 'Remove block ' + (i + 1));
      del.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      del.addEventListener('click', function () {
        config.blocks.splice(i, 1);
        syncSetup();
      });

      row.appendChild(n);
      row.appendChild(times);
      row.appendChild(sec);
      row.appendChild(each);
      row.appendChild(dup);
      row.appendChild(del);
      host.appendChild(row);
    });
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ── Collections ─────────────────────────────────────────────────── */

  function buildCollections() {
    const host = $('collections');
    host.innerHTML = '';

    Presets.all().forEach(function (p) {
      const count = Presets.countFor(p);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'collection';
      card.dataset.id = p.id;
      card.title = p.blurb;

      const art = document.createElement('div');
      art.className = 'collection-art';
      const rec = Presets.thumbFor(p);
      if (rec) {
        const im = document.createElement('img');
        im.alt = '';
        im.loading = 'lazy';
        SP.loadInto(im, rec, 'splash');
        art.appendChild(im);
      }

      const badge = document.createElement('span');
      badge.className = 'collection-count';
      badge.textContent = count.toLocaleString();

      const body = document.createElement('div');
      body.className = 'collection-body';
      const name = document.createElement('span');
      name.className = 'collection-name';
      name.textContent = p.name;
      const blurb = document.createElement('span');
      blurb.className = 'collection-blurb';
      blurb.textContent = p.blurb;
      body.appendChild(name);
      body.appendChild(blurb);

      card.appendChild(art);
      card.appendChild(badge);
      card.appendChild(body);

      if (p.custom) {
        card.classList.add('is-custom');
        const edit = document.createElement('span');
        edit.className = 'collection-edit';
        edit.setAttribute('role', 'button');
        edit.tabIndex = 0;
        edit.title = 'Edit “' + p.name + '”';
        edit.setAttribute('aria-label', 'Edit ' + p.name);
        edit.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';
        const openEdit = function (e) {
          e.stopPropagation();          // don't apply the collection as well
          openModal(p);
        };
        edit.addEventListener('click', openEdit);
        edit.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') openEdit(e);
        });
        card.appendChild(edit);
      }

      card.addEventListener('click', function () { applyPreset(p); });
      host.appendChild(card);
    });

    host.appendChild(makeSaveCard());
  }

  /* The trailing "save what I have now" card. */
  function makeSaveCard() {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'collection collection-new';
    card.id = 'collection-save';

    const body = document.createElement('div');
    body.className = 'collection-body';
    const plus = document.createElement('span');
    plus.className = 'collection-plus';
    plus.textContent = '+';
    const name = document.createElement('span');
    name.className = 'collection-name';
    name.textContent = 'Save current filters';
    const blurb = document.createElement('span');
    blurb.className = 'collection-blurb';
    blurb.textContent = 'Keep this set-up as your own collection.';

    body.appendChild(plus);
    body.appendChild(name);
    body.appendChild(blurb);
    card.appendChild(body);
    card.addEventListener('click', function () { openModal(null); });
    return card;
  }

  /* ── Save / edit dialog ──────────────────────────────────────────── */

  let editing = null;             // the collection being edited, or null to add

  function describeFilters(f) {
    const bits = [];
    const groups = [
      ['champions', 'champion'], ['gender', 'gender'], ['species', 'species'],
      ['region', 'region'], ['role', 'class'], ['lines', 'theme'],
      ['years', 'year'], ['rarity', 'tier']
    ];
    groups.forEach(function (g) {
      const n = f[g[0]].length;
      if (n) bits.push(n + ' ' + g[1] + (n === 1 ? '' : 's'));
    });
    if (f.since !== 'any') bits.push('last ' + f.since + 'y');
    if (f.base !== 'any') bits.push(f.base === 'only' ? 'base only' : 'no base');
    if (f.legacy !== 'any') bits.push(f.legacy === 'only' ? 'legacy only' : 'no legacy');
    if (f.q) bits.push('search “' + f.q + '”');
    return bits.length ? bits.join(', ') : 'no filters';
  }

  function openModal(preset) {
    editing = preset;
    const isEdit = !!preset;
    const f = Filters.get();

    $('cm-title').textContent = isEdit ? 'Edit collection' : 'Save collection';
    $('cm-name').value = isEdit ? preset.name : '';
    $('cm-blurb').value = isEdit ? (preset.blurb || '') : '';
    $('cm-delete').hidden = !isEdit;
    $('cm-replace-wrap').hidden = !isEdit;
    $('cm-replace').checked = false;
    $('cm-error').hidden = true;

    $('cm-summary').textContent = isEdit
      ? 'Saved with: ' + describeFilters(Presets.filtersFor(preset)) + '.'
      : 'Saves ' + describeFilters(f) + '. ' + pool.length.toLocaleString() +
        ' illustrations, ' + framingLabel(config.framing) + '.';

    $('collection-modal').hidden = false;
    $('cm-name').focus();
    $('cm-name').select();
  }

  function closeModal() {
    $('collection-modal').hidden = true;
    editing = null;
  }

  function framingLabel(v) {
    const opt = $('opt-framing').querySelector('option[value="' + v + '"]');
    return opt ? opt.textContent.toLowerCase() : v;
  }

  function saveModal() {
    const name = $('cm-name').value.trim();
    if (!name) {
      $('cm-error').textContent = 'Give it a name first.';
      $('cm-error').hidden = false;
      $('cm-name').focus();
      return;
    }
    const blurb = $('cm-blurb').value.trim();
    let result;

    if (editing) {
      const patch = { name: name, blurb: blurb };
      if ($('cm-replace').checked) {
        patch.filters = Filters.get();
        patch.framing = config.framing;
      }
      result = Presets.updateCustom(editing.id, patch);
    } else {
      result = Presets.addCustom({
        name: name,
        blurb: blurb,
        filters: Filters.get(),
        framing: config.framing
      });
    }

    if (!result) {
      $('cm-error').textContent =
        'Could not save. Browser storage is full or blocked in this window.';
      $('cm-error').hidden = false;
      return;
    }
    closeModal();
    buildCollections();
    syncActivePreset();
  }

  function deleteFromModal() {
    if (!editing) return;
    Presets.removeCustom(editing.id);
    if (activePreset === editing.id) activePreset = null;
    closeModal();
    buildCollections();
    syncActivePreset();
  }

  /* Applying a collection is absolute, not a patch: a collection that does not
     name a framing resets it to the default. Otherwise clicking Faces once
     would leave every collection you opened afterwards in portrait crops. */
  function applyPreset(p) {
    // Clicking the collection you are already in clears it, so a mis-click is
    // one click to undo rather than a trip to "Reset all".
    const clearing = activePreset === p.id;

    activePreset = clearing ? null : p.id;
    config.framing = clearing ? DEFAULT_FRAMING : (p.framing || DEFAULT_FRAMING);
    saveConfig();
    $('gallery-crop').value = GALLERY_CROP[config.framing] || 'splash';
    Filters.set(clearing ? SP.blankFilters() : Presets.filtersFor(p));
    $('main').scrollTop = 0;
  }

  function markActivePreset() {
    document.querySelectorAll('.collection').forEach(function (c) {
      c.classList.toggle('on', c.dataset.id === activePreset);
    });
  }

  function estimate() {
    // "Endless" walks the whole filtered pool, so that is the honest length.
    const planned = config.mode === 'class' || config.mode === 'custom';
    const wanted = planned
      ? config.blocks.reduce(function (n, b) { return n + b[1]; }, 0)
      : (config.count || poolSize());
    const sched = Session.expandSchedule(config, wanted);
    const ms = sched.reduce(function (a, b) { return a + b; }, 0);
    return {
      images: sched.length,
      minutes: Math.round(ms / 60000),
      endless: !planned && !config.count
    };
  }

  function poolSize() {
    return config.onePerChampion
      ? new Set(pool.map(function (r) { return r.alias; })).size
      : pool.length;
  }

  function syncSetup() {
    // Mode tabs
    document.querySelectorAll('#mode-tabs button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.mode === config.mode);
    });
    ['fixed', 'class', 'custom', 'none'].forEach(function (m) {
      $('panel-' + m).hidden = config.mode !== m;
    });

    // Interval chips
    document.querySelectorAll('#interval-chips button').forEach(function (b) {
      b.classList.toggle('on', parseInt(b.dataset.sec, 10) === config.interval);
    });
    document.querySelectorAll('#class-presets .preset').forEach(function (b) {
      b.classList.toggle('on', b.dataset.id === config.preset);
    });

    if (config.mode === 'custom') {
      buildCustomBlocks();
      const imgs = config.blocks.reduce(function (n, b) { return n + b[1]; }, 0);
      const secs = config.blocks.reduce(function (n, b) { return n + b[0] * b[1]; }, 0);
      $('custom-total').textContent = imgs
        ? imgs + ' image' + (imgs === 1 ? '' : 's') + ' · ' +
          (secs >= 60 ? Math.round(secs / 60) + ' min' : secs + 's') + ' total'
        : '';
    }

    // Options. Class and Custom get their length from the plan itself, so the
    // count picker would be a lie in those modes.
    const planned = config.mode === 'class' || config.mode === 'custom';
    const countField = $('opt-count');
    countField.disabled = planned;
    countField.closest('.field').classList.toggle('is-disabled', planned);
    countField.previousElementSibling.textContent = planned
      ? 'How many images (set by the plan)'
      : 'How many images';
    countField.value = String(config.count);
    $('opt-framing').value = config.framing;
    $('opt-shuffle').checked = config.shuffle;
    $('opt-norepeat').checked = config.avoidRepeats;
    $('opt-sound').checked = config.sound;
    $('opt-gray').checked = config.grayscale;
    $('opt-mirror').checked = config.mirror;
    $('opt-onechamp').checked = config.onePerChampion;

    // Pool summary
    const est = estimate();
    $('pool-count').textContent = poolSize().toLocaleString();

    let sub;
    if (!pool.length) {
      sub = 'Loosen a filter to get started.';
    } else if (!est.images) {
      // An empty Custom plan would otherwise fall through to "everything,
      // untimed" without ever saying so.
      sub = 'Add at least one block to your plan.';
    } else if (config.mode === 'none') {
      sub = est.images.toLocaleString() + ' will be shown, untimed';
    } else if (est.endless) {
      sub = 'Endless: every match in turn, ' + fmtSeconds(config.interval) + ' each';
    } else {
      sub = est.images + ' images · about ' + est.minutes +
        ' minute' + (est.minutes === 1 ? '' : 's');
    }
    $('pool-sub').textContent = sub;

    $('btn-start').disabled = pool.length === 0 || est.images === 0;
    $('match-count').textContent = pool.length.toLocaleString() + ' images';

    saveConfig();
  }

  let previewToken = 0;
  function renderPreview() {
    const host = $('pool-preview');
    host.innerHTML = '';
    if (!pool.length) return;
    const token = ++previewToken;
    const picks = SP.shuffle(pool.slice(0, 400)).slice(0, 5);
    picks.forEach(function (rec) {
      const im = document.createElement('img');
      im.alt = rec.name;
      im.title = rec.name + ', ' + rec.champ;
      SP.loadInto(im, rec, 'tile');
      if (token === previewToken) host.appendChild(im);
    });
  }

  /* ── Views ───────────────────────────────────────────────────────── */

  function renderGallery() {
    Gallery.render(pool, $('gallery-sort').value, $('gallery-crop').value, $('gallery-size').value);
    galleryDirty = false;
  }

  function setView(next) {
    view = (next === 'gallery') ? 'gallery' : 'practice';
    $('view-practice').hidden = view !== 'practice';
    $('view-gallery').hidden = view !== 'gallery';
    document.querySelectorAll('#nav-tabs a').forEach(function (a) {
      a.classList.toggle('on', a.dataset.view === view);
    });
    $('main').scrollTop = 0;
    if (view === 'gallery' && galleryDirty) renderGallery();
    if (view === 'practice') renderPreview();
    document.body.classList.remove('filters-open');
  }

  function routeFromHash() {
    const h = (location.hash || '').replace(/^#\/?/, '');
    setView(h === 'gallery' ? 'gallery' : 'practice');
  }

  /* ── Filters → pool ──────────────────────────────────────────────── */

  function recompute() {
    const q = Filters.get().q;
    const gs = $('gallery-search');
    if (gs && gs.value.trim() !== q) gs.value = q;

    pool = SP.query(Filters.get());
    galleryDirty = true;
    syncActivePreset();
    syncSetup();
    if (view === 'gallery') renderGallery();
    else renderPreview();
  }

  /* Light up a collection only while filters *and* crop still match it, so
     editing either one quietly drops the highlight. Framing is part of the
     comparison because that is a collection's whole content for Faces, which
     sets no filters at all. */
  function syncActivePreset() {
    const current = JSON.stringify(Filters.get());
    const framing = config.framing;
    activePreset = null;

    const all = Presets.all();
    for (let i = 0; i < all.length; i++) {
      const p = all[i];
      const f = Presets.filtersFor(p);
      if (!SP.isActive(f) && !p.framing) continue;   // nothing to distinguish it
      if ((p.framing || DEFAULT_FRAMING) !== framing) continue;
      if (JSON.stringify(f) === current) { activePreset = p.id; break; }
    }
    markActivePreset();
  }

  /* ── Start ───────────────────────────────────────────────────────── */

  function startSession() {
    if (!pool.length || !estimate().images) return;
    const ok = Session.start(pool, config);
    if (!ok) return;
    document.body.classList.remove('filters-open');
  }

  /* ── Boot ────────────────────────────────────────────────────────── */

  function init() {
    loadConfig();
    Filters.init();
    Filters.onChange(recompute);
    Gallery.initLightbox();

    Session.init(
      function onExit() { /* player closed; nothing else to do */ },
      function onAgain() { Session.stop(); startSession(); },
      function onSettings() { setView('practice'); location.hash = '#/practice'; }
    );

    buildIntervalChips();
    buildPresets();
    buildCollections();
    Presets.validate();

    document.querySelectorAll('#mode-tabs button').forEach(function (b) {
      b.addEventListener('click', function () { config.mode = b.dataset.mode; syncSetup(); });
    });

    $('interval-custom').addEventListener('change', function () {
      const v = parseInt(this.value, 10);
      if (v >= 5) { config.interval = v; syncSetup(); }
    });

    buildQuickAdd();

    $('btn-copy-class').addEventListener('click', function () {
      const preset = Session.presets.filter(function (p) {
        return p.id === config.preset;
      })[0] || Session.presets[0];
      config.blocks = preset.blocks.map(function (b) { return b.slice(); });
      config.mode = 'custom';
      syncSetup();
    });

    let gt = null;
    $('gallery-search').addEventListener('input', function () {
      const v = this.value;
      clearTimeout(gt);
      gt = setTimeout(function () {
        const f = Filters.get();
        if (f.q === v.trim()) return;
        f.q = v.trim();
        Filters.set(f);
      }, 180);
    });

    const optionMap = {
      'opt-count': function (el) { config.count = parseInt(el.value, 10); },
      'opt-framing': function (el) { config.framing = el.value; },
      'opt-shuffle': function (el) { config.shuffle = el.checked; },
      'opt-norepeat': function (el) { config.avoidRepeats = el.checked; },
      'opt-sound': function (el) {
        config.sound = el.checked;
        const note = $('sound-note') || { classList: { toggle: function () {} } };
        if (!el.checked) { note.textContent = ''; return; }
        // This handler runs inside the click, which is what lets audio start.
        const ok = Session.testSound();
        note.textContent = ok ? 'played a test chime' : 'audio blocked by this browser';
        note.classList.toggle('is-warn', !ok);
      },
      'opt-gray': function (el) { config.grayscale = el.checked; },
      'opt-mirror': function (el) { config.mirror = el.checked; },
      'opt-onechamp': function (el) { config.onePerChampion = el.checked; }
    };
    Object.keys(optionMap).forEach(function (id) {
      $(id).addEventListener('change', function () {
        optionMap[id](this);
        // Framing is part of a collection's identity, so changing it by hand
        // has to re-check the highlight the way a filter edit does.
        if (id === 'opt-framing') syncActivePreset();
        syncSetup();
      });
    });

    $('btn-start').addEventListener('click', startSession);
    $('btn-practice-these').addEventListener('click', startSession);

    ['gallery-sort', 'gallery-crop', 'gallery-size'].forEach(function (id) {
      $(id).addEventListener('change', renderGallery);
    });

    $('cm-save').addEventListener('click', saveModal);
    $('cm-cancel').addEventListener('click', closeModal);
    $('cm-delete').addEventListener('click', deleteFromModal);
    $('collection-modal').addEventListener('click', function (e) {
      if (e.target.id === 'collection-modal') closeModal();
    });
    $('collection-modal').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); saveModal(); }
      if (e.key === 'Escape') { e.stopPropagation(); closeModal(); }
    });

    $('btn-open-filters').addEventListener('click', function () {
      document.body.classList.add('filters-open');
    });
    $('btn-close-filters').addEventListener('click', function () {
      document.body.classList.remove('filters-open');
    });

    document.querySelectorAll('#nav-tabs a').forEach(function (a) {
      a.addEventListener('click', function () { setTimeout(routeFromHash, 0); });
    });
    window.addEventListener('hashchange', routeFromHash);

    // Global shortcuts that only apply outside the player
    document.addEventListener('keydown', function (e) {
      if (!$('player').hidden || Gallery.isLightboxOpen()) return;
      if (!$('collection-modal').hidden) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === '/') { e.preventDefault(); $('filter-search').focus(); }
      if (e.key === 'Enter' && view === 'practice') startSession();
    });

    $('data-stamp').textContent =
      SP.records.length.toLocaleString() + ' illustrations · ' +
      SP.champions.length + ' champions · patch ' + SP.version +
      ' · indexed ' + SP.generated;

    recompute();
    routeFromHash();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
