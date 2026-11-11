/* Reversi — tablero 8×8, contra la IA (niveles) o 2 jugadores */
(function () {
  'use strict';
  var DIRS = [-9, -8, -7, -1, 1, 7, 8, 9];
  var W = [
    120, -20, 20, 5, 5, 20, -20, 120,
    -20, -40, -5, -5, -5, -5, -40, -20,
    20, -5, 15, 3, 3, 15, -5, 20,
    5, -5, 3, 3, 3, 3, -5, 5,
    5, -5, 3, 3, 3, 3, -5, 5,
    20, -5, 15, 3, 3, 15, -5, 20,
    -20, -40, -5, -5, -5, -5, -40, -20,
    120, -20, 20, 5, 5, 20, -20, 120
  ];
  /* Niveles de IA: profundidad de búsqueda y % de jugadas al azar */
  var AI = [
    { d: 1, rnd: 0.6 }, { d: 1, rnd: 0.25 }, { d: 2, rnd: 0.1 }, { d: 3, rnd: 0 }, { d: 4, rnd: 0 },
    { d: 5, rnd: 0 }, { d: 6, rnd: 0 }, { d: 7, rnd: 0 }
  ];
  var NAMES = ['Novato', 'Aprendiz', 'Aficionado', 'Jugador', 'Experto', 'Maestro', 'Gran maestro', 'Leyenda'];

  function flipsFor(b, i, who) {
    if (b[i] !== 0) return null;
    var res = [], x = i % 8;
    for (var k = 0; k < 8; k++) {
      var d = DIRS[k], j = i + d, line = [], px = x;
      while (j >= 0 && j < 64) {
        var jx = j % 8;
        if (Math.abs(jx - px) > 1) break; // salto de fila
        if (b[j] === -who) { line.push(j); px = jx; j += d; continue; }
        if (b[j] === who && line.length) res = res.concat(line);
        break;
      }
    }
    return res.length ? res : null;
  }
  function moves(b, who) {
    var m = [];
    for (var i = 0; i < 64; i++) if (b[i] === 0 && flipsFor(b, i, who)) m.push(i);
    return m;
  }
  function apply(b, i, who) {
    var f = flipsFor(b, i, who), nb = b.slice();
    nb[i] = who; f.forEach(function (j) { nb[j] = who; });
    return { b: nb, f: f };
  }
  function evaluate(b, who) {
    var s = 0, empty = 0, mine = 0, theirs = 0;
    for (var i = 0; i < 64; i++) {
      if (b[i] === 0) { empty++; continue; }
      s += W[i] * b[i] * who;
      if (b[i] === who) mine++; else theirs++;
    }
    var mob = moves(b, who).length - moves(b, -who).length;
    if (empty < 12) s += (mine - theirs) * (12 - empty) * 2;
    return s + mob * 8;
  }
  function negamax(b, who, depth, alpha, beta, passed) {
    var ms = moves(b, who);
    if (!ms.length) {
      if (passed) { // fin de partida
        var diff = 0; for (var i = 0; i < 64; i++) diff += b[i] * who;
        return diff > 0 ? 10000 + diff : diff < 0 ? -10000 + diff : 0;
      }
      return -negamax(b, -who, depth, -beta, -alpha, true);
    }
    if (depth === 0) return evaluate(b, who);
    ms.sort(function (a, c) { return W[c] - W[a]; });
    var best = -Infinity;
    for (var k = 0; k < ms.length; k++) {
      var v = -negamax(apply(b, ms[k], who).b, -who, depth - 1, -beta, -alpha, false);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }
  function aiMove(b, who, lvl) {
    var cfg = AI[lvl - 1], ms = moves(b, who);
    if (Math.random() < cfg.rnd) return ms[Math.floor(Math.random() * ms.length)];
    var empty = b.filter(function (x) { return x === 0; }).length;
    var depth = empty <= 10 && lvl >= 5 ? Math.max(cfg.d, 10) : cfg.d;
    var best = ms[0], bv = -Infinity;
    Q.shuffle(ms).sort(function (a, c) { return W[c] - W[a]; });
    ms.forEach(function (m) {
      var v = -negamax(apply(b, m, who).b, -who, depth - 1, -Infinity, Infinity, false);
      if (v > bv) { bv = v; best = m; }
    });
    return best;
  }

  var root, prog, lvl, mode, S, boardEl, scoreEl, statusEl, aiTimer;

  function mount(app) {
    root = app;
    prog = Q.progress('reversi');
    lvl = Math.min(prog.data.last || 1, AI.length);
    mode = 'ai';
    build();
  }

  function build() {
    clearTimeout(aiTimer);
    root.innerHTML = '';
    root.appendChild(Q.topbar('Reversi', Q.helpButton('Cómo se juega',
      'Coloca una ficha de forma que <b>encierres</b> fichas rivales en línea recta (horizontal, vertical o diagonal) entre tu nueva ficha y otra tuya: las encerradas cambian a tu color.<br><br>' +
      'Si no puedes mover, pasas turno. Gana quien tenga más fichas al final.<br><br>' +
      'Los puntos claros indican dónde puedes jugar. Las <b>esquinas</b> son muy valiosas.<br><br>' +
      'Gana a la IA para desbloquear el siguiente nivel.')));
    root.appendChild(Q.el('div', { class: 'row center', style: { marginBottom: '10px' } },
      Q.seg([{ label: 'Contra IA', value: 'ai' }, { label: '2 jugadores', value: '2p' }], mode, function (v) { mode = v; build(); })));
    if (mode === 'ai') {
      prog.data.max = Math.min(prog.data.max, AI.length);
      root.appendChild(Q.levelBar(prog, lvl, function (n) { lvl = n; prog.setLast(n); newGame(); }, function (l) { return NAMES[l - 1]; }));
    }
    scoreEl = Q.el('div', { class: 'rv-score' });
    statusEl = Q.el('div', { class: 'status' });
    var size = Math.min(window.innerWidth - 32, window.innerHeight - 300, 560);
    boardEl = Q.el('div', { class: 'rv-board' });
    boardEl.style.setProperty('--bs', Math.max(size, 280) + 'px');
    root.appendChild(scoreEl);
    root.appendChild(boardEl);
    root.appendChild(statusEl);
    root.appendChild(Q.el('div', { class: 'row center' },
      Q.el('button', { class: 'btn', onclick: undo }, '↶ Deshacer'),
      Q.el('button', { class: 'btn', onclick: newGame }, 'Nueva partida')));
    newGame();
  }

  function newGame() {
    clearTimeout(aiTimer);
    var b = new Array(64).fill(0);
    b[27] = b[36] = -1; b[28] = b[35] = 1;
    S = { b: b, turn: 1, last: -1, flipped: [], hist: [], over: false };
    render();
  }

  function render() {
    var b = S.b, n1 = 0, n2 = 0;
    b.forEach(function (x) { if (x === 1) n1++; else if (x === -1) n2++; });
    scoreEl.innerHTML = '';
    var l1 = mode === 'ai' ? 'Tú' : 'J1', l2 = mode === 'ai' ? 'IA' : 'J2';
    scoreEl.appendChild(Q.el('span', { class: S.turn === 1 && !S.over ? 'turn' : '' }, Q.el('i', { class: 'd led', style: { background: '#ff3b4e', borderRadius: '50%' } }), l1 + ' ' + n1));
    scoreEl.appendChild(Q.el('span', { class: S.turn === -1 && !S.over ? 'turn' : '' }, Q.el('i', { class: 'd led', style: { background: '#2f8cff', borderRadius: '50%' } }), l2 + ' ' + n2));
    var legal = S.over || (mode === 'ai' && S.turn === -1) ? [] : moves(b, S.turn);
    boardEl.innerHTML = '';
    for (var i = 0; i < 64; i++) (function (i) {
      var cell = Q.el('div', { class: 'rv-cell' + (i === S.last ? ' last' : '') });
      if (b[i]) cell.appendChild(Q.el('div', { class: 'disc led ' + (b[i] === 1 ? 'b' : 'w') + (S.flipped.indexOf(i) !== -1 ? ' flip' : '') }));
      else if (legal.indexOf(i) !== -1) cell.appendChild(Q.el('div', { class: 'hint' }));
      cell.onclick = function () { humanMove(i); };
      boardEl.appendChild(cell);
    })(i);
    if (S.over) {
      statusEl.textContent = n1 > n2 ? (mode === 'ai' ? '¡Has ganado!' : '¡Gana J1!') : n2 > n1 ? (mode === 'ai' ? 'Gana la IA' : '¡Gana J2!') : 'Empate';
    } else if (mode === 'ai') statusEl.textContent = S.turn === 1 ? 'Tu turno' : 'La IA está pensando…';
    else statusEl.textContent = 'Turno de ' + (S.turn === 1 ? 'J1 (rojo)' : 'J2 (azul)');
  }

  function humanMove(i) {
    if (S.over || (mode === 'ai' && S.turn !== 1)) return;
    if (!flipsFor(S.b, i, S.turn)) return;
    play(i);
  }

  function play(i) {
    S.hist.push({ b: S.b.slice(), turn: S.turn, last: S.last });
    var r = apply(S.b, i, S.turn);
    S.b = r.b; S.flipped = r.f; S.last = i;
    Q.vibrate(10);
    advance();
  }

  function advance() {
    var next = -S.turn;
    if (moves(S.b, next).length) S.turn = next;
    else if (moves(S.b, S.turn).length) {
      Q.toast((next === 1 ? (mode === 'ai' ? 'No puedes mover' : 'J1 no puede mover') : (mode === 'ai' ? 'La IA no puede mover' : 'J2 no puede mover')) + ': pasa turno');
    } else { S.over = true; render(); finish(); return; }
    render();
    if (mode === 'ai' && S.turn === -1) aiTimer = setTimeout(function () {
      var m = aiMove(S.b, -1, lvl);
      play(m);
    }, 450);
  }

  function undo() {
    clearTimeout(aiTimer);
    if (!S.hist.length) return;
    var h = S.hist.pop();
    // contra la IA, deshacer hasta tu último turno
    while (mode === 'ai' && h.turn !== 1 && S.hist.length) h = S.hist.pop();
    S.b = h.b; S.turn = h.turn; S.last = h.last; S.flipped = []; S.over = false;
    render();
  }

  function finish() {
    var n1 = 0, n2 = 0;
    S.b.forEach(function (x) { if (x === 1) n1++; else if (x === -1) n2++; });
    if (mode !== 'ai') {
      Q.modal({ title: n1 > n2 ? '¡Gana J1!' : n2 > n1 ? '¡Gana J2!' : 'Empate', body: n1 + ' – ' + n2,
        buttons: [{ label: 'Otra', primary: true, onClick: newGame }] });
      return;
    }
    if (n1 > n2) {
      var stars = n1 - n2 >= 30 ? 3 : n1 - n2 >= 10 ? 2 : 1;
      prog.complete(lvl, stars);
      var hasNext = lvl < AI.length;
      Q.modal({ title: '¡Victoria!', stars: stars, body: 'Has ganado ' + n1 + ' a ' + n2 + ' al nivel <b>' + NAMES[lvl - 1] + '</b>.',
        buttons: [{ label: 'Repetir', onClick: newGame }].concat(hasNext ? [{ label: 'Siguiente nivel', primary: true, onClick: function () { lvl++; prog.setLast(lvl); build(); } }] : []) });
    } else {
      Q.modal({ title: n1 === n2 ? 'Empate' : 'Gana la IA', body: n1 + ' – ' + n2 + '. Prueba a quedarte con las esquinas.',
        buttons: [{ label: 'Revancha', primary: true, onClick: newGame }] });
    }
  }

  Q.register('reversi', {
    title: 'Reversi', subtitle: 'Estrategia 8×8 contra la IA', icon: '⚪',
    color: 'linear-gradient(145deg,#2f8cff,#1645a8)',
    progressText: function () { var m = Math.min(Q.progress('reversi').data.max, 8); return 'IA: ' + NAMES[m - 1]; },
    mount: mount, unmount: function () { clearTimeout(aiTimer); }
  });
})();
