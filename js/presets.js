/* ═══ Collections ═════════════════════════════════════════════════════
   Curated starting points. Each one is just a filter state, so anything a
   collection sets can be loosened or added to afterwards in the sidebar.

   Skin lines are named rather than referenced by id: ids churn between
   patches, and Riot splits long-running themes ("Star Guardian Season 3").
   A pattern matches a line called exactly that, or one that continues with a
   space or colon ("Lunar Revel: Firecracker"), so "Coven" does not drag in
   "Broken Covenant".
   ═════════════════════════════════════════════════════════════════════ */

const Presets = (function () {
  'use strict';

  const LIST = [
    {
      id: 'femmes',
      name: 'Femmes Fatales',
      blurb: 'Well-known female champions.',
      thumb: 'MissFortune',
      filters: {
        champions: ['MissFortune', 'Evelynn', 'Ahri', 'Katarina', 'Akali', 'Jinx',
          'Kaisa', 'Lux', 'Morgana', 'Syndra', 'Camille', 'Samira', 'Seraphine',
          'Sona', 'Irelia', 'Sivir', 'Vayne', 'Leona', 'Diana', 'Riven', 'Caitlyn',
          'Nidalee', 'Qiyana', 'Xayah', 'Senna', 'Ashe', 'Leblanc', 'Zeri', 'Nilah',
          'Elise', 'Cassiopeia', 'Kayle', 'Gwen', 'Briar']
      }
    },
    {
      id: 'monsters',
      name: 'Monsters Inc',
      blurb: 'Non-human champions only.',
      thumb: 'Chogath',
      filters: {
        champions: ['Chogath', 'Khazix', 'KogMaw', 'RekSai', 'Velkoz', 'Belveth',
          'Nocturne', 'Fiddlesticks', 'Rammus', 'Malphite', 'Zac', 'Skarner',
          'Warwick', 'Renekton', 'Nasus', 'Alistar', 'Volibear', 'Ornn',
          'AurelionSol', 'Shyvana', 'Smolder', 'Twitch', 'Rengar', 'Trundle',
          'Maokai', 'TahmKench', 'Anivia', 'Naafiri', 'Hecarim', 'Aatrox',
          'Cassiopeia', 'Elise', 'Urgot', 'Malzahar', 'Xerath']
      }
    },
    {
      id: 'muscle',
      name: 'Muscle & Bone',
      blurb: 'Large, heavy-set champions.',
      thumb: 'Darius',
      filters: {
        champions: ['Darius', 'Garen', 'Sett', 'Braum', 'Volibear', 'Aatrox',
          'Renekton', 'Mordekaiser', 'Jax', 'Pantheon', 'Olaf', 'Tryndamere',
          'Udyr', 'MonkeyKing', 'LeeSin', 'KSante', 'DrMundo', 'Gragas', 'Sion',
          'Nasus', 'Illaoi', 'Sejuani', 'Vi', 'XinZhao', 'JarvanIV']
      }
    },
    {
      id: 'armour',
      name: 'Plate & Pauldron',
      blurb: 'Champions in heavy armour.',
      thumb: 'Leona',
      filters: {
        champions: ['Garen', 'JarvanIV', 'XinZhao', 'Fiora', 'Kayle', 'Leona',
          'Pantheon', 'Mordekaiser', 'Sion', 'Darius', 'Aatrox', 'Hecarim',
          'Thresh', 'Braum', 'Ornn', 'KSante', 'Rell', 'Galio', 'Poppy', 'Viego',
          'Yorick', 'Swain', 'Diana', 'Camille']
      }
    },
    {
      id: 'drapery',
      name: 'Silk & Drapery',
      blurb: 'Loose cloth, robes and long hair.',
      thumb: 'Karma',
      filters: {
        champions: ['Karma', 'Syndra', 'Soraka', 'Janna', 'Yasuo', 'Yone', 'Zed',
          'Ahri', 'Irelia', 'Lux', 'Morgana', 'Ivern', 'Kindred', 'Sona',
          'Seraphine', 'Nami', 'Zoe', 'Lillia', 'Hwei', 'Yunara', 'Ryze',
          'Zilean', 'Xerath', 'Azir', 'Kayle']
      }
    },
    {
      id: 'magical',
      name: 'Magical Girls',
      blurb: 'Star Guardian and Bewitching skins.',
      thumb: 'Lux',
      filters: { linePatterns: ['Star Guardian', 'Bewitching'] }
    },
    {
      id: 'neon',
      name: 'Neon & Chrome',
      blurb: 'Sci-fi skins: PROJECT, Pulsefire, Empyrean.',
      thumb: 'Jhin',
      filters: { linePatterns: ['PROJECT', 'Pulsefire', 'Empyrean', 'Program', 'Cyber Pop'] }
    },
    {
      id: 'blossom',
      name: 'Ink & Blossom',
      blurb: 'Spirit Blossom, Blood Moon and Lunar Revel skins.',
      thumb: 'Yone',
      filters: {
        linePatterns: ['Spirit Blossom', 'Blood Moon', 'Porcelain', 'Lunar Revel',
          'Lunar Beast', 'Immortal Journey']
      }
    },
    {
      id: 'beach',
      name: 'Beach Day',
      blurb: 'Pool Party and Ocean Song skins.',
      thumb: 'Nidalee',
      filters: { linePatterns: ['Pool Party', 'Ocean Song'] }
    },
    {
      id: 'void',
      name: 'Void Horrors',
      blurb: 'Void champions.',
      thumb: 'Belveth',
      filters: { species: ['void'] }
    },
    {
      id: 'yordles',
      name: 'Small & Furry',
      blurb: 'Yordles. Small characters, different proportions.',
      thumb: 'Teemo',
      filters: { species: ['yordle'] }
    },
    {
      id: 'finest',
      name: 'The Finest',
      blurb: 'Legendary tier and above.',
      thumb: 'Ahri',
      filters: { rarity: ['legendary', 'ultimate', 'mythic', 'exalted', 'transcendent'] }
    },
    {
      id: 'classics',
      name: 'Old Masters',
      blurb: 'Base skins only, no alternate skins.',
      thumb: 'Ashe',
      filters: { base: 'only' }
    },
    {
      id: 'faces',
      name: 'Faces (somewhat)',
      blurb: 'Square crops, framed close on the character.',
      thumb: 'Katarina',
      framing: 'tile',
      filters: {}
    }
  ];

  /* ── Saved collections ───────────────────────────────────────────────
     Whatever is in the sidebar can be saved under a name and reused. These
     live in localStorage, so they are per-browser and never leave the
     machine, same as every other preference here.
     ─────────────────────────────────────────────────────────────────── */

  const CUSTOM_KEY = 'riotofaction.collections.v1';

  function readCustom() {
    let raw;
    try {
      raw = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
    } catch (e) {
      return [];
    }
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (c) {
      return c && typeof c.id === 'string' && typeof c.name === 'string' && c.filters;
    }).map(function (c) {
      c.custom = true;
      return c;
    });
  }

  function writeCustom(list) {
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;             // quota or private mode
    }
  }

  function newId() {
    return 'custom-' + Date.now().toString(36) + '-' +
      Math.floor(Math.random() * 1e6).toString(36);
  }

  function addCustom(rec) {
    const list = readCustom();
    const entry = {
      id: newId(),
      name: (rec.name || 'Untitled').slice(0, 40),
      blurb: (rec.blurb || '').slice(0, 90),
      framing: rec.framing,
      filters: rec.filters,
      playlist: !!rec.playlist,
      updated: Date.now(),
      custom: true
    };
    list.push(entry);
    return writeCustom(list) ? entry : null;
  }

  function updateCustom(id, patch) {
    const list = readCustom();
    for (let i = 0; i < list.length; i++) {
      if (list[i].id !== id) continue;
      if (patch.name !== undefined) list[i].name = patch.name.slice(0, 40);
      if (patch.blurb !== undefined) list[i].blurb = patch.blurb.slice(0, 90);
      if (patch.filters !== undefined) list[i].filters = patch.filters;
      if (patch.framing !== undefined) list[i].framing = patch.framing;
      list[i].updated = Date.now();
      return writeCustom(list) ? list[i] : null;
    }
    return null;
  }

  function removeCustom(id) {
    const list = readCustom().filter(function (c) { return c.id !== id; });
    return writeCustom(list);
  }

  function byId(id) {
    const all = LIST.concat(readCustom());
    for (let i = 0; i < all.length; i++) {
      if (all[i].id === id) return all[i];
    }
    return null;
  }

  /* ── Playlists ───────────────────────────────────────────────────────
     Specific images picked by hand, from the gallery or the end of a
     session. A playlist is a saved collection whose filter is a list of
     image ids, so it gets the same card, timer, gallery, rename and delete
     as everything else.
     ─────────────────────────────────────────────────────────────────── */

  function playlists() {
    return readCustom().filter(function (c) { return c.playlist; });
  }

  function idsOf(p) { return (p.filters && p.filters.ids) || []; }

  function findPlaylist(name) {
    const key = name.trim().toLowerCase();
    return playlists().filter(function (c) { return c.name.toLowerCase() === key; })[0] || null;
  }

  /* The one saved to most recently, which the save dialog offers first. */
  function lastPlaylist() {
    return playlists().sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); })[0] || null;
  }

  /* The name used when someone saves without typing one. */
  function nextPlaylistName() {
    let n = 1;
    while (findPlaylist('Playlist ' + n)) n++;
    return 'Playlist ' + n;
  }

  /* Adds the images to the playlist with that name, making it if need be.
     Returns { entry, added }, or null when storage is full or blocked. */
  function saveToPlaylist(name, ids) {
    const existing = findPlaylist(name);
    if (!existing) {
      const made = addCustom({
        name: name, blurb: 'Hand-picked images.',
        filters: { ids: ids.slice() }, playlist: true
      });
      return made && { entry: made, added: ids.length };
    }
    const have = idsOf(existing);
    const fresh = ids.filter(function (id) { return have.indexOf(id) === -1; });
    const entry = updateCustom(existing.id, { filters: { ids: have.concat(fresh) } });
    return entry && { entry: entry, added: fresh.length };
  }

  function removeFromPlaylist(playlistId, id) {
    const p = byId(playlistId);
    if (!p || !p.playlist) return null;
    return updateCustom(playlistId, {
      filters: { ids: idsOf(p).filter(function (x) { return x !== id; }) }
    });
  }

  /* Every image in any playlist, for the ticks in the gallery. */
  function playlistIds() {
    const ids = new Set();
    playlists().forEach(function (p) { idsOf(p).forEach(function (id) { ids.add(id); }); });
    return ids;
  }

  /* Built-ins first, saved ones after. */
  function all() { return LIST.concat(readCustom()); }

  /* Resolve line-name patterns against the current dataset. */
  function resolveLines(patterns) {
    const ids = [];
    Object.keys(SP.lines).forEach(function (id) {
      const name = SP.lines[id];
      for (let i = 0; i < patterns.length; i++) {
        const p = patterns[i];
        if (name === p || name.indexOf(p + ' ') === 0 || name.indexOf(p + ':') === 0) {
          ids.push(id);
          return;
        }
      }
    });
    return ids;
  }

  /* A preset's filter state, built fresh from the blank state each time.

     Built-ins declare only the keys they care about; saved collections store a
     complete state. Both work here, but unknown keys are dropped so an old or
     hand-edited localStorage entry cannot inject junk into the filter state. */
  function filtersFor(preset) {
    const f = SP.blankFilters();
    const src = preset.filters || {};
    Object.keys(src).forEach(function (k) {
      if (k === 'linePatterns') { f.lines = resolveLines(src[k]); return; }
      if (!(k in f)) return;
      f[k] = Array.isArray(src[k]) ? src[k].slice() : src[k];
    });
    return f;
  }

  function countFor(preset) {
    return SP.query(filtersFor(preset)).length;
  }

  /* A representative image for the card, drawn from what the preset matches. */
  function thumbFor(preset) {
    const matches = SP.query(filtersFor(preset));
    if (!matches.length) return null;
    const preferred = matches.filter(function (r) { return r.alias === preset.thumb; });
    const pool = preferred.length ? preferred : matches;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* Any champion alias that no longer exists would silently narrow a preset,
     so say so in the console rather than quietly shipping a broken one. */
  function validate() {
    const bad = [];
    LIST.forEach(function (p) {
      if (!p.filters) return;
      (p.filters.champions || []).forEach(function (a) {
        if (!SP.champByAlias[a]) bad.push(p.id + ' -> ' + a);
      });
      (p.filters.linePatterns || []).forEach(function (pat) {
        if (!resolveLines([pat]).length) bad.push(p.id + ' -> line "' + pat + '"');
      });
    });
    if (bad.length && window.console) {
      console.warn('Collections referencing missing data:\n  ' + bad.join('\n  '));
    }
    return bad;
  }

  /* The first version had one unnamed playlist under its own key. Carry it
     over as a named one so nobody loses their picks. */
  (function migrateSinglePlaylist() {
    const OLD_KEY = 'riotofaction.playlist.v1';
    try {
      const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
      if (Array.isArray(old)) {
        const ids = old.filter(function (id) { return typeof id === 'string'; });
        if (ids.length) saveToPlaylist('Your playlist', ids);
        localStorage.removeItem(OLD_KEY);
      }
    } catch (e) { /* storage blocked: nothing to carry over */ }
  }());

  return {
    list: LIST,
    all: all,
    byId: byId,
    addCustom: addCustom,
    updateCustom: updateCustom,
    removeCustom: removeCustom,
    playlists: playlists,
    findPlaylist: findPlaylist,
    lastPlaylist: lastPlaylist,
    nextPlaylistName: nextPlaylistName,
    saveToPlaylist: saveToPlaylist,
    removeFromPlaylist: removeFromPlaylist,
    playlistIds: playlistIds,
    filtersFor: filtersFor,
    countFor: countFor,
    thumbFor: thumbFor,
    validate: validate
  };
}());
