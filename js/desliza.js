/* Desliza — saca el bloque grande por la salida moviendo las demás piezas.
   Los niveles se generan con búsqueda en anchura: cada nivel tiene solución y se conoce el mínimo de movimientos. */
(function () {
  'use strict';
  var W = 4, H = 5, N = W * H, GOAL = 13; // el bloque grande debe acabar en x=1, y=3
  var SIZE = { b: [2, 2], v: [1, 2], h: [2, 1], s: [1, 1] };

  /* Estado = cadena de 20 caracteres: minúscula en la esquina superior izquierda de cada pieza, mayúscula en el resto, '.' vacío */
  function parse(s) {
    var ps = [];
    for (var i = 0; i < N; i++) {
      var c = s[i];
      if (c === 'b' || c === 'v' || c === 'h' || c === 's') ps.push({ t: c, x: i % W, y: (i / W) | 0 });
    }
    return ps;
  }
  function tryMove(s, p, dx, dy) {
    var sz = SIZE[p.t], nx = p.x + dx, ny = p.y + dy;
    if (nx < 0 || ny < 0 || nx + sz[0] > W || ny + sz[1] > H) return null;
    var a = s.split('');
    for (var yy = 0; yy < sz[1]; yy++) for (var xx = 0; xx < sz[0]; xx++) a[(p.y + yy) * W + p.x + xx] = '.';
    for (yy = 0; yy < sz[1]; yy++) for (xx = 0; xx < sz[0]; xx++) {
      var k = (ny + yy) * W + nx + xx;
      if (a[k] !== '.') return null;
      a[k] = xx === 0 && yy === 0 ? p.t : p.t.toUpperCase();
    }
    return a.join('');
  }
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function neighbors(s) {
    var out = [];
    parse(s).forEach(function (p) {
      DIRS.forEach(function (d) { var n = tryMove(s, p, d[0], d[1]); if (n) out.push(n); });
    });
    return out;
  }
  function solved(s) { return s[GOAL] === 'b'; }

  /* Tablero aleatorio: bloque grande + 2 huecos + piezas de 2 y 1 */
  function randomBoard(rnd) {
    for (var tries = 0; tries < 200; tries++) {
      var a = new Array(N).fill(null);
      var bx = Math.floor(rnd() * 3), by = Math.floor(rnd() * 2);
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(function (o, k) { a[(by + o[1]) * W + bx + o[0]] = k ? 'B' : 'b'; });
      var free = []; for (var i = 0; i < N; i++) if (!a[i]) free.push(i);
      Q.shuffle(free, rnd);
      a[free[0]] = '.'; a[free[1]] = '.';
      var singles = 0, ok = true;
      for (i = 0; i < N; i++) {
        if (a[i]) continue;
        var x = i % W, y = (i / W) | 0, opts = [];
        if (y + 1 < H && !a[i + W]) opts.push('v', 'v');
        if (x + 1 < W && !a[i + 1]) opts.push('h', 'h');
        if (singles < 4 || !opts.length) opts.push('s');
        var t = opts[Math.floor(rnd() * opts.length)];
        if (t === 's') { a[i] = 's'; singles++; }
        else if (t === 'v') { a[i] = 'v'; a[i + W] = 'V'; }
        else { a[i] = 'h'; a[i + 1] = 'H'; }
      }
      if (singles > 5) ok = false;
      if (ok) return a.join('');
    }
    return null;
  }

  /* Explora todas las posiciones alcanzables y calcula la distancia de cada una a la solución */
  function analyze(start, limit) {
    var idx = new Map(), list = [start], adj = [];
    idx.set(start, 0);
    for (var q = 0; q < list.length; q++) {
      var nb = neighbors(list[q]), ids = [];
      for (var k = 0; k < nb.length; k++) {
        var id = idx.get(nb[k]);
        if (id === undefined) {
          if (list.length >= limit) return null;
          id = list.length; idx.set(nb[k], id); list.push(nb[k]);
        }
        ids.push(id);
      }
      adj.push(ids);
    }
    var dist = new Int32Array(list.length).fill(-1), queue = [];
    list.forEach(function (s, i) { if (solved(s)) { dist[i] = 0; queue.push(i); } });
    for (var h = 0; h < queue.length; h++) {
      var cur = queue[h];
      adj[cur].forEach(function (j) { if (dist[j] < 0) { dist[j] = dist[cur] + 1; queue.push(j); } });
    }
    return { list: list, dist: dist, idx: idx };
  }

  function targetFor(lvl) { return Math.min(8 + Math.round(lvl * 1.6), 160); }

  var cache = {};
  function makeLevel(lvl) {
    if (cache[lvl]) return cache[lvl];
    var saved = Q.store.get('desliza_lvl_' + lvl, null);
    if (saved) return (cache[lvl] = saved);
    var rnd = Q.rng(lvl * 7349 + 1013), target = targetFor(lvl), best = null;
    for (var t = 0, guard = 0; t < 10 && guard < 400; t++, guard++) {
      var s = randomBoard(rnd);
      if (!s || (s.match(/s/g) || []).length < 3) { t--; continue; }
      var A = analyze(s, 150000);
      if (!A) continue;
      var maxD = 0;
      for (var i = 0; i < A.dist.length; i++) if (A.dist[i] > maxD) maxD = A.dist[i];
      var want = Math.min(target, maxD);
      if (want < 4) continue;
      var cands = [];
      for (i = 0; i < A.dist.length; i++) if (A.dist[i] === want) cands.push(i);
      var pick = cands[Math.floor(rnd() * cands.length)];
      if (!best || want > best.opt) best = { start: A.list[pick], opt: want };
      if (want >= target) break;
    }
    Q.store.set('desliza_lvl_' + lvl, best);
    return (cache[lvl] = best);
  }

  var root, prog, lvl, L, S, boardEl, frameEl, infoEl, cell, drag, won;

  function mount(app) {
    root = app;
    prog = Q.progress('desliza');
    lvl = prog.data.last || 1;
    build();
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }
  function unmount() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    drag = null;
  }

  function build() {
    root.innerHTML = '';
    root.appendChild(Q.topbar('Desliza', Q.helpButton('Cómo se juega',
      'Saca el <b>bloque rojo grande</b> por la salida verde de abajo.<br><br>' +
      'Arrastra las piezas para deslizarlas; solo se mueven hacia huecos libres.<br><br>' +
      'Cada casilla que avanza una pieza cuenta como un movimiento. Intenta igualar el <b>mínimo</b> para conseguir 3 estrellas.')));
    root.appendChild(Q.levelBar(prog, lvl, function (n) { lvl = n; prog.setLast(n); load(); }, function (l) {
      return 'mínimo ' + (cache[l] ? cache[l].opt : '¿?');
    }));
    infoEl = Q.el('div', { class: 'ds-info' });
    root.appendChild(infoEl);
    cell = Math.floor(Math.min((window.innerWidth - 60) / W, (window.innerHeight - 330) / H, 92));
    cell = Math.max(cell, 52);
    boardEl = Q.el('div', { class: 'ds-board', style: { width: cell * W + 'px', height: cell * H + 'px' } });
    boardEl.addEventListener('pointerdown', onDown);
    frameEl = Q.el('div', { class: 'ds-frame' }, boardEl,
      Q.el('div', { class: 'exit', style: { left: (8 + cell) + 'px', width: cell * 2 + 'px' } }));
    root.appendChild(frameEl);
    root.appendChild(Q.el('div', { class: 'row center', style: { marginTop: '14px' } },
      Q.el('button', { class: 'btn', onclick: undo }, '↶ Deshacer'),
      Q.el('button', { class: 'btn', onclick: function () { reset(); } }, '↺ Reiniciar')));
    load();
  }

  function load() {
    boardEl.innerHTML = '';
    infoEl.innerHTML = '<span class="muted">Generando nivel…</span>';
    setTimeout(function () {
      L = makeLevel(lvl);
      var bar = root.querySelector('.levelbar'); if (bar && bar.refresh) bar.refresh(lvl);
      reset();
    }, 30);
  }

  function reset() {
    S = { s: L.start, moves: 0, hist: [] };
    won = false;
    render();
  }

  function render() {
    infoEl.innerHTML = 'Movimientos: <b>' + S.moves + '</b><span class="muted">Mínimo: ' + L.opt + '</span>';
    var existing = {};
    Array.prototype.forEach.call(boardEl.children, function (e) { existing[e.dataset.key] = e; });
    // asignamos identidades estables por tipo y orden para animar
    var ps = parse(S.s), seen = {};
    ps.forEach(function (p) {
      var key = p.t + (seen[p.t] = (seen[p.t] || 0) + 1);
      p.key = key;
    });
    var used = {};
    ps.forEach(function (p) {
      var e = existing[p.key];
      if (!e) {
        e = Q.el('div', { class: 'ds-piece ' + (p.t === 'b' ? 'big' : p.t) });
        e.dataset.key = p.key;
        if (p.t === 'b') e.textContent = '★';
        boardEl.appendChild(e);
      }
      used[p.key] = true;
      var sz = SIZE[p.t], g = 4;
      e.style.left = p.x * cell + g / 2 + 'px';
      e.style.top = p.y * cell + g / 2 + 'px';
      e.style.width = sz[0] * cell - g + 'px';
      e.style.height = sz[1] * cell - g + 'px';
      e.dataset.x = p.x; e.dataset.y = p.y;
    });
    Object.keys(existing).forEach(function (k) { if (!used[k]) existing[k].remove(); });
  }

  /* Al haber piezas iguales, la "identidad" puede cambiar al moverse; se recalcula siempre a partir de la posición */
  function pieceAt(x, y) {
    var ps = parse(S.s);
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i], sz = SIZE[p.t];
      if (x >= p.x && x < p.x + sz[0] && y >= p.y && y < p.y + sz[1]) return p;
    }
    return null;
  }

  function onDown(e) {
    if (won || !L) return;
    var r = boardEl.getBoundingClientRect();
    var x = Math.floor((e.clientX - r.left) / cell), y = Math.floor((e.clientY - r.top) / cell);
    var p = pieceAt(x, y);
    if (!p) return;
    e.preventDefault();
    drag = { p: p, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y };
  }

  function onMove(e) {
    if (!drag) return;
    var tx = drag.ox + Math.round((e.clientX - drag.sx) / cell);
    var ty = drag.oy + Math.round((e.clientY - drag.sy) / cell);
    var horizFirst = Math.abs(e.clientX - drag.sx) >= Math.abs(e.clientY - drag.sy);
    var guard = 0;
    while (guard++ < 10 && drag) {
      var p = drag.p, moved = false;
      var order = horizFirst ? ['x', 'y'] : ['y', 'x'];
      for (var k = 0; k < 2 && !moved; k++) {
        if (order[k] === 'x' && tx !== p.x) moved = step(Math.sign(tx - p.x), 0);
        if (order[k] === 'y' && ty !== p.y) moved = step(0, Math.sign(ty - p.y));
      }
      if (!moved) break;
    }
  }

  function step(dx, dy) {
    var n = tryMove(S.s, drag.p, dx, dy);
    if (!n) return false;
    S.hist.push(S.s);
    S.s = n; S.moves++;
    drag.p = { t: drag.p.t, x: drag.p.x + dx, y: drag.p.y + dy };
    render();
    if (solved(S.s)) { drag = null; win(); }
    return true;
  }

  function onUp() { drag = null; }

  function undo() {
    if (won || !S.hist.length) return;
    S.s = S.hist.pop(); S.moves++;
    render();
  }

  function win() {
    won = true;
    var big = boardEl.querySelector('.ds-piece.big');
    Q.vibrate(40);
    setTimeout(function () {
      if (big) { big.classList.add('out'); big.style.top = (H + 1) * cell + 'px'; }
    }, 120);
    var stars = S.moves <= L.opt ? 3 : S.moves <= Math.ceil(L.opt * 1.5) ? 2 : 1;
    prog.complete(lvl, stars);
    setTimeout(function () {
      Q.modal({
        title: '¡Lo sacaste!', stars: stars,
        body: '<b>' + S.moves + '</b> movimientos (mínimo posible: ' + L.opt + ')',
        buttons: [{ label: 'Repetir', onClick: reset },
          { label: 'Siguiente nivel', primary: true, onClick: function () { lvl++; prog.setLast(lvl); build(); } }]
      });
    }, 700);
  }

  Q.register('desliza', {
    title: 'Desliza', subtitle: 'Libera el bloque grande', icon: '🟥',
    color: 'linear-gradient(145deg,#ffd21f,#e07a00)',
    progressText: function () { return 'Nivel ' + Q.progress('desliza').data.max + ' · niveles sin fin'; },
    mount: mount, unmount: unmount
  });
})();
