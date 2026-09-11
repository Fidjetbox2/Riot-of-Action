/* ═══ Gallery ═════════════════════════════════════════════════════════
   Every illustration in one browsable grid, paged in as you scroll so
   2,000+ splash arts don't all hit the network at once.
   ═════════════════════════════════════════════════════════════════════ */

const Gallery = (function () {
  'use strict';

  const PAGE = 48;
  const HIGHLIGHT = { legendary: 1, ultimate: 1, mythic: 1, exalted: 1, transcendent: 1 };

  let list = [];
  let shown = 0;
  let crop = 'splash';
  let observer = null;
  let lbIndex = -1;

  const gridEl = function () { return document.getElementById('gallery-grid'); };
  const endEl = function () { return document.getElementById('gallery-end'); };

  /* ── Tiles ───────────────────────────────────────────────────────── */

  function makeTile(rec, index) {
    const fig = document.createElement('figure');
    fig.className = 'tile';
    fig.style.setProperty('--tile-ratio', SP.ratio(crop));
    fig.tabIndex = 0;
    fig.setAttribute('role', 'button');
    fig.setAttribute('aria-label', rec.name + ', ' + rec.champ);

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = rec.name;
    SP.loadInto(img, rec, crop);
    fig.appendChild(img);

    if (rec.base) fig.appendChild(badge('Base'));
    else if (HIGHLIGHT[rec.rarity]) fig.appendChild(badge(SP.labels.rarity[rec.rarity]));
    else if (rec.legacy) fig.appendChild(badge('Legacy'));

    const cap = document.createElement('figcaption');
    const a = document.createElement('span');
    a.className = 't-skin';
    a.textContent = rec.name;
    const b = document.createElement('span');
    b.className = 't-champ';
    b.textContent = rec.champ + (rec.lineNames.length ? ' · ' + rec.lineNames[0] : '');
    cap.appendChild(a);
    cap.appendChild(b);
    fig.appendChild(cap);

    function open() { openLightbox(index); }
    fig.addEventListener('click', open);
    fig.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    return fig;
  }

  function badge(text) {
    const s = document.createElement('span');
    s.className = 't-badge';
    s.textContent = text;
    return s;
  }

  /* ── Paging ──────────────────────────────────────────────────────── */

  function appendPage() {
    const grid = gridEl();
    const frag = document.createDocumentFragment();
    const stop = Math.min(shown + PAGE, list.length);
    for (let i = shown; i < stop; i++) frag.appendChild(makeTile(list[i], i));
    grid.appendChild(frag);
    shown = stop;

    const end = endEl();
    if (shown >= list.length) {
      end.textContent = list.length
        ? 'That is all ' + list.length.toLocaleString() + ' of them.'
        : '';
    } else {
      end.textContent = 'Loading more… (' + shown.toLocaleString() + ' of ' +
        list.length.toLocaleString() + ')';
    }
  }

  /* One page of tiles can fall short of filling a big screen. The observer
     only fires when the sentinel's visibility *changes*, so if it is already
     on screen after a page lands it never fires again, and the gallery stalls
     with nothing to scroll. Keep adding pages until there is some runway. */
  function fillScreen() {
    const main = document.getElementById('main');
    if (!main.clientHeight) return;             // not laid out, nothing to measure
    let guard = 0;
    while (shown < list.length && guard++ < 50 &&
           main.scrollHeight - main.scrollTop - main.clientHeight < 600) {
      appendPage();
    }
  }

  let resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!document.getElementById('view-gallery').hidden) fillScreen();
    }, 150);
  });

  function setupObserver() {
    if (observer) observer.disconnect();
    observer = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting && shown < list.length) { appendPage(); fillScreen(); }
    }, { root: document.getElementById('main'), rootMargin: '600px' });
    observer.observe(endEl());
  }

  /* ── Render ──────────────────────────────────────────────────────── */

  function render(records, sort, cropMode, size) {
    crop = cropMode || 'splash';
    list = SP.sortList(records, sort);
    shown = 0;

    const grid = gridEl();
    grid.innerHTML = '';
    grid.className = 'grid' + (size && size !== 'md' ? ' ' + size : '');

    document.getElementById('gallery-count').textContent =
      list.length.toLocaleString() + (list.length === 1 ? ' illustration' : ' illustrations');

    if (!list.length) {
      endEl().innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<strong>Nothing matches those filters</strong>' +
        'Loosen one of them. The chips at the top of the sidebar clear individually.';
      grid.appendChild(empty);
      return;
    }

    appendPage();
    fillScreen();
    setupObserver();
  }

  /* ── Lightbox ────────────────────────────────────────────────────── */

  function openLightbox(i) {
    if (i < 0 || i >= list.length) return;
    lbIndex = i;
    const rec = list[i];
    const box = document.getElementById('lightbox');
    const img = document.getElementById('lb-img');

    SP.loadInto(img, rec, crop === 'portrait' ? 'portrait' : 'splash');
    img.alt = rec.name;

    const bits = [
      SP.labels.gender[rec.gender],
      SP.labels.species[rec.species],
      SP.labels.region[rec.region],
      rec.roles.map(function (r) { return SP.labels.role[r]; }).join(' / '),
      SP.labels.rarity[rec.rarity]
    ].filter(Boolean);
    if (rec.lineNames.length) bits.push(rec.lineNames.join(', '));
    if (rec.legacy) bits.push('Legacy');

    document.getElementById('lb-caption').innerHTML =
      '<strong></strong><span class="who"></span><span class="meta"></span>';
    const cap = document.getElementById('lb-caption');
    cap.querySelector('strong').textContent = rec.name;
    cap.querySelector('.who').textContent = rec.champ + ', ' + rec.title;
    cap.querySelector('.meta').textContent = ' · ' + bits.join(' · ');

    box.hidden = false;
  }

  function closeLightbox() {
    document.getElementById('lightbox').hidden = true;
    lbIndex = -1;
  }

  function step(delta) {
    if (lbIndex === -1) return;
    let next = lbIndex + delta;
    if (next < 0) next = list.length - 1;
    if (next >= list.length) next = 0;
    openLightbox(next);
  }

  function initLightbox() {
    document.getElementById('lb-close').addEventListener('click', closeLightbox);
    document.getElementById('lb-prev').addEventListener('click', function (e) {
      e.stopPropagation(); step(-1);
    });
    document.getElementById('lb-next').addEventListener('click', function (e) {
      e.stopPropagation(); step(1);
    });
    document.getElementById('lightbox').addEventListener('click', function (e) {
      if (e.target.id === 'lightbox') closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (lbIndex === -1) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    });
  }

  return {
    render: render,
    initLightbox: initLightbox,
    isLightboxOpen: function () { return lbIndex !== -1; },
    current: function () { return list; }
  };
}());
