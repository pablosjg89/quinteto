/* Descifra — adivina el código secreto de colores (estilo deducción) */
(function () {
  'use strict';
  var COLORS = ['var(--c0)', 'var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)'];
  var GLOW = ['#ff3b4e', '#2f8cff', '#2fd66b', '#ffd21f', '#b45cff', '#ff8a1f', '#ff6fcf', '#29e0e6'];

  /* Dificultad progresiva por nivel */
  function config(lvl) {
    var t = [
      [10, 3, 4, false, 8], [30, 3, 5, true, 8], [60, 4, 5, false, 9], [100, 4, 6, true, 10],
      [150, 5, 6, false, 10], [220, 5, 7, true, 11], [300, 6, 7, false, 12], [450, 6, 8, true, 12],
      [Infinity, 6, 8, true, 10]
    ];
    for (var i = 0; i < t.length; i++) if (lvl <= t[i][0]) return { len: t[i][1], colors: t[i][2], dup: t[i][3], tries: t[i][4] };
  }

  function randomCode(cfg) {
    var pool = []; for (var i = 0; i < cfg.colors; i++) pool.push(i);
    var code = [];
    for (var j = 0; j < cfg.len; j++) {
      if (cfg.dup) code.push(Math.floor(Math.random() * cfg.colors));
      else code.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return code;
  }

  function score(code, guess) {
    var hit = 0, near = 0, cc = {}, gc = {};
    for (var i = 0; i < code.length; i++) {
      if (code[i] === guess[i]) hit++;
      else { cc[code[i]] = (cc[code[i]] || 0) + 1; gc[guess[i]] = (gc[guess[i]] || 0) + 1; }
    }
    for (var k in gc) near += Math.min(gc[k], cc[k] || 0);
    return { hit: hit, near: near };
  }

  function peg(c, extraClass) {
    var d = Q.el('div', { class: 'dc-slot' + (c != null ? ' filled led' : '') + (extraClass || '') });
    if (c != null) { d.style.background = COLORS[c]; d.style.setProperty('--glow', GLOW[c] + '99'); }
    return d;
  }

  var root, prog, lvl, mode, st;

  function mount(app) {
    root = app;
    prog = Q.progress('descifra');
    lvl = prog.data.last || 1;
    mode = '1p';
    build();
  }
  var rzT = null;
  window.addEventListener('resize', function () {
    clearTimeout(rzT);
    rzT = setTimeout(function () { if (st && st.area && st.area.className === 'dc-juego' && st.area.isConnected) render(); }, 150);
  });

  function build() {
    root.innerHTML = '';
    root.appendChild(Q.topbar('Descifra', Q.helpButton('Cómo se juega',
      'Hay un <b>código secreto</b> de colores. Intenta adivinarlo en el menor número de intentos.<br><br>' +
      'Tras cada intento verás pistas:<br>● <b style="color:var(--good)">verde</b>: color correcto en su sitio.<br>' +
      '● <b>blanco</b>: el color está en el código pero en otra posición.<br><br>' +
      'Toca un color para rellenar el siguiente hueco y toca un hueco para vaciarlo.<br><br>' +
      'En <b>2 jugadores</b>, uno crea el código y el otro lo adivina; luego se cambian. Gana quien use menos intentos.')));
    root.appendChild(Q.el('div', { class: 'row center', style: { marginBottom: '10px' } },
      Q.seg([{ label: '1 jugador', value: '1p' }, { label: '2 jugadores', value: '2p' }], mode, function (v) { mode = v; build(); })));
    if (mode === '1p') {
      root.appendChild(Q.levelBar(prog, lvl, function (n) { lvl = n; prog.setLast(n); startRound(); }, function (l) {
        var c = config(l); return c.len + ' huecos · ' + c.colors + ' colores';
      }));
      st = { area: Q.el('div') };
      root.appendChild(st.area);
      startRound();
    } else {
      st = { area: Q.el('div'), duel: { round: 0, used: [null, null] } };
      root.appendChild(st.area);
      duelSetup();
    }
  }

  /* ---------- Partida (común a 1 y 2 jugadores) ---------- */
  function startRound(fixedCode, cfgOverride, onEnd) {
    var cfg = cfgOverride || config(lvl);
    st.cfg = cfg;
    st.code = fixedCode || randomCode(cfg);
    st.rows = [];
    st.cur = [];
    st.over = false;
    st.onEnd = onEnd || endSolo;
    render();
  }

  function render() {
    var cfg = st.cfg, a = st.area;
    a.innerHTML = '';
    a.className = 'dc-juego';
    a.appendChild(Q.el('div', { class: 'status' },
      (st.label ? st.label + ' · ' : '') + 'Intento ' + Math.min(st.rows.length + (st.over ? 0 : 1), cfg.tries) + ' de ' + cfg.tries));
    // Tamaño de las bolas según el ancho (fila = margen 20 + número 18 + huecos 20 + pistas 36 + borde 2)
    var ancho = Math.min(root.clientWidth || window.innerWidth, 560) - 32;
    var pegW = Math.floor((ancho - 96 - (cfg.len - 1) * 6) / cfg.len);
    a.style.setProperty('--peg', Math.max(24, Math.min(34, pegW)) + 'px');

    // Código secreto (oculto hasta terminar)
    var sec = Q.el('div', { class: 'dc-secret' });
    for (var s = 0; s < cfg.len; s++) {
      if (st.over) sec.appendChild(peg(st.code[s]));
      else sec.appendChild(Q.el('div', { class: 'dc-slot', style: { display: 'grid', placeItems: 'center', color: 'var(--muted)', fontWeight: 700 } }, '?'));
    }
    a.appendChild(sec);

    var board = Q.el('div', { class: 'dc-board' });
    for (var r = 0; r < cfg.tries; r++) {
      var row = st.rows[r], isCur = !st.over && r === st.rows.length;
      var slots = Q.el('div', { class: 'dc-slots' });
      for (var i = 0; i < cfg.len; i++) {
        var c = row ? row.guess[i] : (isCur ? st.cur[i] : null);
        var p = peg(c);
        if (isCur) (function (idx) { p.onclick = function () { if (st.cur[idx] != null) { st.cur[idx] = null; render(); } }; })(i);
        slots.appendChild(p);
      }
      var fb = Q.el('div', { class: 'dc-fb', style: { gridTemplateColumns: 'repeat(' + Math.ceil(cfg.len / 2) + ', 10px)' } });
      for (var f = 0; f < cfg.len; f++) {
        var cls = '';
        if (row) cls = f < row.res.hit ? 'hit' : (f < row.res.hit + row.res.near ? 'near' : '');
        fb.appendChild(Q.el('i', { class: cls }));
      }
      board.appendChild(Q.el('div', { class: 'dc-row' + (isCur ? ' current' : '') },
        Q.el('span', { class: 'num', text: String(r + 1) }), slots, fb));
    }
    a.appendChild(board);

    if (!st.over) {
      var ctl = Q.el('div', { class: 'dc-controls' });
      a.appendChild(ctl);
      ctl.appendChild(Q.el('div', { class: 'dc-legend' },
        Q.el('span', null, Q.el('i', { style: { background: 'var(--good)' } }), 'en su sitio'),
        Q.el('span', null, Q.el('i', { style: { background: '#fff' } }), 'en otra posición'),
        Q.el('span', null, cfg.dup ? 'Se repiten colores' : 'Sin repetir colores')));
      var pal = Q.el('div', { class: 'dc-palette' });
      var lado = Math.max(30, Math.min(46, Math.floor((ancho - (cfg.colors - 1) * 8) / cfg.colors)));
      pal.style.setProperty('--col', lado + 'px');
      for (var k = 0; k < cfg.colors; k++) (function (k) {
        var b = Q.el('button', { class: 'dc-color led', 'aria-label': 'Color ' + (k + 1) });
        b.style.background = COLORS[k]; b.style.setProperty('--glow', GLOW[k] + '88');
        b.onclick = function () { addColor(k); };
        pal.appendChild(b);
      })(k);
      ctl.appendChild(pal);
      var full = countFilled() === cfg.len;
      ctl.appendChild(Q.el('div', { class: 'row center' },
        Q.el('button', { class: 'btn', onclick: function () { st.cur = []; render(); } }, 'Borrar'),
        Q.el('button', { class: 'btn primary', disabled: !full, onclick: submit }, 'Comprobar')));
    }
    ajustar(board);
  }

  /* Encaja la partida en la pantalla: todas las filas caben o se desplazan
     dentro del tablero, y los controles nunca tapan ninguna fila */
  function ajustar(board) {
    var a = st.area;
    a.style.height = '';
    var top = a.getBoundingClientRect().top + (window.scrollY || 0);
    var padB = parseFloat(getComputedStyle(root).paddingBottom) || 0;
    a.style.height = Math.max(360, Math.floor(window.innerHeight - top - padB)) + 'px';
    // Si sobra altura, no hace falta encoger; si falta, bolas algo más pequeñas (mínimo 28 px) y el tablero se desplaza
    var fila = board.firstChild ? board.firstChild.offsetHeight + 5 : 0;
    if (fila) {
      var pegAct = parseFloat(a.style.getPropertyValue('--peg')) || 34;
      var cabe = Math.floor(board.clientHeight / st.cfg.tries) - (fila - pegAct);
      if (cabe < pegAct) a.style.setProperty('--peg', Math.max(28, cabe) + 'px');
    }
    var cur = board.querySelector('.current') || board.children[Math.max(0, st.rows.length - 1)];
    if (cur) board.scrollTop = Math.max(0, cur.offsetTop - board.offsetTop - board.clientHeight + cur.offsetHeight + 8);
  }

  function countFilled() { var n = 0; for (var i = 0; i < st.cfg.len; i++) if (st.cur[i] != null) n++; return n; }

  function addColor(k) {
    for (var i = 0; i < st.cfg.len; i++) if (st.cur[i] == null) { st.cur[i] = k; Q.vibrate(8); render(); return; }
  }

  function submit() {
    var g = st.cur.slice(0, st.cfg.len);
    var res = score(st.code, g);
    st.rows.push({ guess: g, res: res });
    st.cur = [];
    var won = res.hit === st.cfg.len;
    if (won || st.rows.length >= st.cfg.tries) { st.over = true; render(); setTimeout(function () { st.onEnd(won, st.rows.length); }, 350); }
    else render();
  }

  function endSolo(won, used) {
    if (won) {
      var ratio = used / st.cfg.tries;
      var stars = ratio <= 0.45 ? 3 : ratio <= 0.75 ? 2 : 1;
      prog.complete(lvl, stars);
      Q.modal({
        title: '¡Código descifrado!', stars: stars,
        body: 'Lo has conseguido en <b>' + used + '</b> intento' + (used > 1 ? 's' : '') + '.',
        buttons: [{ label: 'Repetir', onClick: function () { startRound(); } },
          { label: 'Siguiente nivel', primary: true, onClick: function () { lvl++; prog.setLast(lvl); build(); } }]
      });
    } else {
      Q.modal({
        title: 'Sin intentos', body: 'El código era el que ves arriba. ¡Inténtalo otra vez!',
        buttons: [{ label: 'Reintentar', primary: true, onClick: function () { startRound(); } }]
      });
    }
  }

  /* ---------- Modo 2 jugadores ---------- */
  var DUEL_CFG = { len: 4, colors: 6, dup: true, tries: 10 };

  function duelSetup() {
    var d = st.duel, maker = d.round === 0 ? 1 : 2, breaker = maker === 1 ? 2 : 1;
    var secret = [];
    var a = st.area;
    function draw() {
      a.innerHTML = '';
      a.className = '';
      a.style.height = '';
      a.appendChild(Q.el('div', { class: 'status', text: 'Jugador ' + maker + ': crea el código secreto. ¡Que no mire el jugador ' + breaker + '!' }));
      var sec = Q.el('div', { class: 'dc-secret' });
      a.style.setProperty('--peg', '44px');
      for (var i = 0; i < DUEL_CFG.len; i++) (function (i) {
        var p = peg(secret[i]); p.onclick = function () { secret[i] = null; draw(); }; sec.appendChild(p);
      })(i);
      a.appendChild(sec);
      var pal = Q.el('div', { class: 'dc-palette' });
      for (var k = 0; k < DUEL_CFG.colors; k++) (function (k) {
        var b = Q.el('button', { class: 'dc-color led' }); b.style.background = COLORS[k];
        b.onclick = function () { for (var i = 0; i < DUEL_CFG.len; i++) if (secret[i] == null) { secret[i] = k; break; } draw(); };
        pal.appendChild(b);
      })(k);
      a.appendChild(pal);
      var full = secret.filter(function (x) { return x != null; }).length === DUEL_CFG.len;
      a.appendChild(Q.el('div', { class: 'row center' },
        Q.el('button', { class: 'btn', onclick: function () {
          secret = randomCode(DUEL_CFG); draw();
        } }, 'Al azar'),
        Q.el('button', { class: 'btn primary', disabled: !full, onclick: function () {
          Q.modal({
            title: 'Código guardado', body: 'Pasa el dispositivo al <b>jugador ' + breaker + '</b>.',
            buttons: [{ label: '¡Listo!', primary: true, onClick: function () {
              st.label = 'Jugador ' + breaker + ' adivina';
              startRound(secret.slice(), DUEL_CFG, function (won, used) { st.label = null; duelEnd(won ? used : DUEL_CFG.tries + 1); });
            } }]
          });
        } }, 'Ocultar código')));
    }
    draw();
  }

  function duelEnd(score) {
    var d = st.duel;
    d.used[d.round] = score;
    var breaker = d.round === 0 ? 2 : 1;
    var txt = score > DUEL_CFG.tries ? 'no lo ha descifrado' : 'lo ha descifrado en <b>' + score + '</b> intentos';
    if (d.round === 0) {
      Q.modal({
        title: 'Ronda 1 terminada', body: 'El jugador ' + breaker + ' ' + txt + '.<br>Ahora se cambian los papeles.',
        buttons: [{ label: 'Ronda 2', primary: true, onClick: function () { d.round = 1; duelSetup(); } }]
      });
    } else {
      var p2 = d.used[0], p1 = d.used[1];
      var winner = p1 < p2 ? '¡Gana el jugador 1!' : p2 < p1 ? '¡Gana el jugador 2!' : '¡Empate!';
      Q.modal({
        title: winner,
        body: 'Jugador 1: ' + (p1 > DUEL_CFG.tries ? 'no lo descifró' : p1 + ' intentos') +
          '<br>Jugador 2: ' + (p2 > DUEL_CFG.tries ? 'no lo descifró' : p2 + ' intentos'),
        buttons: [{ label: 'Otra partida', primary: true, onClick: function () { st.duel = { round: 0, used: [null, null] }; duelSetup(); } }]
      });
    }
  }

  Q.register('descifra', {
    title: 'Descifra', subtitle: 'Adivina el código de colores', icon: '🔐',
    color: 'linear-gradient(145deg,#b45cff,#5b2bd6)',
    progressText: function () { var p = Q.progress('descifra').data; return 'Nivel ' + p.max + ' · 1-2 jugadores'; },
    mount: mount, unmount: function () {}
  });
})();
