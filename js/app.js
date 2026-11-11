/* Quinteto — núcleo de la app: navegación, almacenamiento y utilidades comunes */
(function () {
  'use strict';

  var Q = window.Q = { games: {}, order: [] };
  var current = null; // juego montado

  /* ---------- Almacenamiento ---------- */
  Q.store = {
    get: function (k, d) {
      try { var v = localStorage.getItem('quinteto_' + k); return v == null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem('quinteto_' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ }
    }
  };

  /* Progreso por niveles: { max: nivel desbloqueado, stars: {nivel: estrellas}, last: último jugado } */
  Q.progress = function (game) {
    var p = Q.store.get('prog_' + game, null) || { max: 1, stars: {}, last: 1 };
    return {
      data: p,
      complete: function (lvl, stars) {
        p.stars[lvl] = Math.max(p.stars[lvl] || 0, stars || 1);
        if (lvl >= p.max) p.max = lvl + 1;
        Q.store.set('prog_' + game, p);
      },
      setLast: function (lvl) { p.last = lvl; Q.store.set('prog_' + game, p); }
    };
  };

  /* ---------- Azar con semilla (para niveles fijos) ---------- */
  Q.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  Q.shuffle = function (arr, rnd) {
    rnd = rnd || Math.random;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  /* ---------- DOM ---------- */
  Q.el = function (tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x != null) e.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); });
      else e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  };

  Q.starsText = function (n, max) {
    max = max || 3; var s = '';
    for (var i = 0; i < max; i++) s += i < n ? '★' : '☆';
    return s;
  };

  Q.vibrate = function (ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 15); } catch (e) {} };

  /* ---------- Modal y avisos ---------- */
  Q.modal = function (opts) {
    var root = document.getElementById('overlay-root');
    var ov = Q.el('div', { class: 'overlay' });
    var close = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); };
    var btns = Q.el('div', { class: 'row' });
    (opts.buttons || [{ label: 'Vale', primary: true }]).forEach(function (b) {
      btns.appendChild(Q.el('button', {
        class: 'btn' + (b.primary ? ' primary' : ''),
        onclick: function () { close(); if (b.onClick) b.onClick(); }
      }, b.label));
    });
    var body = Q.el('div', { class: 'body' });
    if (typeof opts.body === 'string') body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
    ov.appendChild(Q.el('div', { class: 'modal' },
      Q.el('h2', { text: opts.title || '' }),
      opts.stars != null ? Q.el('div', { class: 'stars', text: Q.starsText(opts.stars) }) : null,
      body, btns));
    root.appendChild(ov);
    return close;
  };

  var toastTimer;
  Q.toast = function (msg) {
    var old = document.querySelector('.toast'); if (old) old.remove();
    var t = Q.el('div', { class: 'toast', text: msg });
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 1800);
  };

  /* ---------- Componentes ---------- */
  Q.topbar = function (title, extra) {
    return Q.el('div', { class: 'topbar' },
      Q.el('button', { class: 'btn icon', 'aria-label': 'Volver', onclick: function () { location.hash = '#/'; } }, '‹'),
      Q.el('h1', { text: title }),
      extra || null);
  };

  Q.helpButton = function (title, html) {
    return Q.el('button', {
      class: 'btn icon', 'aria-label': 'Cómo se juega',
      onclick: function () { Q.modal({ title: title, body: '<div class="help" style="text-align:left">' + html + '</div>' }); }
    }, '?');
  };

  /* Barra para elegir nivel: ‹ Nivel N ›  (solo niveles desbloqueados) */
  Q.levelBar = function (prog, lvl, onChange, subtitle) {
    var lv = Q.el('div', { class: 'lv' });
    var prev = Q.el('button', { class: 'btn icon small', 'aria-label': 'Nivel anterior' }, '‹');
    var next = Q.el('button', { class: 'btn icon small', 'aria-label': 'Nivel siguiente' }, '›');
    function render() {
      var st = prog.data.stars[lvl] || 0;
      lv.innerHTML = '';
      lv.appendChild(document.createTextNode('Nivel ' + lvl));
      lv.appendChild(Q.el('small', null,
        Q.el('span', { class: 'stars', text: Q.starsText(st) }),
        subtitle ? ' · ' + subtitle(lvl) : ''));
      prev.disabled = lvl <= 1;
      next.disabled = lvl >= prog.data.max;
    }
    prev.onclick = function () { if (lvl > 1) { lvl--; render(); onChange(lvl); } };
    next.onclick = function () { if (lvl < prog.data.max) { lvl++; render(); onChange(lvl); } };
    render();
    var bar = Q.el('div', { class: 'levelbar' }, prev, lv, next);
    bar.refresh = function (n) { if (n != null) lvl = n; render(); };
    return bar;
  };

  Q.seg = function (options, value, onChange) {
    var wrap = Q.el('div', { class: 'seg' });
    options.forEach(function (o) {
      var b = Q.el('button', { class: o.value === value ? 'on' : '' }, o.label);
      b.onclick = function () {
        if (value === o.value) return;
        value = o.value;
        Array.prototype.forEach.call(wrap.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
        onChange(value);
      };
      wrap.appendChild(b);
    });
    return wrap;
  };

  /* ---------- Registro de juegos ---------- */
  Q.register = function (id, game) { Q.games[id] = game; Q.order.push(id); };

  function renderHome(app) {
    app.appendChild(Q.el('div', { class: 'home-head' },
      Q.el('h1', { text: 'QUINTETO' }),
      Q.el('p', { text: 'Cinco juegos de lógica en tu bolsillo' })));
    var grid = Q.el('div', { class: 'home-grid' });
    Q.order.forEach(function (id) {
      var g = Q.games[id];
      grid.appendChild(Q.el('button', {
        class: 'game-card', onclick: function () { location.hash = '#/' + id; }
      },
        Q.el('div', { class: 'gicon', style: { background: g.color } }, g.icon),
        Q.el('div', null,
          Q.el('h2', { text: g.title }),
          Q.el('p', { text: g.subtitle }),
          g.progressText ? Q.el('div', { class: 'prog', text: g.progressText() }) : null)));
    });
    app.appendChild(grid);
    app.appendChild(Q.el('div', { class: 'home-foot', text: 'Funciona sin conexión · tu progreso se guarda en este dispositivo' }));
  }

  function route() {
    var app = document.getElementById('app');
    if (current && current.unmount) { try { current.unmount(); } catch (e) {} }
    current = null;
    document.getElementById('overlay-root').innerHTML = '';
    app.innerHTML = '';
    window.scrollTo(0, 0);
    var id = (location.hash || '#/').replace(/^#\/?/, '');
    var g = Q.games[id];
    if (!g) { renderHome(app); return; }
    current = g;
    g.mount(app);
  }

  Q.start = function () {
    window.addEventListener('hashchange', route);
    route();
  };
})();
