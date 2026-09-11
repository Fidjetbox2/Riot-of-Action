/* ═══ Data layer ══════════════════════════════════════════════════════
   Flattens the generated dataset into one array of illustration records,
   builds CDN URLs, and answers filter queries.
   ═════════════════════════════════════════════════════════════════════ */

const SP = (function () {
  'use strict';

  const CD = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/';
  const DD = 'https://ddragon.leagueoflegends.com/cdn/';

  const raw = window.RIOT_OF_ACTION_DATA;
  if (!raw) return null;

  const labels = raw.labels;
  const lines = raw.lines;

  /* ── Flatten ─────────────────────────────────────────────────────── */

  const records = [];
  const champions = [];

  raw.champions.forEach(function (c) {
    champions.push({
      key: c.k, alias: c.a, name: c.n, title: c.ti,
      gender: c.g, species: c.sp, region: c.re, roles: c.c,
      icon: DD + raw.version + '/img/champion/' + c.a + '.png',
      skins: c.s.length
    });

    c.s.forEach(function (s) {
      const dir = s.d || c.a.toLowerCase();
      const folder = s.n === 0 ? 'base' : 'skin' + String(s.n).padStart(2, '0');
      const centered = s.cp ||
        'assets/characters/' + dir + '/skins/' + folder + '/images/' + dir + '_splash_centered_' + s.n + '.jpg';
      const load = ('lp' in s) ? s.lp :
        'assets/characters/' + dir + '/skins/' + folder + '/' + dir + 'loadscreen_' + s.n + '.jpg';
      const lineIds = s.l || [];

      const rec = {
        id: c.k + '_' + s.n,
        key: c.k,
        alias: c.a,
        champ: c.n,
        title: c.ti,
        num: s.n,
        name: s.t,
        base: s.r === 'base',
        rarity: s.r,
        legacy: !!s.lg,
        gender: c.g,
        species: c.sp,
        region: c.re,
        roles: c.c,
        lines: lineIds,
        lineNames: lineIds.map(function (id) { return lines[id]; }).filter(Boolean),
        dt: s.dt,
        _centered: centered,
        _load: load
      };
      rec.search = (rec.name + ' ' + rec.champ + ' ' + rec.title + ' ' +
        rec.lineNames.join(' ')).toLowerCase();
      records.push(rec);
    });
  });

  const champByAlias = {};
  champions.forEach(function (c) { champByAlias[c.alias] = c; });

  /* ── Image URLs ──────────────────────────────────────────────────── */

  /* Each framing returns a candidate list: the loader walks it on error, so a
     gap on one CDN (a handful of skins are missing from Data Dragon) falls
     through to the other rather than showing a broken image. */
  function sources(rec, framing) {
    const ddSplash = DD + 'img/champion/splash/' + rec.alias + '_' + rec.num + '.jpg';
    const ddLoad = DD + 'img/champion/loading/' + rec.alias + '_' + rec.num + '.jpg';
    const cdCentered = CD + rec._centered;
    const cdUncentered = CD + rec._centered.replace('_splash_centered_', '_splash_uncentered_');
    const cdTile = CD + rec._centered.replace('_splash_centered_', '_splash_tile_');
    const cdLoad = rec._load ? CD + rec._load : null;

    switch (framing) {
      case 'centered': return [cdCentered, ddSplash, cdUncentered];
      case 'portrait': return [ddLoad, cdLoad, cdCentered].filter(Boolean);
      case 'tile': return [cdTile, cdCentered, ddSplash];
      default: return [ddSplash, cdUncentered, cdCentered];
    }
  }

  const RATIO = { splash: '16 / 9', centered: '16 / 9', portrait: '77 / 140', tile: '1 / 1' };

  /* Drop-in <img> loader that walks the candidate list. */
  function loadInto(img, rec, framing, onDone) {
    const list = sources(rec, framing);
    let i = 0;
    img.classList.remove('loaded');
    img.onload = function () { img.classList.add('loaded'); if (onDone) onDone(true); };
    img.onerror = function () {
      i += 1;
      if (i < list.length) img.src = list[i];
      else if (onDone) onDone(false);
    };
    img.src = list[0];
    return img;
  }

  function preload(rec, framing) {
    const im = new Image();
    im.src = sources(rec, framing)[0];
    return im;
  }

  /* ── Filtering ───────────────────────────────────────────────────── */

  /* `ids` pins the result to hand-picked images (the playlist). It has no
     sidebar facet of its own; it only ever arrives through a collection. */
  const EMPTY = {
    q: '', champions: [], gender: [], species: [], region: [],
    role: [], rarity: [], lines: [], years: [], since: 'any',
    legacy: 'any', base: 'any', ids: []
  };

  /* Release dates are stored as year*100+month; 0 means "at or before the
     patch-history floor". See tools/fetch_dates.py for how they are derived. */
  const FLOOR = 'floor';

  function yearBucket(rec) {
    if (rec.dt === undefined) return null;
    return rec.dt === 0 ? FLOOR : String(Math.floor(rec.dt / 100));
  }

  function sinceThreshold(years) {
    const now = new Date();
    return (now.getFullYear() - years) * 100 + (now.getMonth() + 1);
  }

  function blankFilters() { return JSON.parse(JSON.stringify(EMPTY)); }

  function isActive(f) {
    return !!(f.q || f.champions.length || f.gender.length || f.species.length ||
      f.region.length || f.role.length || f.rarity.length || f.lines.length ||
      f.years.length || f.since !== 'any' || f.legacy !== 'any' || f.base !== 'any' ||
      (f.ids && f.ids.length));
  }

  /* `skip` lets a facet count its own options against everything *but* itself,
     which is what makes the per-option counts in the sidebar meaningful. */
  function matches(rec, f, skip) {
    if (skip !== 'q' && f.q) {
      const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
      for (let i = 0; i < terms.length; i++) {
        if (rec.search.indexOf(terms[i]) === -1) return false;
      }
    }
    if (skip !== 'ids' && f.ids && f.ids.length && f.ids.indexOf(rec.id) === -1) return false;
    if (skip !== 'champions' && f.champions.length && f.champions.indexOf(rec.alias) === -1) return false;
    if (skip !== 'gender' && f.gender.length && f.gender.indexOf(rec.gender) === -1) return false;
    if (skip !== 'species' && f.species.length && f.species.indexOf(rec.species) === -1) return false;
    if (skip !== 'region' && f.region.length && f.region.indexOf(rec.region) === -1) return false;
    if (skip !== 'rarity' && f.rarity.length && f.rarity.indexOf(rec.rarity) === -1) return false;

    if (skip !== 'role' && f.role.length) {
      let hit = false;
      for (let i = 0; i < rec.roles.length; i++) {
        if (f.role.indexOf(rec.roles[i]) !== -1) { hit = true; break; }
      }
      if (!hit) return false;
    }
    if (skip !== 'lines' && f.lines.length) {
      let hit = false;
      for (let i = 0; i < rec.lines.length; i++) {
        if (f.lines.indexOf(String(rec.lines[i])) !== -1) { hit = true; break; }
      }
      if (!hit) return false;
    }
    if (skip !== 'since' && f.since !== 'any') {
      // Undated and floor-bucket skins are older than any "last N years" window.
      if (!rec.dt) return false;
      if (rec.dt < sinceThreshold(parseInt(f.since, 10))) return false;
    }
    if (skip !== 'years' && f.years.length) {
      const b = yearBucket(rec);
      if (b === null || f.years.indexOf(b) === -1) return false;
    }
    if (skip !== 'legacy') {
      if (f.legacy === 'only' && !rec.legacy) return false;
      if (f.legacy === 'exclude' && rec.legacy) return false;
    }
    if (skip !== 'base') {
      if (f.base === 'only' && !rec.base) return false;
      if (f.base === 'exclude' && rec.base) return false;
    }
    return true;
  }

  function query(f, skip) {
    const out = [];
    for (let i = 0; i < records.length; i++) {
      if (matches(records[i], f, skip)) out.push(records[i]);
    }
    return out;
  }

  /* Counts for one facet's options, respecting every *other* active filter. */
  function facetCounts(f, facet, valueOf) {
    const counts = Object.create(null);
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      if (!matches(rec, f, facet)) continue;
      const v = valueOf(rec);
      if (Array.isArray(v)) {
        for (let j = 0; j < v.length; j++) counts[v[j]] = (counts[v[j]] || 0) + 1;
      } else if (v != null) {
        counts[v] = (counts[v] || 0) + 1;
      }
    }
    return counts;
  }

  /* ── Sorting / sampling ──────────────────────────────────────────── */

  const SORTS = {
    champion: function (a, b) { return a.champ.localeCompare(b.champ) || a.num - b.num; },
    skin: function (a, b) { return a.name.localeCompare(b.name); },
    newest: function (a, b) {
      return (b.dt || 0) - (a.dt || 0) || b.num - a.num || a.champ.localeCompare(b.champ);
    },
    line: function (a, b) {
      const al = a.lineNames[0] || '￿', bl = b.lineNames[0] || '￿';
      return al.localeCompare(bl) || a.champ.localeCompare(b.champ);
    },
    /* Nobody publishes pick rates or skin sales, so this is not popularity.
       It is skin count per champion -- Riot makes more skins for champions
       people play, which is a real signal, just an indirect one. */
    skinned: function (a, b) {
      const ac = (champByAlias[a.alias] || {}).skins || 0;
      const bc = (champByAlias[b.alias] || {}).skins || 0;
      return bc - ac || a.champ.localeCompare(b.champ) || a.num - b.num;
    }
  };

  function sortList(list, how) {
    if (how === 'random') return shuffle(list.slice());
    const fn = SORTS[how] || SORTS.champion;
    return list.slice().sort(fn);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* One skin per champion, chosen at random -- maximum variety per session. */
  function onePerChampion(list) {
    const buckets = Object.create(null);
    list.forEach(function (r) { (buckets[r.alias] = buckets[r.alias] || []).push(r); });
    return Object.keys(buckets).map(function (k) {
      const b = buckets[k];
      return b[Math.floor(Math.random() * b.length)];
    });
  }

  /* ── Skin line index (for the sidebar facet) ─────────────────────── */

  const lineList = Object.keys(lines).map(function (id) {
    return { id: id, name: lines[id] };
  }).sort(function (a, b) { return a.name.localeCompare(b.name); });

  return {
    version: raw.version,
    generated: raw.generated,
    labels: labels,
    lines: lines,
    lineList: lineList,
    records: records,
    champions: champions,
    champByAlias: champByAlias,
    sources: sources,
    loadInto: loadInto,
    preload: preload,
    ratio: function (framing) { return RATIO[framing] || RATIO.splash; },
    FLOOR: FLOOR,
    yearBucket: yearBucket,
    dateFloor: raw.dateFloor,
    blankFilters: blankFilters,
    isActive: isActive,
    query: query,
    matches: matches,
    facetCounts: facetCounts,
    sortList: sortList,
    shuffle: shuffle,
    onePerChampion: onePerChampion
  };
}());
