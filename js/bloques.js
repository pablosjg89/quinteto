/* Bloques — rellena el tablero con las piezas (puzzle de poliominós generado por niveles) */
(function () {
  'use strict';
  var PCOL = ['#ff3b4e', '#2f8cff', '#2fd66b', '#ffd21f', '#b45cff', '#ff8a1f', '#ff6fcf', '#29e0e6', '#9be22f', '#ff5e2f', '#7b8cff', '#f0f0f0'];

  /* Tableros por tramos de 10 niveles */
  var TIERS = [
    { w: 4, h: 3, min: 3, max: 4 }, { w: 5, h: 3, min: 3, max: 4 }, { w: 5, h: 4, min: 3, max: 5 },
    { w: 6, h: 4, min: 3, max: 5 }, { w: 5, h: 5, min: 3, max: 5 }, { w: 6, h: 5, min: 4, max: 5 },
    { w: 7, h: 5, min: 4, max: 5 }, { w: 8, h: 5, min: 4, max: 5 }, { w: 6, h: 6, min: 4, max: 5 },
    { w: 7, h: 6, min: 4, max: 5 }, { w: 8, h: 6, min: 4, max: 5 }, { w: 10, h: 6, min: 5, max: 5 }
  ];

  function tierOf(lvl) { return TIERS[Math.min(TIERS.length - 1, Math.floor((lvl - 1) / 10))]; }

  /* Divide el tablero en piezas aleatorias (garantiza que el puzzle tiene solución) */
  function partition(W, H, minS, maxS, rnd) {
    for (var attempt = 0; attempt < 4000; attempt++) {
      var g = new Array(W * H).fill(-1), pid = 0, ok = true;
      for (var start = 0; start < W * H && ok; start++) {
        if (g[start] !== -1) continue;
        var target = minS + Math.floor(rnd() * (maxS - minS + 1));
        var cells = [start]; g[start] = pid;
        while (cells.length < target) {
          var fr = [];
          for (var i = 0; i < cells.length; i++) {
            var c = cells[i], x = c % W, y = (c / W) | 0;
            if (x > 0 && g[c - 1] === -1) fr.push(c - 1);
            if (x < W - 1 && g[c + 1] === -1) fr.push(c + 1);
            if (y > 0 && g[c - W] === -1) fr.push(c - W);
            if (y < H - 1 && g[c + W] === -1) fr.push(c + W);
          }
          if (!fr.length) break;
          var n = fr[Math.floor(rnd() * fr.length)]; g[n] = pid; cells.push(n);
        }
        if (cells.length < minS) ok = false;
        pid++;
      }
      if (ok) return { g: g, count: pid };
    }
    return null;
  }

  function normalize(cells) {
    var mx = Infinity, my = Infinity;
    cells.forEach(function (c) { mx = Math.min(mx, c[0]); my = Math.min(my, c[1]); });
    return cells.map(function (c) { return [c[0] - mx, c[1] - my]; })
      .sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
  }
  function rotate(cells) { return normalize(cells.map(function (c) { return [-c[1], c[0]]; })); }
  function flip(cells) { return normalize(cells.map(function (c) { return [-c[0], c[1]]; })); }
  function dims(cells) {
    var w = 0, h = 0; cells.forEach(function (c) { w = Math.max(w, c[0] + 1); h = Math.max(h, c[1] + 1); });
    return { w: w, h: h };
  }

  function makeLevel(lvl) {
    var t = tierOf(lvl), rnd = Q.rng(lvl * 2654435761 + 77);
    var part = partition(t.w, t.h, t.min, t.max, rnd) || partition(t.w, t.h, 3, 5, rnd);
    var groups = [];
    for (var i = 0; i < part.count; i++) groups.push([]);
    part.g.forEach(function (p, idx) { groups[p].push([idx % t.w, (idx / t.w) | 0]); });
    var inTier = (lvl - 1) % 10, tierIdx = Math.floor((lvl - 1) / 10);
    var free = Math.min(part.count, 2 + Math.min(tierIdx, 6) + Math.floor(inTier / 3));
    var order = Q.shuffle(groups.map(function (_, i) { return i; }), rnd);
    var colors = Q.shuffle(PCOL.slice(), rnd);
    var pieces = groups.map(function (cells, i) {
      var isFree = order.indexOf(i) < free;
      var shape = normalize(cells);
      var ox = Infinity, oy = Infinity;
      cells.forEach(function (c) { ox = Math.min(ox, c[0]); oy = Math.min(oy, c[1]); });
      if (isFree) {
        var r = Math.floor(rnd() * 4); for (var k = 0; k < r; k++) shape = rotate(shape);
        if (rnd() < 0.5) shape = flip(shape);
      }
      return { id: i, shape: shape, color: colors[i % colors.length], fixed: !isFree, pos: isFree ? null : { x: ox, y: oy } };
    });
    return { w: t.w, h: t.h, pieces: pieces };
  }

  var root, prog, lvl, L, sel, cs, boardEl, trayEl, startTime, drag;

  function mount(app) {
    root = app;
    prog = Q.progress('bloques');
    lvl = prog.data.last || 1;
    build();
  }

  function build() {
    root.innerHTML = '';
    root.appendChild(Q.topbar('Bloques', Q.helpButton('Cómo se juega',
      'Rellena <b>todo el tablero</b> con las piezas de abajo. Las piezas rayadas ya están colocadas.<br><br>' +
      '• <b>Arrastra</b> una pieza al tablero.<br>• Toca una pieza para seleccionarla y vuelve a tocarla para <b>girarla</b>.<br>' +
      '• Usa <b>Voltear</b> para darle la vuelta.<br>• Toca una pieza del tablero para devolverla abajo.')));
    root.appendChild(Q.levelBar(prog, lvl, function (n) { lvl = n; prog.setLast(n); newLevel(); }, function (l) {
      var t = tierOf(l); return t.w + '×' + t.h;
    }));
    var wrap = Q.el('div', { class: 'bq-wrap' });
    boardEl = Q.el('div', { class: 'bq-board' });
    trayEl = Q.el('div', { class: 'bq-tray' });
    wrap.appendChild(boardEl);
    wrap.appendChild(Q.el('div', { class: 'row center' },
      Q.el('button', { class: 'btn small', onclick: function () { act('rot'); } }, '⟳ Girar'),
      Q.el('button', { class: 'btn small', onclick: function () { act('flip'); } }, '⇋ Voltear'),
      Q.el('button', { class: 'btn small', onclick: function () { resetLevel(); } }, '↺ Reiniciar')));
    wrap.appendChild(trayEl);
    root.appendChild(wrap);
    newLevel();
  }

  function newLevel() { L = makeLevel(lvl); sel = null; startTime = Date.now(); render(); }
  function resetLevel() { L.pieces.forEach(function (p) { if (!p.fixed) p.pos = null; }); sel = null; render(); }

  function act(kind) {
    var p = sel != null ? L.pieces[sel] : null;
    if (!p) { Q.toast('Selecciona una pieza de abajo'); return; }
    if (p.pos) { p.pos = null; }
    p.shape = kind === 'rot' ? rotate(p.shape) : flip(p.shape);
    render();
  }

  function occupancy(exceptId) {
    var occ = new Array(L.w * L.h).fill(-1);
    L.pieces.forEach(function (p) {
      if (!p.pos || p.id === exceptId) return;
      p.shape.forEach(function (c) { occ[(p.pos.y + c[1]) * L.w + p.pos.x + c[0]] = p.id; });
    });
    return occ;
  }

  function fits(p, x, y) {
    var occ = occupancy(p.id);
    for (var i = 0; i < p.shape.length; i++) {
      var cx = x + p.shape[i][0], cy = y + p.shape[i][1];
      if (cx < 0 || cy < 0 || cx >= L.w || cy >= L.h) return false;
      if (occ[cy * L.w + cx] !== -1) return false;
    }
    return true;
  }

  function render() {
    var maxW = Math.min(window.innerWidth - 48, 560);
    cs = Math.max(26, Math.min(64, Math.floor(maxW / L.w)));
    root.style.setProperty('--cs', cs + 'px');
    boardEl.style.gridTemplateColumns = 'repeat(' + L.w + ', ' + cs + 'px)';
    boardEl.innerHTML = '';
    var occ = occupancy(-1);
    for (var i = 0; i < L.w * L.h; i++) {
      var pid = occ[i], cell = Q.el('div', { class: 'bq-cell' });
      cell.dataset.idx = i;
      if (pid !== -1) {
        var p = L.pieces[pid];
        cell.classList.add('fill');
        if (p.fixed) cell.classList.add('fixed');
        cell.style.backgroundColor = p.color;
        cell.dataset.pid = pid;
      }
      boardEl.appendChild(cell);
    }
    var ms = Math.max(12, Math.min(20, Math.floor(cs * 0.45)));
    trayEl.style.setProperty('--ms', ms + 'px');
    trayEl.innerHTML = '';
    var left = 0;
    L.pieces.forEach(function (p) {
      if (p.fixed || p.pos) return;
      left++;
      var d = dims(p.shape);
      var el = Q.el('div', { class: 'bq-piece' + (sel === p.id ? ' sel' : '') });
      el.style.gridTemplateColumns = 'repeat(' + d.w + ', ' + ms + 'px)';
      el.style.gridTemplateRows = 'repeat(' + d.h + ', ' + ms + 'px)';
      p.shape.forEach(function (c) {
        el.appendChild(Q.el('i', { style: { background: p.color, gridColumn: (c[0] + 1), gridRow: (c[1] + 1) } }));
      });
      el.dataset.pid = p.id;
      trayEl.appendChild(el);
    });
    if (!left) {
      trayEl.appendChild(Q.el('div', { class: 'muted', style: { alignSelf: 'center' } }, 'No quedan piezas'));
      checkWin();
    }
  }

  function checkWin() {
    var occ = occupancy(-1);
    if (occ.indexOf(-1) !== -1) return;
    var secs = Math.round((Date.now() - startTime) / 1000);
    var t = tierOf(lvl), par = 20 + t.w * t.h * 2;
    var stars = secs <= par ? 3 : secs <= par * 2 ? 2 : 1;
    prog.complete(lvl, stars);
    Q.vibrate(40);
    setTimeout(function () {
      Q.modal({
        title: '¡Tablero completo!', stars: stars,
        body: 'Tiempo: <b>' + Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0') + '</b>',
        buttons: [{ label: 'Repetir', onClick: function () { resetLevel(); startTime = Date.now(); } },
          { label: 'Siguiente nivel', primary: true, onClick: function () { lvl++; prog.setLast(lvl); build(); } }]
      });
    }, 250);
  }

  /* ---------- Arrastrar y soltar ---------- */
  function onDown(e) {
    var t = e.target.closest('[data-pid]');
    if (!t) return;
    var p = L.pieces[+t.dataset.pid];
    if (!p || p.fixed) return;
    e.preventDefault();
    drag = { p: p, sx: e.clientX, sy: e.clientY, moved: false, fromBoard: !!p.pos, ghost: null, target: null };
  }

  function onMove(e) {
    if (!drag) return;
    var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
    if (!drag.moved) {
      drag.moved = true;
      sel = drag.p.id;
      var d = dims(drag.p.shape);
      var g = Q.el('div', { class: 'bq-ghost' });
      g.style.gridTemplateColumns = 'repeat(' + d.w + ', ' + cs + 'px)';
      g.style.gridTemplateRows = 'repeat(' + d.h + ', ' + cs + 'px)';
      drag.p.shape.forEach(function (c) {
        g.appendChild(Q.el('i', { style: { background: drag.p.color, gridColumn: c[0] + 1, gridRow: c[1] + 1 } }));
      });
      drag.dims = d;
      drag.ghost = g;
      document.body.appendChild(g);
      if (drag.p.pos) { drag.p.pos = null; render(); }
    }
    // la pieza flota por encima del dedo para que se vea
    var gx = e.clientX - drag.dims.w * cs / 2, gy = e.clientY - drag.dims.h * cs - cs * 0.6;
    drag.ghost.style.left = gx + 'px'; drag.ghost.style.top = gy + 'px';
    var first = boardEl.firstChild.getBoundingClientRect();
    var x = Math.round((gx - first.left) / cs), y = Math.round((gy - first.top) / cs);
    preview(x, y);
  }

  function preview(x, y) {
    Array.prototype.forEach.call(boardEl.querySelectorAll('.prev-ok,.prev-bad'), function (c) { c.classList.remove('prev-ok', 'prev-bad'); });
    var p = drag.p, d = drag.dims;
    if (x + d.w <= 0 || y + d.h <= 0 || x >= L.w || y >= L.h) { drag.target = null; return; }
    var ok = fits(p, x, y);
    drag.target = ok ? { x: x, y: y } : null;
    p.shape.forEach(function (c) {
      var cx = x + c[0], cy = y + c[1];
      if (cx >= 0 && cy >= 0 && cx < L.w && cy < L.h) boardEl.children[cy * L.w + cx].classList.add(ok ? 'prev-ok' : 'prev-bad');
    });
  }

  function onUp() {
    if (!drag) return;
    var d = drag; drag = null;
    if (d.ghost) d.ghost.remove();
    if (!d.moved) {
      // toque: en el tablero devuelve la pieza; en la bandeja selecciona / gira
      if (d.fromBoard) { d.p.pos = null; sel = d.p.id; }
      else if (sel === d.p.id) d.p.shape = rotate(d.p.shape);
      else sel = d.p.id;
      render();
      return;
    }
    if (d.target) { d.p.pos = d.target; Q.vibrate(10); }
    render();
  }

  function mountEvents() {
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }
  function unmountEvents() {
    document.removeEventListener('pointerdown', onDown);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    if (drag && drag.ghost) drag.ghost.remove();
    drag = null;
  }

  Q.register('bloques', {
    title: 'Bloques', subtitle: 'Encaja todas las piezas', icon: '🧩',
    color: 'linear-gradient(145deg,#2fd66b,#138a4a)',
    progressText: function () { return 'Nivel ' + Q.progress('bloques').data.max + ' · niveles sin fin'; },
    mount: function (app) { mount(app); mountEvents(); },
    unmount: unmountEvents
  });
})();
