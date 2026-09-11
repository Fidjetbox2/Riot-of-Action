/* ═══ Filter sidebar ══════════════════════════════════════════════════
   Builds the facet UI once, then updates counts and checked state in
   place -- rebuilding would throw away scroll position and focus every
   time you tick a box.
   ═════════════════════════════════════════════════════════════════════ */

const Filters = (function () {
  'use strict';

  const STORE_KEY = 'riotofaction.filters.v1';
  const OPEN_KEY = 'riotofaction.facets.open.v1';

  let state = SP.blankFilters();
  let listeners = [];
  let facets = [];            // [{ id, rows: {value: {el, count}}, kind }]
  let openMap = {};

  /* Marquee skin lines, pinned above the alphabetical list so the ones people
     actually search for do not need scrolling past 200+ entries. Hand-picked:
     Riot publishes no popularity data of any kind, so there is nothing to rank
     these by. Any name not in the current dataset is skipped silently. */
  const POPULAR_LINES = [
    'K/DA', 'Star Guardian', 'PROJECT', 'Spirit Blossom', 'Coven', 'High Noon',
    'Arcana', 'Pool Party', 'Battle Academia', 'Elderwood', 'Empyrean',
    'HEARTSTEEL', 'Blood Moon', 'Anima Squad', 'Soul Fighter', 'Winterblessed',
    'Porcelain', 'Dark Star', 'Odyssey', 'Pulsefire', 'Arcane', 'Bewitching'
  ];

  /* ── Facet definitions ───────────────────────────────────────────── */

  const DEFS = [
    {
      id: 'gender', title: 'Gender', kind: 'multi', open: true,
      value: function (r) { return r.gender; },
      options: function () {
        return Object.keys(SP.labels.gender).map(function (v) {
          return { value: v, label: SP.labels.gender[v] };
        });
      }
    },
    {
      id: 'champions', title: 'Champion', kind: 'multi', open: true, search: 'Find a champion…',
      value: function (r) { return r.alias; },
      options: function () {
        return SP.champions.map(function (c) {
          return { value: c.alias, label: c.name, icon: c.icon, sub: c.title };
        });
      }
    },
    {
      id: 'species', title: 'Species / body type', kind: 'multi',
      value: function (r) { return r.species; },
      options: function () {
        return Object.keys(SP.labels.species).map(function (v) {
          return { value: v, label: SP.labels.species[v] };
        });
      }
    },
    {
      id: 'region', title: 'Region', kind: 'multi',
      value: function (r) { return r.region; },
      options: function () {
        return Object.keys(SP.labels.region).map(function (v) {
          return { value: v, label: SP.labels.region[v] };
        });
      }
    },
    {
      id: 'role', title: 'Class', kind: 'multi',
      value: function (r) { return r.roles; },
      options: function () {
        return Object.keys(SP.labels.role).map(function (v) {
          return { value: v, label: SP.labels.role[v] };
        });
      }
    },
    {
      id: 'lines', title: 'Skin line / theme', kind: 'multi', search: 'Find a theme…',
      value: function (r) { return r.lines.map(String); },
      options: function () {
        const out = [];
        const pinned = [];

        /* Riot splits long themes across sub-lines ("Star Guardian Season 3"),
           so one pinned row can stand for several ids and toggles them all. */
        POPULAR_LINES.forEach(function (name) {
          const ids = SP.lineList.filter(function (l) {
            return l.name === name ||
              l.name.indexOf(name + ' ') === 0 ||
              l.name.indexOf(name + ':') === 0;
          }).map(function (l) { return l.id; });
          if (ids.length) pinned.push({ label: name, values: ids, pinned: true });
        });

        if (pinned.length) {
          out.push({ heading: 'Popular' });
          pinned.forEach(function (p) { out.push(p); });
          out.push({ heading: 'All ' + SP.lineList.length + ' themes, A–Z' });
        }
        SP.lineList.forEach(function (l) {
          out.push({ value: l.id, label: l.name });
        });
        return out;
      }
    },
    {
      id: 'years', title: 'Release date', kind: 'multi',
      note: 'Worked out from Data Dragon patch history, so accurate to about six weeks.',
      segments: [
        {
          key: 'since', label: 'In the last…',
          opts: [['any', 'Any'], ['1', '1y'], ['2', '2y'], ['3', '3y'], ['5', '5y']]
        }
      ],
      value: function (r) { return SP.yearBucket(r); },
      options: function () {
        const seen = {};
        SP.records.forEach(function (r) {
          const b = SP.yearBucket(r);
          if (b) seen[b] = 1;
        });
        const years = Object.keys(seen).filter(function (y) { return y !== SP.FLOOR; })
          .sort().reverse();
        const out = years.map(function (y) { return { value: y, label: y }; });
        if (seen[SP.FLOOR]) {
          out.push({ value: SP.FLOOR, label: 'Before ' + (SP.dateFloor || 2015) });
        }
        return out;
      }
    },
    {
      id: 'rarity', title: 'Skin tier', kind: 'multi',
      value: function (r) { return r.rarity; },
      options: function () {
        return Object.keys(SP.labels.rarity).map(function (v) {
          return { value: v, label: SP.labels.rarity[v] };
        });
      }
    },
    {
      id: 'availability', title: 'Availability', kind: 'segments',
      segments: [
        { key: 'base', label: 'Base skins', opts: [['any', 'Any'], ['only', 'Only'], ['exclude', 'Hide']] },
        { key: 'legacy', label: 'Legacy (vaulted)', opts: [['any', 'Any'], ['only', 'Only'], ['exclude', 'Hide']] }
      ]
    }
  ];

  /* ── Build ───────────────────────────────────────────────────────── */

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function build() {
    const host = document.getElementById('facets');
    host.innerHTML = '';

    DEFS.forEach(function (def) {
      const wrap = el('div', 'facet');
      const open = openMap[def.id] != null ? openMap[def.id] : !!def.open;
      wrap.dataset.open = String(open);

      const head = el('button', 'facet-head');
      head.type = 'button';
      head.appendChild(el('span', null, def.title));
      const badge = el('span', 'count');
      badge.hidden = true;
      head.appendChild(badge);
      const caret = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      caret.setAttribute('viewBox', '0 0 24 24');
      caret.setAttribute('class', 'caret');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M6 9l6 6 6-6');
      caret.appendChild(path);
      head.appendChild(caret);
      head.addEventListener('click', function () {
        const now = wrap.dataset.open !== 'true';
        wrap.dataset.open = String(now);
        openMap[def.id] = now;
        save();
      });
      wrap.appendChild(head);

      const body = el('div', 'facet-body');
      const entry = { id: def.id, def: def, rows: {}, badge: badge };

      /* A facet may carry a row of single-choice segments, a checkbox list,
         or both -- "Release date" wants a last-N-years shortcut above the
         individual years. */
      if (def.segments) {
        entry.segs = {};
        def.segments.forEach(function (seg) {
          const label = el('div', 'hint', seg.label);
          label.style.margin = '8px 0 2px';
          body.appendChild(label);
          const row = el('div', 'seg');
          seg.opts.forEach(function (pair) {
            const b = el('button', null, pair[1]);
            b.type = 'button';
            b.dataset.key = seg.key;
            b.dataset.val = pair[0];
            b.addEventListener('click', function () {
              state[seg.key] = pair[0];
              emit();
            });
            row.appendChild(b);
          });
          body.appendChild(row);
          entry.segs[seg.key] = row;
        });
      }

      if (def.options) {
        if (def.search) {
          const sw = el('div', 'facet-search');
          const inp = document.createElement('input');
          inp.type = 'search';
          inp.placeholder = def.search;
          inp.autocomplete = 'off';
          inp.addEventListener('input', function () {
            const q = inp.value.trim().toLowerCase();
            /* Searching collapses the pinned section into the full list --
               otherwise a hit could appear twice, or the heading could sit
               above nothing. */
            entry.sections.forEach(function (s) { s.hidden = !!q; });
            entry.allRows.forEach(function (row) {
              const hay = row.dataset.hay || '';
              row.hidden = !!q && hay.indexOf(q) === -1;
            });
          });
          sw.appendChild(inp);
          body.appendChild(sw);
        }

        const list = el('div', def.search ? 'scroll-box' : null);
        entry.allRows = [];
        entry.sections = [];
        entry.groupRows = [];

        def.options().forEach(function (opt) {
          if (opt.heading) {
            const h = el('div', 'opt-heading', opt.heading);
            list.appendChild(h);
            entry.sections.push(h);
            return;
          }

          const row = el('label', 'opt');
          row.dataset.hay = (opt.label + ' ' + (opt.sub || '')).toLowerCase();
          if (opt.pinned) entry.sections.push(row);

          const values = opt.values || [opt.value];
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.value = values[0];
          cb.addEventListener('change', function () {
            const arr = state[def.id];
            values.forEach(function (v) {
              const i = arr.indexOf(v);
              if (cb.checked && i === -1) arr.push(v);
              else if (!cb.checked && i !== -1) arr.splice(i, 1);
            });
            emit();
          });
          row.appendChild(cb);

          if (opt.icon) {
            const im = document.createElement('img');
            im.loading = 'lazy';
            im.src = opt.icon;
            im.alt = '';
            row.appendChild(im);
          }

          row.appendChild(el('span', 'label', opt.label));
          row.appendChild(el('span', 'n', ''));
          list.appendChild(row);
          entry.allRows.push(row);

          if (opt.values) {
            // Stands for several ids; tracked separately so it can show a
            // half-selected state when only some of them are ticked.
            entry.groupRows.push({ row: row, values: opt.values });
          } else {
            // A pinned option also appears in the alphabetical list below, so a
            // value maps to one or more rows that all have to stay in sync.
            (entry.rows[opt.value] = entry.rows[opt.value] || []).push(row);
          }
        });
        body.appendChild(list);
      }

      if (def.note) {
        const note = el('p', 'facet-note', def.note);
        body.appendChild(note);
      }

      wrap.appendChild(body);
      host.appendChild(wrap);
      facets.push(entry);
    });
  }

  /* ── Sync UI to state ────────────────────────────────────────────── */

  function refresh() {
    facets.forEach(function (entry) {
      const def = entry.def;
      let active = 0;

      if (entry.segs) {
        def.segments.forEach(function (seg) {
          const row = entry.segs[seg.key];
          Array.prototype.forEach.call(row.children, function (b) {
            b.classList.toggle('on', state[seg.key] === b.dataset.val);
          });
          if (state[seg.key] !== 'any') active += 1;
        });
      }

      if (def.options) {
        const counts = SP.facetCounts(state, def.id, def.value);
        const selected = state[def.id];

        Object.keys(entry.rows).forEach(function (v) {
          const n = counts[v] || 0;
          const checked = selected.indexOf(v) !== -1;
          entry.rows[v].forEach(function (row) {
            row.querySelector('input').checked = checked;
            row.querySelector('.n').textContent = n ? n : '';
            row.classList.toggle('is-empty', n === 0 && !checked);
          });
        });
        (entry.groupRows || []).forEach(function (g) {
          const on = g.values.filter(function (v) { return selected.indexOf(v) !== -1; });
          const n = g.values.reduce(function (t, v) { return t + (counts[v] || 0); }, 0);
          const cb = g.row.querySelector('input');
          cb.checked = on.length === g.values.length;
          cb.indeterminate = on.length > 0 && on.length < g.values.length;
          g.row.querySelector('.n').textContent = n ? n : '';
          g.row.classList.toggle('is-empty', n === 0 && !on.length);
        });
        active += selected.length;
      }

      entry.badge.hidden = active === 0;
      entry.badge.textContent = active;
    });

    // A preset or a reset changes q without touching the box it came from.
    const box = document.getElementById('filter-search');
    if (box && box.value.trim() !== state.q) box.value = state.q;

    renderChips();
  }

  function labelFor(facetId, value) {
    switch (facetId) {
      case 'champions': return (SP.champByAlias[value] || {}).name || value;
      case 'lines': return SP.lines[value] || value;
      case 'gender': return SP.labels.gender[value];
      case 'species': return SP.labels.species[value];
      case 'region': return SP.labels.region[value];
      case 'role': return SP.labels.role[value];
      case 'rarity': return SP.labels.rarity[value];
      case 'years':
        return value === SP.FLOOR ? 'Before ' + (SP.dateFloor || 2015) : value;
      default: return value;
    }
  }

  function renderChips() {
    const host = document.getElementById('active-chips');
    host.innerHTML = '';
    const chips = [];

    ['gender', 'champions', 'species', 'region', 'role', 'lines', 'years', 'rarity']
      .forEach(function (id) {
        state[id].forEach(function (v) {
          chips.push({ text: labelFor(id, v), clear: function () {
            state[id].splice(state[id].indexOf(v), 1);
          } });
        });
      });
    if (state.since !== 'any') {
      chips.push({ text: 'Last ' + state.since + ' year' + (state.since === '1' ? '' : 's'),
        clear: function () { state.since = 'any'; } });
    }
    if (state.base !== 'any') {
      chips.push({ text: (state.base === 'only' ? 'Base skins only' : 'No base skins'),
        clear: function () { state.base = 'any'; } });
    }
    if (state.legacy !== 'any') {
      chips.push({ text: (state.legacy === 'only' ? 'Legacy only' : 'No legacy skins'),
        clear: function () { state.legacy = 'any'; } });
    }
    if (state.ids && state.ids.length) {
      chips.push({ text: 'Picked images · ' + state.ids.length,
        clear: function () { state.ids = []; } });
    }
    if (state.q) {
      chips.push({ text: '“' + state.q + '”', clear: function () {
        state.q = '';
        document.getElementById('filter-search').value = '';
      } });
    }

    host.hidden = chips.length === 0;
    chips.forEach(function (c) {
      const b = el('button', null, c.text);
      b.type = 'button';
      b.addEventListener('click', function () { c.clear(); emit(); });
      host.appendChild(b);
    });
  }

  /* ── Persistence ─────────────────────────────────────────────────── */

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      localStorage.setItem(OPEN_KEY, JSON.stringify(openMap));
    } catch (e) { /* private mode -- filters just won't persist */ }
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (s) {
        const blank = SP.blankFilters();
        Object.keys(blank).forEach(function (k) {
          if (s[k] !== undefined) blank[k] = s[k];
        });
        state = blank;
      }
      openMap = JSON.parse(localStorage.getItem(OPEN_KEY) || '{}') || {};
    } catch (e) { /* ignore */ }
  }

  function emit() {
    save();
    refresh();
    listeners.forEach(function (fn) { fn(state); });
  }

  /* ── Public ──────────────────────────────────────────────────────── */

  function init() {
    load();
    build();

    const search = document.getElementById('filter-search');
    search.value = state.q || '';
    let t = null;
    search.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { state.q = search.value.trim(); emit(); }, 160);
    });

    document.getElementById('btn-reset-filters').addEventListener('click', function () {
      state = SP.blankFilters();
      search.value = '';
      emit();
    });

    refresh();
  }

  return {
    init: init,
    get: function () { return state; },
    set: function (next) { state = next; emit(); },
    onChange: function (fn) { listeners.push(fn); },
    refresh: refresh
  };
}());
