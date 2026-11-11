/* Parchís — 2 a 4 jugadores, humanos o IA, dado automático */
(function () {
  'use strict';

  /* Recorrido común de 52 casillas en una cuadrícula 15×15 [fila, columna] */
  var T = [], c, r;
  for (c = 1; c <= 5; c++) T.push([6, c]);
  for (r = 5; r >= 0; r--) T.push([r, 6]);
  T.push([0, 7]);
  for (r = 0; r <= 5; r++) T.push([r, 8]);
  for (c = 9; c <= 14; c++) T.push([6, c]);
  T.push([7, 14]);
  for (c = 14; c >= 9; c--) T.push([8, c]);
  for (r = 9; r <= 14; r++) T.push([r, 8]);
  T.push([14, 7]);
  for (r = 14; r >= 9; r--) T.push([r, 6]);
  for (c = 5; c >= 0; c--) T.push([8, c]);
  T.push([7, 0]);
  T.push([6, 0]);

  var SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
  var FINISH = 56; // 0..50 recorrido, 51..55 pasillo, 56 meta

  var COLORS = [
    { name: 'Rojo', css: 'var(--c0)', hex: '#ff3b4e', start: 0, yard: [0, 0], home: function (i) { return [7, 1 + i]; }, center: [7.5, 6.6] },
    { name: 'Verde', css: 'var(--c2)', hex: '#2fd66b', start: 13, yard: [0, 9], home: function (i) { return [1 + i, 7]; }, center: [6.6, 7.5] },
    { name: 'Amarillo', css: 'var(--c3)', hex: '#ffd21f', start: 26, yard: [9, 9], home: function (i) { return [7, 13 - i]; }, center: [7.5, 8.4] },
    { name: 'Azul', css: 'var(--c1)', hex: '#2f8cff', start: 39, yard: [9, 0], home: function (i) { return [13 - i, 7]; }, center: [8.4, 7.5] }
  ];
  var PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  var root, setup, G, boardEl, dieEl, turnEl, timers = [];

  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function mount(app) {
    root = app;
    setup = Q.store.get('parchis_setup', null) || { n: 4, ai: [false, true, true, true] };
    showSetup();
  }

  /* ---------- Configuración ---------- */
  function seats(n) { return n === 2 ? [0, 2] : n === 3 ? [0, 1, 2] : [0, 1, 2, 3]; }

  function showSetup() {
    clearTimers();
    root.innerHTML = '';
    root.appendChild(Q.topbar('Parchís', Q.helpButton('Cómo se juega',
      'Lleva tus <b>4 fichas</b> desde tu casa hasta la meta del centro.<br><br>' +
      '• Necesitas un <b>6</b> para sacar ficha.<br>• Con un 6 vuelves a tirar (tres 6 seguidos pierden el turno).<br>' +
      '• Si caes en una casilla con una ficha rival, la <b>comes</b> y vuelve a su casa (y tiras otra vez).<br>' +
      '• Las casillas con ★ y las de salida son <b>seguras</b>.<br>• Para entrar en la meta necesitas el número exacto.<br><br>' +
      'Toca el dado para tirar y luego la ficha que quieras mover (parpadea).')));
    var box = Q.el('div', { class: 'pc-setup' });
    box.appendChild(Q.el('div', { class: 'row center' }, Q.el('span', { class: 'muted' }, 'Jugadores:'),
      Q.seg([{ label: '2', value: 2 }, { label: '3', value: 3 }, { label: '4', value: 4 }], setup.n, function (v) { setup.n = v; showSetup(); })));
    var on = seats(setup.n);
    COLORS.forEach(function (col, i) {
      var active = on.indexOf(i) !== -1;
      box.appendChild(Q.el('div', { class: 'pl' + (active ? '' : ' off') },
        Q.el('div', { class: 'dot led', style: { background: col.css } }),
        Q.el('b', { class: 'grow', text: col.name }),
        active ? Q.seg([{ label: '🙂 Persona', value: false }, { label: '🤖 IA', value: true }], !!setup.ai[i], function (v) { setup.ai[i] = v; }) : Q.el('span', { class: 'muted', text: 'no juega' })));
    });
    box.appendChild(Q.el('button', { class: 'btn primary', style: { marginTop: '8px' }, onclick: function () {
      Q.store.set('parchis_setup', setup); startGame();
    } }, '¡A jugar!'));
    root.appendChild(box);
  }

  /* ---------- Partida ---------- */
  function startGame() {
    var ps = seats(setup.n).map(function (i) { return { c: i, ai: !!setup.ai[i], tok: [-1, -1, -1, -1] }; });
    G = { players: ps, turn: 0, dice: 0, sixes: 0, phase: 'roll', legal: [], over: false };
    root.innerHTML = '';
    root.appendChild(Q.topbar('Parchís', Q.el('button', { class: 'btn small', onclick: function () {
      Q.modal({ title: '¿Salir de la partida?', body: 'Se perderá la partida en curso.', buttons: [
        { label: 'Seguir jugando' }, { label: 'Nueva partida', primary: true, onClick: showSetup }] });
    } }, 'Nueva')));
    var size = Math.min(window.innerWidth - 32, window.innerHeight - 220, 620);
    boardEl = Q.el('div', { class: 'pc-board', style: { '--bs': size + 'px' } });
    boardEl.style.setProperty('--bs', size + 'px');
    drawBoard();
    root.appendChild(boardEl);
    dieEl = Q.el('button', { class: 'pc-die', 'aria-label': 'Tirar dado', onclick: function () { if (G.phase === 'roll' && !cur().ai) roll(); } });
    for (var i = 0; i < 9; i++) dieEl.appendChild(Q.el('i'));
    turnEl = Q.el('div', { class: 'pc-turn' });
    root.appendChild(Q.el('div', { class: 'pc-hud' }, dieEl, turnEl));
    drawTokens();
    nextTurnStart();
  }

  function cur() { return G.players[G.turn]; }

  function drawBoard() {
    boardEl.innerHTML = '';
    var cells = {};
    T.forEach(function (p, i) { cells[p[0] + ',' + p[1]] = { i: i }; });
    COLORS.forEach(function (col, ci) {
      for (var k = 0; k < 5; k++) { var h = col.home(k); cells[h[0] + ',' + h[1]] = { home: ci }; }
    });
    for (var r = 0; r < 15; r++) {
      for (var c = 0; c < 15; c++) {
        var yardIdx = -1;
        COLORS.forEach(function (col, ci) { if (col.yard[0] === r && col.yard[1] === c) yardIdx = ci; });
        if (yardIdx >= 0) {
          var y = Q.el('div', { class: 'pc-yard', style: { gridRow: (r + 1) + ' / span 6', gridColumn: (c + 1) + ' / span 6', background: COLORS[yardIdx].css } }, Q.el('div'));
          boardEl.appendChild(y);
          continue;
        }
        if (r === 6 && c === 6) { boardEl.appendChild(Q.el('div', { class: 'pc-center' })); continue; }
        var info = cells[r + ',' + c];
        if (!info) continue; // cubierto por casa o centro
        var cell = Q.el('div', { class: 'pc-cell', style: { gridRow: r + 1, gridColumn: c + 1 } });
        if (info.home != null) cell.style.background = COLORS[info.home].css;
        else {
          var startOf = -1;
          COLORS.forEach(function (col, ci) { if (col.start === info.i) startOf = ci; });
          if (startOf >= 0) { cell.style.background = COLORS[startOf].css; cell.textContent = '➜'; cell.style.color = '#fff'; }
          else if (SAFE.indexOf(info.i) !== -1) cell.textContent = '★';
        }
        boardEl.appendChild(cell);
      }
    }
  }

  /* Coordenadas (en casillas, centro) de una ficha */
  function coord(pl, k) {
    var col = COLORS[pl.c], p = pl.tok[k];
    if (p < 0) return [col.yard[0] + (k < 2 ? 2 : 4), col.yard[1] + (k % 2 ? 4 : 2)];
    if (p <= 50) { var t = T[(col.start + p) % 52]; return [t[0] + 0.5, t[1] + 0.5]; }
    if (p < FINISH) { var h = col.home(p - 51); return [h[0] + 0.5, h[1] + 0.5]; }
    return [col.center[0] + ((k >> 1) - 0.5) * 0.45, col.center[1] + ((k & 1) - 0.5) * 0.45];
  }

  function drawTokens() {
    var old = boardEl.querySelectorAll('.pc-token');
    var map = {};
    Array.prototype.forEach.call(old, function (e) { map[e.dataset.key] = e; });
    var unit = 100 / 15;
    // agrupar fichas en la misma casilla para desplazarlas un poco
    var groups = {};
    G.players.forEach(function (pl, pi) {
      pl.tok.forEach(function (p, k) {
        var xy = coord(pl, k), key = xy.join(',');
        (groups[key] = groups[key] || []).push([pi, k, xy]);
      });
    });
    Object.keys(groups).forEach(function (key) {
      var g = groups[key];
      g.forEach(function (it, n) {
        var pi = it[0], k = it[1], xy = it[2], pl = G.players[pi];
        var off = g.length > 1 ? (n - (g.length - 1) / 2) * 0.28 : 0;
        var id = pi + '_' + k, e = map[id];
        if (!e) {
          e = Q.el('div', { class: 'pc-token' });
          e.dataset.key = id;
          e.style.background = COLORS[pl.c].css;
          e.addEventListener('click', function () { onTokenClick(pi, k); });
          boardEl.appendChild(e);
        }
        e.style.left = (xy[1] + off) * unit + '%';
        e.style.top = (xy[0] + off * 0.6) * unit + '%';
        var can = G.phase === 'move' && pi === G.turn && !pl.ai && G.legal.indexOf(k) !== -1;
        e.classList.toggle('can', can);
      });
    });
  }

  function showDie(v) {
    var on = PIPS[v] || [];
    Array.prototype.forEach.call(dieEl.children, function (e, i) { e.classList.toggle('on', on.indexOf(i) !== -1); });
  }

  function updateHud(msg) {
    var pl = cur(), col = COLORS[pl.c];
    dieEl.style.setProperty('--turn', col.hex);
    dieEl.disabled = !(G.phase === 'roll' && !pl.ai);
    turnEl.innerHTML = '';
    turnEl.appendChild(Q.el('div', { style: { color: col.hex } }, 'Turno: ' + col.name + (pl.ai ? ' 🤖' : '')));
    turnEl.appendChild(Q.el('div', { class: 'muted', style: { fontSize: '14px', fontWeight: 500 } }, msg || ''));
  }

  function nextTurnStart() {
    G.phase = 'roll'; G.legal = [];
    updateHud(cur().ai ? 'Pensando…' : 'Toca el dado');
    drawTokens();
    if (cur().ai) later(roll, 700);
  }

  function roll() {
    if (G.phase !== 'roll' || G.over) return;
    G.phase = 'rolling';
    dieEl.classList.remove('rolling'); void dieEl.offsetWidth; dieEl.classList.add('rolling');
    var n = 0;
    var spin = function () {
      showDie(1 + Math.floor(Math.random() * 6));
      if (++n < 6) later(spin, 55);
      else afterRoll(1 + Math.floor(Math.random() * 6));
    };
    spin();
    updateHud('');
  }

  function legalMoves(pl, d) {
    var res = [];
    pl.tok.forEach(function (p, k) {
      if (p < 0) { if (d === 6) res.push(k); }
      else if (p < FINISH && p + d <= FINISH) res.push(k);
    });
    return res;
  }

  function afterRoll(d) {
    G.dice = d; showDie(d);
    var pl = cur();
    if (d === 6) G.sixes++; else G.sixes = 0;
    if (G.sixes === 3) {
      G.sixes = 0;
      updateHud('¡Tres 6 seguidos! Pierdes el turno');
      later(passTurn, 1200);
      return;
    }
    G.legal = legalMoves(pl, d);
    if (!G.legal.length) {
      updateHud('Sin movimientos');
      later(d === 6 ? nextTurnStart : passTurn, 1000);
      return;
    }
    G.phase = 'move';
    // fichas en la misma posición cuentan como un solo movimiento
    var distinct = {};
    G.legal.forEach(function (k) { distinct[pl.tok[k]] = k; });
    var opts = Object.keys(distinct);
    if (pl.ai) { later(function () { doMove(aiChoose(pl, d)); }, 550); updateHud('Saca un ' + d); }
    else if (opts.length === 1) { updateHud('Saca un ' + d); later(function () { doMove(distinct[opts[0]]); }, 450); }
    else updateHud('Saca un ' + d + ' · elige ficha');
    drawTokens();
  }

  function onTokenClick(pi, k) {
    if (G.phase !== 'move' || pi !== G.turn || cur().ai) return;
    if (G.legal.indexOf(k) === -1) return;
    doMove(k);
  }

  function absPos(pl, p) { return (COLORS[pl.c].start + p) % 52; }

  function doMove(k) {
    if (G.phase !== 'move') return;
    G.phase = 'anim';
    var pl = cur(), d = G.dice;
    var steps = pl.tok[k] < 0 ? 1 : d;
    var target = pl.tok[k] < 0 ? 0 : pl.tok[k] + d;
    drawTokens();
    var step = function () {
      pl.tok[k] = pl.tok[k] < 0 ? 0 : pl.tok[k] + 1;
      drawTokens();
      if (--steps > 0 && pl.tok[k] < target) later(step, 150);
      else later(function () { land(pl, k); }, 180);
    };
    step();
  }

  function land(pl, k) {
    var p = pl.tok[k], again = G.dice === 6, msg = '';
    if (p <= 50) {
      var a = absPos(pl, p);
      if (SAFE.indexOf(a) === -1) {
        G.players.forEach(function (op) {
          if (op === pl) return;
          op.tok.forEach(function (q, j) {
            if (q >= 0 && q <= 50 && absPos(op, q) === a) { op.tok[j] = -1; again = true; msg = '¡Te comes una ficha ' + COLORS[op.c].name.toLowerCase() + '!'; Q.vibrate(30); }
          });
        });
      }
    }
    if (p === FINISH) { again = true; msg = '¡Ficha en la meta!'; }
    drawTokens();
    if (pl.tok.every(function (x) { return x === FINISH; })) { G.over = true; win(pl); return; }
    if (again) { updateHud(msg || 'Sacaste 6: vuelves a tirar'); later(nextTurnStart, 700); }
    else { if (msg) updateHud(msg); later(passTurn, msg ? 700 : 250); }
  }

  function passTurn() {
    G.sixes = 0;
    G.turn = (G.turn + 1) % G.players.length;
    nextTurnStart();
  }

  function win(pl) {
    var col = COLORS[pl.c];
    updateHud('¡Ha ganado!');
    var wins = Q.store.get('parchis_wins', 0);
    if (!pl.ai) Q.store.set('parchis_wins', wins + 1);
    Q.modal({
      title: '¡Gana ' + col.name + '!', body: pl.ai ? 'La IA ha llegado primero. ¡A por la revancha!' : '¡Enhorabuena! Todas tus fichas están en la meta.',
      buttons: [{ label: 'Configurar' , onClick: showSetup }, { label: 'Revancha', primary: true, onClick: startGame }]
    });
  }

  /* ---------- IA ---------- */
  function danger(pl, p) {
    if (p < 0 || p > 50) return 0;
    var a = absPos(pl, p);
    if (SAFE.indexOf(a) !== -1) return 0;
    var n = 0;
    G.players.forEach(function (op) {
      if (op === pl) return;
      op.tok.forEach(function (q) {
        if (q < 0 || q > 50) return;
        var dist = (a - absPos(op, q) + 52) % 52;
        if (dist >= 1 && dist <= 6 && q + dist <= 50) n++;
      });
    });
    return n;
  }

  function aiChoose(pl, d) {
    var best = G.legal[0], bestScore = -Infinity;
    G.legal.forEach(function (k) {
      var p = pl.tok[k], np = p < 0 ? 0 : p + d, s = 0;
      if (np === FINISH) s += 1000;
      if (p < 0) s += 400;
      if (np <= 50) {
        var a = absPos(pl, np);
        if (SAFE.indexOf(a) === -1) G.players.forEach(function (op) {
          if (op === pl) return;
          op.tok.forEach(function (q) { if (q >= 0 && q <= 50 && absPos(op, q) === a) s += 600 + q * 4; });
        });
        if (SAFE.indexOf(a) !== -1) s += 80;
      }
      if (np > 50 && p <= 50) s += 250;
      s -= danger(pl, np) * 160;
      s += danger(pl, p) * 120;
      s += np * 1.5;
      s += Math.random() * 10;
      if (s > bestScore) { bestScore = s; best = k; }
    });
    return best;
  }

  Q.register('parchis', {
    title: 'Parchís', subtitle: '2-4 jugadores, personas o IA', icon: '🎲',
    color: 'linear-gradient(145deg,#ff3b4e,#b5102a)',
    progressText: function () { var w = Q.store.get('parchis_wins', 0); return w ? w + ' victoria' + (w > 1 ? 's' : '') : 'Dado automático'; },
    mount: mount, unmount: clearTimers
  });
})();
