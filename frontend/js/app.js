/* Gullak frontend. Talks to the PHP API in ../backend/api/ */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s),
    $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const API_BASE = '../backend/api/';
  async function api(path, opt) {
    opt = opt || {};
    const m = opt.method || 'GET';
    let r;
    try {
      r = await fetch(API_BASE + path, {
        method: m,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: m === 'GET' ? undefined : JSON.stringify(opt.body || {}),
      });
    } catch (e) {
      throw new Error('Cannot reach the server. Check that PHP and MySQL are running.');
    }
    let j = {};
    try {
      j = await r.json();
    } catch (e) {}
    if (r.status === 401 && user && path.indexOf('auth.php') !== 0) {
      user = null;
      data = null;
      showAuth('login');
    }
    if (!r.ok) throw new Error(j.error || 'Request failed (' + r.status + ')');
    return j;
  }
  const esc = s =>
    String(s).replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const P = {
    dash: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    jar: '<path d="M8 3h8M9 3v3c0 1-3 2-3 5v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8c0-3-3-4-3-5V3"/>',
    doc: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    out: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  };
  const ico = n =>
    `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
  const VIEWS = [
    ['home', 'Home', 'dash'],
    ['ledger', 'Ledger', 'list'],
    ['jars', 'Jars', 'jar'],
    ['month', 'Month', 'doc'],
  ];
  const MONEY = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
  const money = n => MONEY.format(n),
    sum = o => Object.values(o).reduce((a, b) => a + b, 0);
  const KW = {
    Groceries: /grocer|vegetable|fruit|milk|bigbasket|blinkit|zepto|supermarket|kirana/,
    Dining: /dinner|lunch|breakfast|swiggy|zomato|coffee|cafe|restaurant|snack|pizza|chai/,
    Transport: /uber|ola|auto|cab|metro|fuel|petrol|bus|train|rapido/,
    Housing: /rent|maintenance|society/,
    Utilities: /electric|water|wifi|broadband|recharge|bill|gas/,
    Health: /doctor|pharmacy|medicine|gym|clinic/,
    Shopping: /amazon|flipkart|clothes|shopping|myntra|shoes/,
    Entertainment: /movie|netflix|spotify|concert|game|prime/,
    Education: /course|book|tuition|udemy|exam/,
  };
  let user = null,
    data = null,
    view = 'home',
    month = ym(new Date()),
    selDay = '',
    filt = { q: '', type: 'all', cat: 'all', range: 'month' },
    lastAdded = null;
  function ym(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  const addM = (m, n) => {
    const p = m.split('-');
    return ym(new Date(+p[0], +p[1] - 1 + n, 1));
  };
  const mLabel = (m, s) => {
    const p = m.split('-');
    return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString(
      'en-IN',
      s ? { month: 'short' } : { month: 'long', year: 'numeric' }
    );
  };
  const dLabel = (s, short) => {
    const p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(
      'en-IN',
      short
        ? { day: 'numeric', month: 'short' }
        : { day: 'numeric', month: 'short', year: 'numeric' }
    );
  };
  const todayStr = () => {
    const d = new Date();
    return ym(d) + '-' + String(d.getDate()).padStart(2, '0');
  };
  const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const catColor = n => {
    const a = data.cats.expense.concat(data.cats.income).find(c => c.name === n);
    return a ? a.color : '#7b83a8';
  };
  const budgetsFor = m => {
    const ks = Object.keys(data.budgets)
      .filter(k => k <= m)
      .sort();
    return ks.length ? data.budgets[ks[ks.length - 1]] : {};
  };
  const txOf = m => data.txns.filter(t => t.date.slice(0, 7) === m);
  const totals = l => {
    let i = 0,
      e = 0;
    l.forEach(t => (t.type === 'income' ? (i += t.amount) : (e += t.amount)));
    return { inc: i, exp: e, net: i - e };
  };
  const byCat = l => {
    const o = {};
    l.forEach(t => {
      if (t.type === 'expense') o[t.category] = (o[t.category] || 0) + t.amount;
    });
    return o;
  };
  const status = (s, l) => (!l ? 'none' : s / l > 1 ? 'over' : s / l >= 0.8 ? 'warn' : 'ok');
  const ST = { ok: 'On track', warn: 'Nearly full', over: 'Overflowing', none: 'No limit' };
  function toast(m, undo) {
    const t = $('#toast');
    t.innerHTML = esc(m) + (undo ? '<button data-act="undo">Undo</button>' : '');
    t.classList.add('on');
    clearTimeout(toast.h);
    toast.h = setTimeout(() => t.classList.remove('on'), undo ? 5000 : 2200);
  }
  function countUp(root) {
    $$('[data-count]', root).forEach(el => {
      const to = +el.dataset.count;
      if (RM) {
        el.textContent = money(to);
        return;
      }
      const t0 = performance.now();
      (function f(t) {
        const k = Math.min(1, (t - t0) / 800),
          e = 1 - Math.pow(1 - k, 4);
        el.textContent = money(k < 1 ? Math.round(to * e) : to);
        if (k < 1) requestAnimationFrame(f);
      })(t0);
    });
  }
  function fillJars(root) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        $$('.liq[data-y]', root).forEach(e => {
          e.style.transform = `translateY(${e.dataset.y}px)`;
        })
      )
    );
  }

  /* ---------- jar ---------- */
  const JP = 'M30 12h40v6c0 5 12 8 12 20v76c0 8-6 12-14 12H32c-8 0-14-4-14-12V38c0-12 12-15 12-20z';
  const jarY = (s, l) => (l ? (s <= 0 ? 136 : 128 - Math.min(1.03, s / l) * 108) : 136);
  function jar(s, l, col, id) {
    const st = status(s, l),
      c = st === 'over' ? 'var(--chili)' : col;
    return `<svg class="jar ${st === 'over' ? 'over' : ''}" viewBox="0 0 100 134" aria-hidden="true"><defs><clipPath id="jc${id}"><path d="${JP}"/></clipPath></defs><g clip-path="url(#jc${id})"><rect x="0" y="0" width="100" height="134" fill="var(--bg)" opacity=".55"/><g class="liq" data-y="${jarY(s, l)}" style="transform:translateY(136px)"><path class="wave" fill="${c}" d="M0 6q12.5-9 25 0t25 0 25 0 25 0 25 0 25 0 25 0 25 0V150H0z"/></g></g><path d="${JP}" fill="none" stroke="var(--edge)" stroke-width="3.5" stroke-linejoin="round"/><rect x="26" y="3" width="48" height="11" rx="4" fill="var(--lid)"/></svg>`;
  }
  function jarCard(n, s, l, col, i) {
    const st = status(s, l);
    return `<button class="jarcard rise ${st === 'over' ? 'over' : ''}" style="--i:${i}" data-act="limit" data-cat="${esc(n)}" aria-label="${esc(n)}: ${money(s)} spent. Set limit">${jar(s, l, col, 'c' + i)}<b>${esc(n)}</b><span class="num">${money(s)}${l ? ' / ' + money(l) : ''}</span><em class="pill ${st === 'none' ? '' : st}">${l ? Math.round((s / l) * 100) + '% · ' + ST[st] : 'Set a limit'}</em></button>`;
  }

  /* ---------- auth ---------- */
  function showAuth(mode) {
    $('#app').hidden = true;
    const a = $('#auth'),
      su = mode === 'signup';
    a.hidden = false;
    a.innerHTML = `<section class="a-l"><div class="brand">Gullak</div><div style="display:flex;flex-direction:column;gap:14px"><h1>Every rupee,<br>in its jar.</h1><p style="opacity:.9">Log spending, fill monthly jars, watch the level rise. Type a password and see the jar fill.</p></div><div id="a-jar">${jar(0, 12, '#ffb627', 'a')}</div></section>
 <section class="a-r"><div><h2 class="d" style="font-size:22px">${su ? 'Open your gullak' : 'Welcome back'}</h2><p class="muted" style="margin-top:4px">${su ? 'Takes under a minute.' : 'Log in to see your month.'}</p></div>
 <form id="auth-form" novalidate>${su ? '<div class="field"><label class="lbl" for="a-name">Name</label><input id="a-name" type="text" autocomplete="name" maxlength="80"></div>' : ''}
 <div class="field"><label class="lbl" for="a-email">Email</label><input id="a-email" type="email" autocomplete="email"></div>
 <div class="field"><label class="lbl" for="a-pw">Password</label><input id="a-pw" type="password" autocomplete="${su ? 'new-password' : 'current-password'}" placeholder="${su ? '6+ characters' : ''}"></div>
 <div class="err" id="a-err" role="alert"></div><button class="btn btn-gold" id="a-go" style="justify-content:center">${su ? 'Create account' : 'Log in'}</button></form>
 <p class="fine">${su ? 'Already registered? ' : 'New here? '}<button class="link" data-act="auth-toggle" data-mode="${su ? 'login' : 'signup'}">${su ? 'Log in' : 'Create an account'}</button></p></section>`;
    fillJars(a);
    $('#a-pw').addEventListener('input', e => {
      const l = Math.min(12, e.target.value.length),
        el = $('#a-jar .liq');
      el.style.transform = `translateY(${jarY(l, 12)}px)`;
    });
    $('#auth-form').addEventListener('submit', e => {
      e.preventDefault();
      doAuth(su);
    });
  }
  async function doAuth(su) {
    const email = $('#a-email').value.trim().toLowerCase(),
      pw = $('#a-pw').value,
      err = $('#a-err'),
      go = $('#a-go');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      err.textContent = 'Enter a valid email address.';
      return;
    }
    if (pw.length < 6) {
      err.textContent = 'Password must be at least 6 characters.';
      return;
    }
    const name = su ? $('#a-name').value.trim() : '';
    if (su && !name) {
      err.textContent = 'Enter your name.';
      return;
    }
    err.textContent = '';
    go.disabled = true;
    try {
      const r = await api('auth.php?action=' + (su ? 'register' : 'login'), {
        method: 'POST',
        body: { name, email, password: pw },
      });
      await login(r.user);
    } catch (e) {
      err.textContent = e.message;
      go.disabled = false;
    }
  }
  async function loadData() {
    data = await api('data.php');
  }
  async function login(u) {
    user = u;
    await loadData();
    month = ym(new Date());
    view = 'home';
    selDay = '';
    boot();
  }
  async function logout() {
    try {
      await api('auth.php?action=logout', { method: 'POST' });
    } catch (e) {}
    user = null;
    data = null;
    showAuth('login');
  }
  function seedDemo() {
    const d = { txns: [], budgets: {} },
      now = new Date();
    let s = 11,
      n = 1;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647,
      pick = a => a[Math.floor(rnd() * a.length)];
    const add = (date, type, category, amt, note) =>
      d.txns.push({ id: 's' + n++, date, type, category, amount: Math.round(amt), note });
    for (let k = 5; k >= 0; k--) {
      const b = new Date(now.getFullYear(), now.getMonth() - k, 1),
        y = b.getFullYear(),
        m = b.getMonth(),
        last = new Date(y, m + 1, 0).getDate(),
        mx = k === 0 ? now.getDate() : last,
        ds = x => `${y}-${String(m + 1).padStart(2, '0')}-${String(x).padStart(2, '0')}`;
      add(ds(1), 'income', 'Salary', 85000, 'Monthly salary');
      if (mx >= 5) add(ds(5), 'expense', 'Housing', 18000, 'Rent');
      if (mx >= 7) add(ds(7), 'expense', 'Utilities', 1800 + rnd() * 900, 'Electricity and water');
      if (mx >= 9) add(ds(9), 'expense', 'Utilities', 699, 'Broadband');
      if (mx >= 18 && rnd() > 0.45)
        add(ds(18), 'income', 'Freelance', 6000 + rnd() * 9000, 'Freelance project');
      for (let x = 2; x <= mx; x += 3)
        add(
          ds(x),
          'expense',
          'Groceries',
          450 + rnd() * 1000,
          pick(['Vegetables and fruit', 'Supermarket run', 'Weekly groceries', 'Milk and bread'])
        );
      for (let x = 3; x <= mx; x += 5)
        add(
          ds(x),
          'expense',
          'Dining',
          250 + rnd() * 750,
          pick(['Lunch with friends', 'Dinner out', 'Coffee and snacks', 'Takeaway'])
        );
      for (let x = 4; x <= mx; x += 4)
        add(
          ds(x),
          'expense',
          'Transport',
          80 + rnd() * 420,
          pick(['Auto fare', 'Metro top-up', 'Fuel', 'Cab ride'])
        );
      if (mx >= 12)
        add(
          ds(12),
          'expense',
          'Shopping',
          1200 + rnd() * 3200,
          pick(['Clothes', 'Headphones', 'Home items'])
        );
      if (mx >= 15)
        add(
          ds(15),
          'expense',
          'Entertainment',
          400 + rnd() * 1400,
          pick(['Movie night', 'Streaming plans', 'Concert ticket'])
        );
      if (mx >= 21 && rnd() > 0.5) add(ds(21), 'expense', 'Health', 500 + rnd() * 1400, 'Pharmacy');
    }
    d.budgets[ym(new Date(now.getFullYear(), now.getMonth() - 5, 1))] = {
      Housing: 18000,
      Groceries: 9000,
      Dining: 4500,
      Transport: 3500,
      Utilities: 3000,
      Shopping: 4000,
      Entertainment: 2500,
      Health: 2000,
    };
    return d;
  }

  /* ---------- shell ---------- */
  function boot() {
    $('#auth').hidden = true;
    const a = $('#app');
    a.hidden = false;
    a.innerHTML = `<header class="top"><div class="brand"><svg viewBox="0 0 100 134" width="22" height="29" aria-hidden="true"><path d="${JP}" fill="var(--gold)" stroke="var(--edge)" stroke-width="7"/><rect x="26" y="3" width="48" height="11" rx="4" fill="var(--lid)"/></svg>Gullak</div><nav class="dock" id="nav" aria-label="Sections"></nav><div class="who"><span class="av" title="${esc(user.name)}">${esc(user.name[0].toUpperCase())}</span><button class="icon-btn" data-act="logout" aria-label="Log out">${ico('out')}</button></div></header>
 <div class="bar2"><div class="months" id="months"></div><button class="btn btn-gold" data-act="add">+ Add<span class="hide-s">&nbsp;transaction</span></button></div><main id="main"></main>`;
    render();
  }
  function render() {
    $('#nav').innerHTML = VIEWS.map(
      v =>
        `<button data-act="nav" data-view="${v[0]}"${v[0] === view ? ' aria-current="page"' : ''}>${ico(v[2])}<span>${v[1]}</span></button>`
    ).join('');
    const cur = ym(new Date()),
      end = month > cur ? month : cur,
      ml = $('#months');
    let h = '';
    for (let i = 11; i >= 0; i--) {
      const m = addM(end, -i);
      h += `<button class="chip" data-act="goto" data-m="${m}"${m === month ? ' aria-current="true"' : ''}><b>${mLabel(m, 1)}</b><i>${m.slice(0, 4)}</i></button>`;
    }
    ml.innerHTML = h;
    const on = $('.chip[aria-current=true]', ml);
    if (on) ml.scrollLeft = on.offsetLeft - ml.clientWidth / 2 + on.clientWidth / 2;
    const m = $('#main');
    m.innerHTML =
      view === 'home'
        ? vHome()
        : view === 'ledger'
          ? vLedger()
          : view === 'jars'
            ? vJars()
            : vMonth();
    countUp(m);
    fillJars(m);
  }

  /* ---------- quick add ---------- */
  function parseQuick(s) {
    s = s.trim();
    const m = s.match(/(\d[\d,]*\.?\d*)/);
    if (!m) return null;
    const amt = parseFloat(m[1].replace(/,/g, '')),
      inc = /^\+/.test(s),
      low = s.toLowerCase();
    if (!(amt > 0)) return null;
    let cat = 'Other';
    if (inc)
      cat = /salary|stipend/.test(low)
        ? 'Salary'
        : /freelance|client/.test(low)
          ? 'Freelance'
          : /interest|dividend/.test(low)
            ? 'Investments'
            : 'Other';
    else
      for (const k in KW)
        if (KW[k].test(low)) {
          cat = k;
          break;
        }
    return {
      type: inc ? 'income' : 'expense',
      amount: amt,
      category: cat,
      note: s.replace(m[0], '').replace(/^\+/, '').trim(),
      date: todayStr(),
    };
  }
  const quick = () =>
    `<div class="qa rise" style="--i:1"><label class="lbl" for="qa">Quick add</label><div class="qa-row"><input id="qa" type="text" placeholder="Type “450 dinner with friends” or “+85000 salary” and press Enter" autocomplete="off"></div><div class="qa-prev fine" id="qa-prev">Amount first, then a note. Start with + for income. Press N anywhere for the full form.</div></div>`;

  /* ---------- home ---------- */
  function vHome() {
    if (!data.txns.length)
      return `<div class="card empty rise"><h2>Your gullak is empty</h2><p>Add a transaction, or load sample data to see the jars fill up.</p><div class="head-actions"><button class="btn btn-gold" data-act="add">+ Add transaction</button><button class="btn" data-act="load-sample">Load sample data</button></div></div>${quick()}`;
    const l = txOf(month),
      T = totals(l),
      cats = byCat(l),
      B = budgetsFor(month),
      tb = sum(B),
      now = new Date(),
      isCur = month === ym(now),
      p = month.split('-'),
      dim = new Date(+p[0], +p[1], 0).getDate();
    const dayN = isCur ? now.getDate() : dim,
      left = dim - dayN + 1,
      rem = tb - T.exp,
      usedRaw = tb ? (T.exp / tb) * 100 : 0,
      el = (dayN / dim) * 100;
    const useSafe = isCur && tb > 0,
      big = useSafe ? Math.max(0, rem) / left : T.net;
    const sub = useSafe
      ? rem < 0
        ? `You are ${money(-rem)} over your jars with ${left} day${left > 1 ? 's' : ''} left.`
        : `${money(rem)} left across your jars for ${left} more day${left > 1 ? 's' : ''}.`
      : `Income ${money(T.inc)} minus spending ${money(T.exp)}.`;
    const verdict = !tb
      ? 'Set jar limits to unlock pace'
      : usedRaw > el + 5 && isCur
        ? 'Spending ahead of the calendar'
        : 'On pace';
    const hero = `<section class="hero rise"><div><span class="kick">${useSafe ? 'Safe to spend today' : 'Net for ' + mLabel(month)}</span><div class="mega num" data-count="${Math.round(big)}">${money(0)}</div><p>${sub}</p></div>
 <div class="hero-r"><div class="hs"><div><span>Income</span><b class="num">${money(T.inc)}</b></div><div><span>Spent</span><b class="num">${money(T.exp)}</b></div></div>
 <div><div class="pace-bar" role="img" aria-label="Budget used ${Math.round(usedRaw)} percent, month elapsed ${Math.round(el)} percent"><i style="width:0" data-w="${Math.min(100, usedRaw)}"></i><u style="left:calc(${el}% - 1px)"></u></div><div class="pace-l"><span>Budget used ${tb ? Math.round(usedRaw) + '%' : '—'}</span><span>${verdict}</span><span>Month ${Math.round(el)}%</span></div></div></div></section>`;
    const names = Object.keys(cats).concat(Object.keys(B).filter(k => !(k in cats)));
    const jl = names
      .map(n => ({ n, s: cats[n] || 0, l: B[n] || 0 }))
      .sort((a, b) => (b.l ? b.s / b.l : -1) - (a.l ? a.s / a.l : -1));
    const jars = `<section class="card rise" style="--i:3"><div class="card-h"><h2>Your jars</h2><span class="fine">Tap a jar to change its limit</span></div>${jl.length ? `<div class="jars">${jl.map((x, i) => jarCard(x.n, x.s, x.l, catColor(x.n), i)).join('')}</div>` : '<div class="empty">No spending in ' + mLabel(month) + ' yet.</div>'}</section>`;
    const cal = `<section class="card rise" style="--i:4"><div class="card-h"><h2>Spending calendar</h2><span class="fine">Darker means more spent</span></div>${heat(l, dim, p)}<div id="heat-read" class="num">Hover a day, click to list it below.</div></section>`;
    const orb = `<section class="card rise" style="--i:5"><div class="card-h"><h2>Where it went</h2></div>${orbit(cats)}</section>`;
    const flw = `<section class="card rise" style="--i:6"><div class="card-h"><h2>Last six months</h2><span class="fine" id="flow-read">Click a month to jump to it</span></div>${flow()}<div class="fine" style="margin-top:8px"><span class="dot" style="background:var(--pista)"></span> Income &nbsp;<span class="dot" style="background:var(--gold)"></span> Spending</div></section>`;
    if (!selDay || selDay.slice(0, 7) !== month) {
      const ds = l.map(t => t.date).sort();
      selDay = ds.length ? ds[ds.length - 1] : '';
    }
    return (
      quick() +
      hero +
      jars +
      `<div class="grid2">${cal}${orb}</div>` +
      flw +
      `<section class="card rise" style="--i:7" id="day-card">${dayCard()}</section>`
    );
  }
  function dayCard() {
    const l = data.txns.filter(t => t.date === selDay);
    return `<div class="card-h"><h2>${selDay ? dLabel(selDay) : 'No day selected'}</h2><span class="fine num">${l.length} transaction${l.length === 1 ? '' : 's'}${l.length ? ' · ' + money(totals(l).exp) + ' spent' : ''}</span></div>${l.length ? txTable(l) : '<div class="empty">Nothing logged on this day.</div>'}`;
  }
  function heat(l, dim, p) {
    const per = {};
    l.forEach(t => {
      if (t.type === 'expense') per[t.date] = (per[t.date] || 0) + t.amount;
    });
    const mx = Math.max(1, ...Object.values(per)),
      first = new Date(+p[0], +p[1] - 1, 1).getDay(),
      today = todayStr();
    let h =
      '<div class="heat">' +
      ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<span class="wd">${d}</span>`).join('');
    for (let i = 0; i < first; i++) h += '<span class="hc blank"></span>';
    for (let d = 1; d <= dim; d++) {
      const ds = month + '-' + String(d).padStart(2, '0'),
        s = per[ds] || 0;
      h += `<button class="hc${ds === selDay ? ' sel' : ''}${ds > today ? ' fut' : ''}" data-act="day" data-d="${ds}" data-s="${s}" style="--a:${Math.round((s / mx) * 88)}%" aria-label="${dLabel(ds)}: ${money(s)} spent">${d}</button>`;
    }
    return h + '</div>';
  }
  function orbit(cats) {
    const names = Object.keys(cats).sort((a, b) => cats[b] - cats[a]),
      tot = sum(cats);
    if (!names.length) return '<div class="empty">No expenses this month.</div>';
    const C = 2 * Math.PI * 70;
    let off = 0,
      segs = '',
      lg = '';
    names.forEach((n, i) => {
      const len = (cats[n] / tot) * C,
        g = names.length > 1 ? 3 : 0,
        at = `data-n="${esc(n)}" data-v="${cats[n]}" data-p="${Math.round((cats[n] / tot) * 100)}"`;
      segs += `<circle class="seg" ${at} cx="100" cy="100" r="70" fill="none" stroke="${catColor(n)}" stroke-width="26" stroke-dasharray="${Math.max(0, len - g)} ${C - len + g}" stroke-dashoffset="${-off}" transform="rotate(-90 100 100)" style="animation-delay:${i * 70}ms"/>`;
      if (i < 7)
        lg += `<div ${at}><span class="dot" style="background:${catColor(n)}"></span>${esc(n)}<span class="amt num">${money(cats[n])}</span></div>`;
      off += len;
    });
    return `<div class="orbit" id="orbit"><svg viewBox="0 0 200 200" role="img" aria-label="Spending by category">${segs}<text id="o-n" x="100" y="94" text-anchor="middle" font-size="11" font-weight="700" fill="var(--muted)" font-family="Hanken Grotesk">SPENT</text><text id="o-v" x="100" y="114" text-anchor="middle" font-size="15" font-weight="700" fill="var(--ink)" font-family="Unbounded">${money(tot)}</text></svg><div class="lg">${lg}</div></div>`;
  }
  function flow() {
    const ms = [];
    for (let i = 5; i >= 0; i--) ms.push(addM(month, -i));
    const tt = ms.map(m => totals(txOf(m))),
      mx = Math.max(1, ...tt.map(t => Math.max(t.inc, t.exp))),
      W = 480,
      H = 190,
      gw = W / 6,
      sc = v => (v / mx) * H;
    let h = `<svg class="flow" viewBox="0 0 ${W} ${H + 26}" role="img" aria-label="Income versus spending, last six months"><line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="var(--edge)" stroke-width="2"/>`;
    ms.forEach((m, i) => {
      const x = i * gw + gw / 2,
        t = tt[i];
      h += `<g class="col${m === month ? ' on' : ''}" data-act="goto" data-m="${m}" data-i="${mLabel(m)}: in ${money(t.inc)}, spent ${money(t.exp)}" tabindex="0" role="button" aria-label="${mLabel(m)}"><rect x="${i * gw}" y="0" width="${gw}" height="${H + 26}" fill="transparent"/>
  <rect class="bar" x="${x - 24}" y="${H - sc(t.inc)}" width="22" height="${sc(t.inc)}" rx="4" fill="var(--pista)" stroke="var(--edge)" stroke-width="2" style="--d:${i * 70}ms"/>
  <rect class="bar" x="${x + 2}" y="${H - sc(t.exp)}" width="22" height="${sc(t.exp)}" rx="4" fill="var(--gold)" stroke="var(--edge)" stroke-width="2" style="--d:${i * 70 + 40}ms"/>
  <text x="${x}" y="${H + 18}" text-anchor="middle">${mLabel(m, 1)}</text></g>`;
    });
    return h + '</svg>';
  }

  /* ---------- ledger ---------- */
  function filtered() {
    const q = filt.q.toLowerCase();
    return data.txns
      .filter(
        t =>
          (filt.range === 'all' || t.date.slice(0, 7) === month) &&
          (filt.type === 'all' || t.type === filt.type) &&
          (filt.cat === 'all' || t.category === filt.cat) &&
          (!q || (t.note + ' ' + t.category).toLowerCase().includes(q))
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  function txTable(list) {
    return `<div class="tbl"><table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="r">Amount</th><th class="r"></th></tr></thead><tbody>${list
      .map(t => {
        const inc = t.type === 'income';
        return `<tr><td class="muted" style="white-space:nowrap">${dLabel(t.date, 1)}</td><td>${esc(t.note) || '<span class="muted">No note</span>'}</td><td><span class="pill"><span class="dot" style="background:${catColor(t.category)}"></span>${esc(t.category)}</span></td><td class="r num ${inc ? 'inc' : 'exp'}" style="white-space:nowrap;font-weight:700">${inc ? '+' : '−'}${money(t.amount)}</td><td><div class="acts"><button class="icon-btn" data-act="edit" data-id="${t.id}" aria-label="Edit">${ico('edit')}</button><button class="icon-btn" data-act="del" data-id="${t.id}" aria-label="Delete">${ico('trash')}</button></div></td></tr>`;
      })
      .join('')}</tbody></table></div>`;
  }
  const allCats = () => [...new Set(data.cats.expense.concat(data.cats.income).map(c => c.name))];
  function ledgerBody() {
    const l = filtered(),
      T = totals(l);
    if (!l.length)
      return '<div class="empty"><h2>No matches</h2><p>Change the filters, or add something above.</p></div>';
    return `<div class="card-h"><h2>${l.length} transaction${l.length > 1 ? 's' : ''}</h2><span class="fine num">In ${money(T.inc)} · Out ${money(T.exp)}</span></div>${txTable(l)}`;
  }
  function vLedger() {
    return `${quick()}<div class="card rise" style="--i:2"><div class="filters"><div class="field"><label class="lbl" for="f-q">Search</label><input id="f-q" type="search" placeholder="Note or category" value="${esc(filt.q)}"></div>
 <div class="field"><label class="lbl" for="f-type">Type</label><select id="f-type"><option value="all">All</option><option value="income"${filt.type === 'income' ? ' selected' : ''}>Income</option><option value="expense"${filt.type === 'expense' ? ' selected' : ''}>Expense</option></select></div>
 <div class="field"><label class="lbl" for="f-cat">Category</label><select id="f-cat"><option value="all">All</option>${allCats()
   .map(c => `<option${filt.cat === c ? ' selected' : ''}>${esc(c)}</option>`)
   .join('')}</select></div>
 <div class="field"><label class="lbl" for="f-range">Period</label><select id="f-range"><option value="month">${mLabel(month)}</option><option value="all"${filt.range === 'all' ? ' selected' : ''}>All time</option></select></div></div></div><section class="card rise" style="--i:3" id="tx-card">${ledgerBody()}</section>`;
  }

  /* ---------- jars ---------- */
  function vJars() {
    const cats = byCat(txOf(month)),
      B = budgetsFor(month),
      tb = sum(B);
    let sp = 0;
    data.cats.expense.forEach(c => (sp += cats[c.name] || 0));
    return `<div class="ph rise"><h1>Jars for ${mLabel(month)}</h1><span class="pill ${tb - sp < 0 ? 'over' : 'ok'} num">${tb ? money(Math.abs(tb - sp)) + (tb - sp < 0 ? ' over total' : ' left in total') : 'No limits yet'}</span></div>
 <section class="card rise" style="--i:1"><div class="card-h"><h2>Monthly limits</h2><span class="fine">Limits carry forward to later months until you change them.</span></div><div class="jars">${data.cats.expense.map((c, i) => jarCard(c.name, cats[c.name] || 0, B[c.name] || 0, c.color, i)).join('')}</div></section>`;
  }
  function limitModal(cat) {
    const s = byCat(txOf(month))[cat] || 0,
      cur = budgetsFor(month)[cat] || 0,
      col = catColor(cat),
      mx = Math.ceil(Math.max(60000, cur * 1.5, s * 1.5) / 1000) * 1000;
    openModal(
      `<h2>${esc(cat)} jar</h2><div class="limit"><div id="lj">${jar(s, cur, col, 'm')}</div><div><span class="lbl">Monthly limit</span><output id="lv" class="big num">${money(cur)}</output><input id="lr" type="range" min="0" max="${mx}" step="500" value="${cur}" aria-label="Monthly limit"><div class="fine" id="lm"></div></div></div><div class="dlg-actions"><button class="btn" data-act="close">Cancel</button><button class="btn btn-gold" id="lsave">Save limit</button></div>`
    );
    fillJars($('#modal-root'));
    const upd = () => {
      const v = +$('#lr').value;
      $('#lv').textContent = money(v);
      const st = status(s, v),
        jr = $('#lj .jar');
      $('#lj .liq').style.transform = `translateY(${jarY(s, v)}px)`;
      $('#lj .wave').setAttribute('fill', st === 'over' ? 'var(--chili)' : col);
      jr.classList.toggle('over', st === 'over');
      $('#lm').textContent = v
        ? s > v
          ? `${money(s - v)} over with ${money(s)} spent`
          : `${money(v - s)} left after ${money(s)} spent`
        : `${money(s)} spent, no limit`;
    };
    upd();
    $('#lr').addEventListener('input', upd);
    $('#lsave').addEventListener('click', async () => {
      const v = +$('#lr').value;
      try {
        const j = await api('budgets.php', {
          method: 'PUT',
          body: { month, category: cat, amount: v },
        });
        data.budgets = j.budgets;
      } catch (x) {
        toast(x.message);
        return;
      }
      closeModal();
      render();
      toast(v ? `${cat} limit set to ${money(v)}` : `${cat} limit removed`);
    });
  }

  /* ---------- month summary ---------- */
  function summ(m) {
    const l = txOf(m),
      T = totals(l),
      cats = byCat(l),
      B = budgetsFor(m),
      prev = totals(txOf(addM(m, -1))),
      p = m.split('-'),
      dim = new Date(+p[0], +p[1], 0).getDate(),
      days = m === ym(new Date()) ? new Date().getDate() : dim,
      ex = l.filter(t => t.type === 'expense').sort((a, b) => b.amount - a.amount),
      nm = {};
    Object.keys(cats)
      .concat(Object.keys(B))
      .forEach(k => (nm[k] = 1));
    return {
      l,
      T,
      cats,
      B,
      prev,
      days,
      ex,
      rows: Object.keys(nm)
        .map(c => ({ c, s: cats[c] || 0, l: B[c] || 0 }))
        .sort((a, b) => b.s - a.s),
    };
  }
  function vMonth() {
    const S = summ(month),
      T = S.T,
      sr = T.inc ? Math.round((T.net / T.inc) * 100) : null,
      ins = [];
    const hd = `<div class="ph rise"><h1>${mLabel(month)}</h1><div class="head-actions"><button class="btn" data-act="export-tx">${ico('copy')}<span>Transactions CSV</span></button><button class="btn" data-act="export-sum">${ico('copy')}<span>Summary CSV</span></button></div></div>`;
    if (!S.l.length)
      return (
        hd +
        '<div class="card empty rise"><h2>Quiet month</h2><p>Nothing logged in ' +
        mLabel(month) +
        '. Pick another month above.</p></div>'
      );
    ins.push(
      `You spent <b class="num">${money(T.exp)}</b> over ${S.days} days, about <b class="num">${money(T.exp / S.days)}</b> a day.`
    );
    if (S.prev.exp > 0) {
      const d = Math.round(((T.exp - S.prev.exp) / S.prev.exp) * 100);
      ins.push(
        `Spending is ${d === 0 ? 'unchanged' : Math.abs(d) + '% ' + (d > 0 ? 'higher' : 'lower')} than ${mLabel(addM(month, -1))} (${money(S.prev.exp)}).`
      );
    }
    const top = Object.keys(S.cats).sort((a, b) => S.cats[b] - S.cats[a])[0];
    if (top)
      ins.push(
        `<b>${esc(top)}</b> took the biggest share: ${money(S.cats[top])}, ${Math.round((S.cats[top] / T.exp) * 100)}% of spending.`
      );
    if (S.ex[0])
      ins.push(
        `Biggest single expense: ${money(S.ex[0].amount)} on ${esc(S.ex[0].note || S.ex[0].category)}, ${dLabel(S.ex[0].date)}.`
      );
    const over = S.rows.filter(r => r.l && r.s > r.l);
    ins.push(
      over.length
        ? 'Overflowing jars: ' +
            over.map(r => `<b>${esc(r.c)}</b> by ${money(r.s - r.l)}`).join(', ') +
            '.'
        : sum(S.B)
          ? 'Every jar stayed under its limit.'
          : 'No jar limits were set this month.'
    );
    const rows = S.rows
      .map(r => {
        const st = status(r.s, r.l);
        return `<div class="crow"><span><span class="dot" style="background:${catColor(r.c)}"></span> ${esc(r.c)}</span><div class="mini"><i style="width:${r.l ? Math.min(100, (r.s / r.l) * 100) : T.exp ? (r.s / T.exp) * 100 : 0}%;background:${st === 'over' ? 'var(--chili)' : catColor(r.c)}"></i></div><span class="num" style="text-align:right">${money(r.s)}${r.l ? ' / ' + money(r.l) : ''}</span></div>`;
      })
      .join('');
    return (
      hd +
      `<section class="card rise" style="--i:1"><div class="stats"><div class="stat"><span class="lbl">Income</span><div class="v inc num">${money(T.inc)}</div></div><div class="stat"><span class="lbl">Spent</span><div class="v exp num">${money(T.exp)}</div></div><div class="stat"><span class="lbl">Net</span><div class="v num ${T.net >= 0 ? 'inc' : 'exp'}">${money(T.net)}</div></div><div class="stat"><span class="lbl">Saved</span><div class="v num">${sr === null ? '—' : sr + '%'}</div></div></div></section>
 <div class="grid2"><section class="card rise" style="--i:2"><div class="card-h"><h2>What stood out</h2></div><ul class="insights">${ins.map(i => `<li>${i}</li>`).join('')}</ul></section><section class="card rise" style="--i:3"><div class="card-h"><h2>By category</h2><span class="fine">Spent / limit</span></div>${rows}</section></div>`
    );
  }
  const csvCell = v => {
      v = String(v);
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    },
    csv = r => r.map(x => x.map(csvCell).join(',')).join('\n');
  const exportTx = () =>
    csv(
      [['Date', 'Type', 'Category', 'Note', 'Amount (INR)']].concat(
        txOf(month)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(t => [t.date, t.type, t.category, t.note, t.amount])
      )
    );
  function exportSum() {
    const S = summ(month),
      r = [
        ['Month', month],
        ['Income', S.T.inc],
        ['Expenses', S.T.exp],
        ['Net', S.T.net],
        [],
        ['Category', 'Spent', 'Limit', 'Remaining', 'Status'],
      ];
    S.rows.forEach(x => r.push([x.c, x.s, x.l || '', x.l ? x.l - x.s : '', ST[status(x.s, x.l)]]));
    return csv(r);
  }

  /* ---------- modals ---------- */
  function openModal(h, wide) {
    const r = $('#modal-root');
    r.innerHTML = `<div class="scrim" data-act="scrim"><div class="dlg${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${h}</div></div>`;
    const f = r.querySelector('input:not([type=radio]),textarea,button');
    if (f) f.focus();
  }
  const closeModal = () => {
    $('#modal-root').innerHTML = '';
  };
  function txForm(t) {
    t = t || { type: 'expense', date: todayStr(), category: '', amount: '', note: '' };
    const opts = ty =>
      data.cats[ty]
        .map(c => `<option${c.name === t.category ? ' selected' : ''}>${esc(c.name)}</option>`)
        .join('') + '<option value="__new">+ New category…</option>';
    openModal(`<h2>${t.id ? 'Edit transaction' : 'Add transaction'}</h2><form id="tx-form" novalidate><div class="segc" role="radiogroup" aria-label="Type"><label><input type="radio" name="tx-type" value="expense"${t.type === 'expense' ? ' checked' : ''}>Expense</label><label><input type="radio" name="tx-type" value="income"${t.type === 'income' ? ' checked' : ''}>Income</label></div>
 <div class="two"><div class="field"><label class="lbl" for="tx-amount">Amount (₹)</label><input id="tx-amount" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(t.amount)}"></div><div class="field"><label class="lbl" for="tx-date">Date</label><input id="tx-date" type="date" value="${t.date}"></div></div>
 <div class="field"><label class="lbl" for="tx-cat">Category</label><select id="tx-cat">${opts(t.type)}</select></div><div class="field" id="nc" hidden><label class="lbl" for="tx-newcat">New category name</label><input id="tx-newcat" type="text" maxlength="24"></div>
 <div class="field"><label class="lbl" for="tx-note">Note</label><input id="tx-note" type="text" maxlength="80" placeholder="Optional" value="${esc(t.note)}"></div><div class="err" id="tx-err" role="alert"></div>
 <div class="dlg-actions"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn btn-gold">${t.id ? 'Save changes' : 'Add transaction'}</button></div></form>`);
    const f = $('#tx-form'),
      sel = $('#tx-cat');
    f.addEventListener('change', e => {
      if (e.target.name === 'tx-type') {
        sel.innerHTML = opts(e.target.value).replace(' selected', '');
        $('#nc').hidden = true;
      }
      if (e.target === sel) $('#nc').hidden = sel.value !== '__new';
    });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const type = f.querySelector('input[name=tx-type]:checked').value,
        amt = parseFloat($('#tx-amount').value),
        date = $('#tx-date').value,
        err = $('#tx-err');
      let cat = sel.value;
      if (!(amt > 0)) {
        err.textContent = 'Enter an amount greater than zero.';
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        err.textContent = 'Pick a date.';
        return;
      }
      if (cat === '__new') {
        cat = $('#tx-newcat').value.trim();
        if (!cat) {
          err.textContent = 'Name the new category.';
          return;
        }
        const ex = data.cats[type].find(c => c.name.toLowerCase() === cat.toLowerCase());
        if (ex) cat = ex.name;
      }
      const rec = {
        type,
        amount: Math.round(amt * 100) / 100,
        date,
        category: cat,
        note: $('#tx-note').value.trim(),
      };
      try {
        if (t.id) {
          rec.id = t.id;
          const j = await api('transactions.php', { method: 'PUT', body: rec });
          data.cats = j.cats;
          data.txns = data.txns.map(x => (x.id === t.id ? rec : x));
        } else {
          const j = await api('transactions.php', { method: 'POST', body: rec });
          rec.id = j.id;
          data.cats = j.cats;
          data.txns.push(rec);
        }
      } catch (x) {
        err.textContent = x.message;
        return;
      }
      month = date.slice(0, 7);
      selDay = date;
      closeModal();
      render();
      toast(t.id ? 'Transaction updated' : 'Transaction added');
    });
  }
  const showCsv = (title, text, name) =>
    openModal(
      `<h2>${title}</h2><p class="muted">Copy this into a file named <b>${name}</b>, or paste it straight into a spreadsheet.</p><textarea id="csv-out" readonly>${esc(text)}</textarea><div class="dlg-actions"><button class="btn" data-act="close">Close</button><button class="btn btn-gold" data-act="copy-csv">${ico('copy')}<span>Copy CSV</span></button></div>`,
      true
    );

  /* ---------- events ---------- */
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const a = el.dataset.act;
    if (a === 'scrim') {
      if (e.target === el) closeModal();
      return;
    }
    if (a === 'nav') {
      view = el.dataset.view;
      render();
      scrollTo(0, 0);
    } else if (a === 'goto') {
      month = el.dataset.m;
      selDay = '';
      render();
    } else if (a === 'add') txForm();
    else if (a === 'edit') txForm(data.txns.find(t => t.id === el.dataset.id));
    else if (a === 'del')
      openModal(
        `<h2>Delete this transaction?</h2><p class="muted">This cannot be undone.</p><div class="dlg-actions"><button class="btn" data-act="close">Cancel</button><button class="btn btn-danger" data-act="del-ok" data-id="${el.dataset.id}">Delete</button></div>`
      );
    else if (a === 'del-ok') {
      try {
        await api('transactions.php?id=' + el.dataset.id, { method: 'DELETE' });
      } catch (x) {
        toast(x.message);
        return;
      }
      data.txns = data.txns.filter(t => t.id !== el.dataset.id);
      closeModal();
      render();
      toast('Transaction deleted');
    } else if (a === 'close') closeModal();
    else if (a === 'logout') logout();
    else if (a === 'auth-toggle') showAuth(el.dataset.mode);
    else if (a === 'limit') limitModal(el.dataset.cat);
    else if (a === 'day') {
      selDay = el.dataset.d;
      $$('.hc.sel').forEach(x => x.classList.remove('sel'));
      el.classList.add('sel');
      $('#day-card').innerHTML = dayCard();
      $('#day-card').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'nearest' });
    } else if (a === 'undo') {
      if (lastAdded) {
        try {
          await api('transactions.php?id=' + lastAdded, { method: 'DELETE' });
        } catch (x) {
          toast(x.message);
          return;
        }
        data.txns = data.txns.filter(t => t.id !== lastAdded);
        lastAdded = null;
        render();
        toast('Removed');
      }
    } else if (a === 'load-sample') {
      try {
        await api('data.php', { method: 'POST', body: seedDemo() });
        await loadData();
      } catch (x) {
        toast(x.message);
        return;
      }
      render();
      toast('Sample data loaded');
    } else if (a === 'export-tx')
      showCsv('Transactions, ' + mLabel(month), exportTx(), `gullak-${month}-transactions.csv`);
    else if (a === 'export-sum')
      showCsv('Summary, ' + mLabel(month), exportSum(), `gullak-${month}-summary.csv`);
    else if (a === 'copy-csv') {
      const ta = $('#csv-out');
      ta.select();
      const ok = () => toast('CSV copied'),
        no = () => {
          try {
            document.execCommand('copy');
            ok();
          } catch (x) {
            toast('Press Ctrl+C to copy');
          }
        };
      try {
        navigator.clipboard.writeText(ta.value).then(ok, no);
      } catch (x) {
        no();
      }
    }
  });
  document.addEventListener('keydown', async e => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter' && e.target.id === 'qa') {
      const q = parseQuick(e.target.value);
      if (!q) {
        toast('Start with an amount, like 450 lunch');
        return;
      }
      const r = { ...q };
      try {
        const j = await api('transactions.php', { method: 'POST', body: r });
        r.id = j.id;
        data.cats = j.cats;
      } catch (x) {
        toast(x.message);
        return;
      }
      data.txns.push(r);
      lastAdded = r.id;
      month = ym(new Date());
      selDay = r.date;
      render();
      toast(
        `${q.type === 'income' ? 'Added income' : 'Logged'} ${money(q.amount)} · ${q.category}`,
        true
      );
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.col')) {
      e.preventDefault();
      e.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    if (
      !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) &&
      !$('.scrim') &&
      user &&
      !e.metaKey &&
      !e.ctrlKey
    ) {
      if (e.key === 'n') {
        e.preventDefault();
        txForm();
      } else if (e.key === '/') {
        e.preventDefault();
        view = 'ledger';
        render();
        const q = $('#qa');
        if (q) q.focus();
      }
    }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'qa') {
      const q = parseQuick(e.target.value),
        p = $('#qa-prev');
      p.innerHTML = q
        ? `<span class="pill ${q.type === 'income' ? 'ok' : 'warn'}">${q.type === 'income' ? 'Income' : 'Expense'}</span><b class="num">${money(q.amount)}</b><span class="pill"><span class="dot" style="background:${catColor(q.category)}"></span>${esc(q.category)}</span><span>today · press Enter</span>`
        : 'Amount first, then a note. Start with + for income.';
    }
    if (e.target.id === 'f-q') {
      filt.q = e.target.value;
      $('#tx-card').innerHTML = ledgerBody();
    }
  });
  document.addEventListener('change', e => {
    const t = e.target,
      m = { 'f-type': 'type', 'f-cat': 'cat', 'f-range': 'range' }[t.id];
    if (m) {
      filt[m] = t.value;
      $('#tx-card').innerHTML = ledgerBody();
    }
  });
  document.addEventListener('mouseover', e => {
    const hc = e.target.closest('.hc[data-d]');
    if (hc) {
      $('#heat-read').textContent = `${dLabel(hc.dataset.d)}: ${money(+hc.dataset.s)} spent`;
      return;
    }
    const sg = e.target.closest('#orbit [data-n]'),
      o = $('#orbit');
    if (sg && o) {
      o.classList.add('dim');
      $$('[data-n]', o).forEach(x => x.classList.toggle('on', x.dataset.n === sg.dataset.n));
      $('#o-n').textContent = sg.dataset.n.toUpperCase() + ' · ' + sg.dataset.p + '%';
      $('#o-v').textContent = money(+sg.dataset.v);
    }
    const col = e.target.closest('.col');
    if (col) $('#flow-read').textContent = col.dataset.i;
  });
  document.addEventListener('mouseout', e => {
    const o = $('#orbit');
    if (
      o &&
      e.target.closest('#orbit') &&
      !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('#orbit [data-n]'))
    ) {
      o.classList.remove('dim');
      $$('[data-n]', o).forEach(x => x.classList.remove('on'));
      $('#o-n').textContent = 'SPENT';
      $('#o-v').textContent = money(sum(byCat(txOf(month))));
    }
  });
  new MutationObserver(() => {
    $$('.pace-bar i[data-w]').forEach(i => {
      i.style.width = i.dataset.w + '%';
    });
  }).observe(document.body, { childList: true, subtree: true });
  api('auth.php?action=me')
    .then(r => login(r.user))
    .catch(() => showAuth('login'));
})();