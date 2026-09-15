'use strict';
(function () {
  var state = { seed: null, role: null, branch: 'ALL', view: 'board', khSub: 'doc', book: 'hospital' };

  function $(id) { return document.getElementById(id); }
  function inr(n) {
    try { return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN'); }
    catch (e) { return '₹' + String(n); }
  }
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function doctorName(code) {
    var d = state.seed.doctors.find(function (x) { return x.code === code; });
    return d ? d.name : code;
  }
  function doctorMeta(code) {
    return state.seed.doctors.find(function (x) { return x.code === code; }) || {};
  }
  function branchName(id) {
    if (id === 'ALL') return 'All branches';
    var b = state.seed.branches.find(function (x) { return x.id === id; });
    return b ? b.name : id;
  }
  function inBranch(id) { return state.branch === 'ALL' || id === state.branch; }

  function khaataForView() {
    return state.seed.khaata.map(function (row) {
      var entries = row.entries.filter(function (e) { return inBranch(e.branch); });
      var amount = entries.reduce(function (s, e) { return s + (e.st === 'OPEN' ? e.amt : 0); }, 0);
      var n = entries.filter(function (e) { return e.st === 'OPEN'; }).length;
      var min = state.seed.meta.khaataMin;
      var meta = doctorMeta(row.code);
      var overMin = amount >= min;
      var payLater = !!meta.payLater;
      var ready = overMin && !payLater && !row.inFlight && n > 0;
      return Object.assign({}, row, { entries: entries, amount: amount, n: n, overMin: overMin, payLater: payLater, ready: ready });
    }).filter(function (row) { return row.n > 0 || (state.branch === 'ALL' && row.entries.length); });
  }

  function bookOf(branchId, book) {
    return state.seed.cashBooks[branchId][book];
  }
  function balanceOf(book) {
    return book.entries.reduce(function (bal, e) { return bal + (e.aaye || 0) - (e.gaye || 0); }, book.opening || 0);
  }
  function running(book) {
    var bal = book.opening || 0;
    return book.entries.map(function (e) {
      bal += (e.aaye || 0) - (e.gaye || 0);
      return Object.assign({}, e, { bal: bal });
    }).reverse();
  }

  function showLogin() {
    $('loginView').classList.remove('hide');
    $('appView').classList.add('hide');
    $('roleGrid').innerHTML = state.seed.roles.map(function (r) {
      return '<button class="rolebtn" type="button" data-role="' + r.id + '"><b>' + r.name + '</b><span>' + r.title + '</span></button>';
    }).join('');
  }

  function enter(roleId) {
    state.role = state.seed.roles.find(function (r) { return r.id === roleId; });
    $('loginView').classList.add('hide');
    $('appView').classList.remove('hide');
    $('whoami').textContent = state.role.name + ' · ' + state.role.title;
    renderBranchChips();
    setView(state.view);
  }

  function renderBranchChips() {
    var html = '<button class="fchip' + (state.branch === 'ALL' ? ' on' : '') + '" type="button" data-br="ALL">All branches</button>';
    html += state.seed.branches.map(function (b) {
      return '<button class="fchip' + (state.branch === b.id ? ' on' : '') + '" type="button" data-br="' + b.id + '">' + b.id + ' · ' + b.name + '</button>';
    }).join('');
    $('branchChips').innerHTML = html;
  }

  function setView(v) {
    state.view = v;
    document.querySelectorAll('.tabs .tab').forEach(function (t) {
      t.classList.toggle('on', t.getAttribute('data-view') === v);
    });
    ['board', 'khaata', 'cb', 'pay', 'bills'].forEach(function (id) {
      $('view-' + id).classList.toggle('hide', id !== v);
    });
    if (v === 'board') renderBoard();
    if (v === 'khaata') renderKhaata();
    if (v === 'cb') renderCash();
    if (v === 'pay') renderPay();
    if (v === 'bills') renderBills();
  }

  function renderBoard() {
    var pays = state.seed.payments.filter(function (p) { return inBranch(p.br); });
    var readyPay = pays.filter(function (p) { return p.st === 'READY'; }).reduce(function (s, p) { return s + p.amt; }, 0);
    var kh = khaataForView();
    var khTotal = kh.reduce(function (s, r) { return s + r.amount; }, 0);
    var pendingCheck = 0;
    var cashInHand = 0;
    (state.branch === 'ALL' ? state.seed.branches.map(function (b) { return b.id; }) : [state.branch]).forEach(function (id) {
      ['hospital', 'pharmacy'].forEach(function (book) {
        var b = bookOf(id, book);
        cashInHand += balanceOf(b);
        pendingCheck += b.entries.filter(function (e) { return !e.jBy; }).length;
      });
    });
    var billsPend = state.seed.bills.filter(function (b) { return inBranch(b.br) && b.st !== 'PAYABLE'; }).length;
    $('boardStats').innerHTML =
      stat(inr(khTotal), 'Doctor khaata open') +
      stat(inr(readyPay), 'Payments READY') +
      stat(inr(cashInHand), 'Cash in hand') +
      stat(String(billsPend), 'Bills waiting');
    $('boardHosp').innerHTML = state.seed.branches.map(function (br) {
      if (!inBranch(br.id)) return '';
      var kAmt = state.seed.khaata.reduce(function (s, row) {
        return s + row.entries.filter(function (e) { return e.branch === br.id && e.st === 'OPEN'; }).reduce(function (a, e) { return a + e.amt; }, 0);
      }, 0);
      var pN = state.seed.payments.filter(function (p) { return p.br === br.id && p.st !== 'PAID' && p.st !== 'CANCELLED'; }).length;
      var cash = balanceOf(bookOf(br.id, 'hospital')) + balanceOf(bookOf(br.id, 'pharmacy'));
      return '<div class="hospc"><div class="muted">' + br.id + ' · ' + br.kind + ' · ' + br.beds + ' beds</div><b>' + br.name + '</b><div class="hv">' + inr(cash) + '</div><small>cash in hand · khaata ' + inr(kAmt) + ' · ' + pN + ' open payments</small></div>';
    }).join('');
  }
  function stat(v, k) { return '<div class="stat"><div class="v">' + v + '</div><div class="kk">' + k + '</div></div>'; }

  function renderKhaata() {
    if (state.khSub === 'opd') {
      var q = state.seed.opdQueue.filter(function (x) { return inBranch(x.branch); });
      $('khHead').textContent = 'OPD jama · seema ' + inr(state.seed.meta.khaataMin) + ' · ' + q.filter(function (x) { return x.ready; }).length + ' taiyaar';
      $('khList').innerHTML = q.map(function (x) {
        return '<div class="pgcard"><div class="row"><div><b>' + x.code + '</b> <span class="muted">' + x.name + '</span><div class="muted">' + x.visits + ' visit · ' + x.branch + '</div></div><div class="money" style="color:' + (x.ready ? 'var(--green)' : 'var(--t16)') + '">' + inr(x.amount) + (x.ready ? ' ✓' : '') + '</div></div>' +
          (state.role.canRelease ? '<button class="mini" type="button" data-opd="' + x.code + '">Kholo</button>' : '') + '</div>';
      }).join('') || '<div class="count">Is branch me OPD jama nahi.</div>';
      return;
    }
    var rows = khaataForView();
    var total = rows.reduce(function (s, r) { return s + r.amount; }, 0);
    var readyN = rows.filter(function (r) { return r.ready; }).length;
    $('khHead').textContent = 'Khaata CHALU · auto-jama 24h · seema ' + inr(state.seed.meta.khaataMin) + ' · kul jama ' + inr(total) + ' · ' + readyN + ' taiyaar · ' + branchName(state.branch);
    $('khList').innerHTML = rows.map(function (x) {
      var why = !x.ready && x.overMin
        ? (x.payLater ? 'seema paar, par pay-later — jama hi rahega' : 'seema paar, par pichhla bhugtan raaste me')
        : '';
      var srcs = Object.keys(x.srcs || {}).map(function (k) { return k + '×' + x.srcs[k]; }).join(' · ');
      return '<div class="pgcard">' +
        '<div class="row"><div><b>' + x.code + '</b> <span class="muted">' + doctorName(x.code) + '</span>' +
        (x.payLater ? ' <span class="tb" style="background:var(--abg);color:var(--t20)">pay-later</span>' : '') +
        (x.inFlight ? ' <span class="tb" style="background:rgba(29,78,216,.12);color:var(--t18)">' + x.inFlight + ' raaste me</span>' : '') +
        '<div class="muted">' + x.n + ' NA' + (srcs ? ' (' + srcs + ')' : '') + ' · byora kholo</div></div>' +
        '<div style="text-align:right"><div class="money" style="color:' + (x.ready ? 'var(--green)' : 'var(--t16)') + '">' + inr(x.amount) + (x.ready ? ' ✓' : '') + '</div>' +
        (why ? '<div class="muted" style="max-width:140px">' + why + '</div>' : '') +
        (state.role.canRelease ? '<button class="mini" type="button" data-rel="' + x.code + '">Kholo</button>' : '') +
        '</div></div>' +
        '<div class="detail">' + x.entries.map(function (e) {
          return '<div><b>' + e.id + '</b> · ' + e.src + ' · ' + e.ref + ' · ' + e.patient + ' · ' + e.branch + ' · ' + inr(e.amt) + ' · ' + e.st + '<div class="muted">' + e.on + ' · ' + e.by + '</div></div>';
        }).join('') + '</div></div>';
    }).join('') || '<div class="count">Is filter me khaata khaali hai.</div>';
  }

  function releaseKhaata(code) {
    var row = khaataForView().find(function (r) { return r.code === code; });
    if (!row) return;
    if (row.inFlight) { toast('Pehle in-flight payout nipte.'); return; }
    var w = prompt(code + ' — ' + inr(row.amount) + ' ka combined bhugtan? Wajah (5+ akshar):');
    if (w === null) return;
    if (String(w).trim().length < 5) { toast('Wajah zaroori hai.'); return; }
    if (row.payLater) { toast('Pay-later khaata — demo me register pe jama dikhega, carrier nahi bana.'); return; }
    var na = 'P26' + (state.branch === 'ALL' ? 'MCY' : state.branch) + 'NASEP' + String(20 + state.seed.payments.length);
    row.entries.forEach(function (e) {
      var live = state.seed.khaata.find(function (k) { return k.code === code; }).entries.find(function (x) { return x.id === e.id; });
      if (live && live.st === 'OPEN') live.st = 'RELEASED';
    });
    var src = state.seed.khaata.find(function (k) { return k.code === code; });
    src.inFlight = na;
    src.ready = false;
    state.seed.payments.unshift({
      code: na, caseId: 'COMBINED-' + code.replace(/\s/g, ''), br: row.entries[0].branch, patient: 'Combined — ' + row.n + ' NA',
      uhid: '—', docCode: code, docName: doctorName(code), amt: row.amount, st: 'READY', mode: 'CASH',
      voucher: 'VCH-' + na, paidOn: '', paidBy: '', cstage: '', bankSt: '', utr: '', rokWhy: ''
    });
    toast('Combined payout ' + na + ' READY.');
    renderKhaata();
  }

  function renderCash() {
    var branchId = state.branch === 'ALL' ? 'MCY' : state.branch;
    if (state.branch === 'ALL') {
      $('cbTop').innerHTML = 'All-branch rollup ke liye ek till chunein — ab <b>Meridian City</b> hospital/pharmacy dikh raha hai. Upar branch chip se doosri unit kholo.';
    }
    var book = bookOf(branchId, state.book);
    var jaanch = book.entries.filter(function (e) { return !e.jBy; }).length;
    $('cbTop').innerHTML = '<b>' + branchName(branchId) + ' · ' + (state.book === 'hospital' ? 'Hospital' : 'Pharmacy') + '</b> · CASH IN HAND: <b>' + inr(balanceOf(book)) + '</b> · ' +
      (jaanch ? '<span style="color:var(--amber)">' + jaanch + ' entry par ✓ baaki</span>' : 'sab ✓');
    $('cbAddBox').classList.toggle('hide', !state.role.canWriteCash);
    var rows = running(book);
    $('cbList').innerHTML = rows.length ? rows.map(function (x) {
      var kya = x.aaye > 0 ? '<span style="color:var(--green)">+' + inr(x.aaye) + '</span>' : '<span style="color:var(--t13)">-' + inr(x.gaye) + '</span>';
      var b = '';
      if (!x.jBy && state.role.canCheck) b += '<button class="mini ok" type="button" data-tick="' + x.id + '">✓ Jaanch OK</button> ';
      if (!x.ulatOf && state.role.canWriteCash) b += '<button class="mini" type="button" data-ulat="' + x.id + '">Ulat</button>';
      return '<div class="pgcard"' + (x.ulatOf ? ' style="opacity:.8"' : '') + '><b>' + x.part + '</b>' + (x.voucher ? ' · ' + x.voucher : '') +
        '<div class="count">' + x.d + ' · ' + kya + ' · balance ' + inr(x.bal) + ' · ' + x.by + (x.jBy ? ' · ✅ ' + x.jBy : ' · ⏳ jaanch baaki') + (x.note ? '<br>' + x.note : '') + '</div>' + b + '</div>';
    }).join('') : '<div class="count">Is till me entry nahi.</div>';
  }

  function cbTick(id) {
    var branchId = state.branch === 'ALL' ? 'MCY' : state.branch;
    var e = bookOf(branchId, state.book).entries.find(function (x) { return x.id === id; });
    if (!e) return;
    e.jBy = state.role.name;
    toast('Jaanch OK — ' + e.part);
    renderCash();
  }
  function cbUlat(id) {
    var branchId = state.branch === 'ALL' ? 'MCY' : state.branch;
    var book = bookOf(branchId, state.book);
    var e = book.entries.find(function (x) { return x.id === id; });
    if (!e) return;
    var k = prompt('"' + e.part + '" ki ulat-entry. Karan:');
    if (k === null) return;
    if (!String(k).trim()) { toast('Karan likhein.'); return; }
    book.entries.push({
      id: e.id + '-R', d: state.seed.meta.demoDay, part: 'ULAT · ' + e.part, voucher: e.voucher + 'R',
      aaye: e.gaye, gaye: e.aaye, by: state.role.name, jBy: '', ulatOf: e.id, note: k
    });
    toast('Ulat darj — purani row bachi.');
    renderCash();
  }
  function cbAdd() {
    var branchId = state.branch === 'ALL' ? 'MCY' : state.branch;
    var part = ($('cbPart').value || '').trim();
    var aaye = Number($('cbAaye').value) || 0;
    var gaye = Number($('cbGaye').value) || 0;
    if (!part) { toast('Particulars likhein.'); return; }
    if ((aaye && gaye) || (!aaye && !gaye)) { toast('Sirf cash-in YA cash-out.'); return; }
    var book = bookOf(branchId, state.book);
    book.entries.push({
      id: 'CB-' + branchId + '-' + Date.now(), d: $('cbDate').value || state.seed.meta.demoDay,
      part: part, voucher: 'VCH-D' + (book.entries.length + 1), aaye: aaye, gaye: gaye,
      by: state.role.name, jBy: '', ulatOf: '', note: 'demo entry'
    });
    $('cbPart').value = $('cbAaye').value = $('cbGaye').value = '';
    toast('Entry darj.');
    renderCash();
  }

  function renderPay() {
    var q = ($('payQ').value || '').toLowerCase();
    var f = $('payF').value, m = $('payM').value;
    var rows = state.seed.payments.filter(function (c) {
      if (!inBranch(c.br)) return false;
      if (f && c.st !== f) return false;
      if (m && (c.mode || 'CASH') !== m) return false;
      if (q) {
        var hay = [c.docName, c.docCode, c.code, c.caseId, c.patient, c.uhid, c.br].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var counts = {};
    rows.forEach(function (r) { counts[r.st] = (counts[r.st] || 0) + 1; });
    var parts = Object.keys(counts).map(function (k) { return k + ': ' + counts[k]; });
    var cashN = rows.filter(function (r) { return r.mode === 'CASH'; }).length;
    var bankN = rows.filter(function (r) { return r.mode === 'DIGITAL'; }).length;
    $('paySum').innerHTML = 'Kul ' + rows.length + ' · ' + parts.join(' · ') + '<br><span class="muted">cash ' + cashN + ' · bank ' + bankN + ' — khata doctor ka hota hai, payment ka nahi</span>';
    $('payList').innerHTML = rows.map(function (c) {
      var open = c.st !== 'PAID' && c.st !== 'CANCELLED';
      var stc = c.st === 'PAID' ? 'var(--t21)' : (c.st === 'CANCELLED' ? 'var(--muted)' : (c.st === 'BLOCKED_NUMBER' ? 'var(--t20)' : 'var(--t18)'));
      return '<div class="pgcard"><div class="row"><div><b>' + c.docName + '</b> <span class="muted">[' + c.docCode + ']</span></div>' +
        '<div style="text-align:right"><div class="money">' + inr(c.amt) + '</div><b style="color:' + stc + ';font-size:12px">' + c.st + '</b></div></div>' +
        '<div class="muted">' + c.br + ' · ' + c.patient + ' · ' + c.uhid + ' · ' + c.caseId + '<br>' + c.code + ' · ' + c.voucher + '</div>' +
        '<div style="margin-top:6px">' + (c.mode === 'DIGITAL' ? 'Bank' + (c.utr ? ' · UTR ' + c.utr : '') : 'Cash' + (c.cstage ? ' · ' + c.cstage : '')) +
        (c.bankSt === 'VERIFIED' ? ' · khata ✓ — agla NA bank se' : '') + '</div>' +
        (c.rokWhy ? '<div class="warnbox">' + c.rokWhy + '</div>' : '') +
        (open && state.role.id === 'director' ? '<button class="mini no" type="button" data-cx="' + c.code + '">Radd</button> ' : '') +
        (open && c.st === 'READY' && state.role.canWriteCash ? '<button class="mini ok" type="button" data-paid="' + c.code + '">Paid mark</button>' : '') +
        '</div>';
    }).join('') || '<div class="count">Kuch nahi mila.</div>';
  }

  function markPaid(code) {
    var p = state.seed.payments.find(function (x) { return x.code === code; });
    if (!p) return;
    if (!confirm(code + ' paid mark karein? Demo only — koi bank/OTP nahi.')) return;
    p.st = 'PAID'; p.paidOn = state.seed.meta.demoDay + ' 12:00'; p.paidBy = state.role.name; p.cstage = 'LIYA';
    var kh = state.seed.khaata.find(function (k) { return k.inFlight === code; });
    if (kh) kh.inFlight = '';
    toast('Paid · ' + code);
    renderPay();
  }
  function cancelPay(code) {
    var p = state.seed.payments.find(function (x) { return x.code === code; });
    if (!p) return;
    var w = prompt('Radd karan (audit me jayega):');
    if (w === null || String(w).trim().length < 5) { toast('Karan chhota hai.'); return; }
    p.st = 'CANCELLED'; p.rokWhy = w;
    toast('Radd · ' + code);
    renderPay();
  }

  function renderBills() {
    var rows = state.seed.bills.filter(function (b) { return inBranch(b.br); });
    var payable = rows.filter(function (b) { return b.st === 'PAYABLE'; }).reduce(function (s, b) { return s + b.naAmt; }, 0);
    $('billSum').textContent = rows.length + ' bills · payable NA ' + inr(payable) + ' · validator ✓ ke baad hi khaata/payout';
    $('billList').innerHTML = rows.map(function (b) {
      var line = b.lines.map(function (l) { return '<div class="detail"><b>' + l.n + '</b> · dep ' + inr(l.dep) + ' · ' + l.pct + '% → ' + inr(l.val) + '</div>'; }).join('');
      var act = '';
      if (b.st === 'PENDING' && state.role.canCheck) {
        act = '<button class="mini ok" type="button" data-billok="' + b.caseId + '">Sahi</button> <button class="mini no" type="button" data-billno="' + b.caseId + '">Hold</button>';
      }
      return '<div class="pgcard"><div class="row"><div><b>' + b.caseId + '</b> · ' + b.br + '<div class="muted">' + b.patient + ' · ' + b.uhid + ' · ' + b.docName + '</div></div>' +
        '<div style="text-align:right"><div class="money">' + inr(b.naAmt) + '</div><span class="muted">' + b.scheme + ' · ' + b.st + (b.audit ? ' · ' + b.audit : '') + '</span></div></div>' +
        '<div class="muted">gross ' + inr(b.gross) + ' · disc ' + inr(b.disc) + ' · net ' + inr(b.net) + '</div>' + line + act + '</div>';
    }).join('');
  }
  function billOk(id, okFlag) {
    var b = state.seed.bills.find(function (x) { return x.caseId === id; });
    if (!b) return;
    b.st = okFlag ? 'PAYABLE' : 'HOLD';
    b.audit = okFlag ? 'AUDITED_OK' : 'DISPUTE';
    toast(id + ' · ' + b.st);
    renderBills();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-role],[data-view],[data-br],[data-kh],[data-book],[data-rel],[data-opd],[data-tick],[data-ulat],[data-paid],[data-cx],[data-billok],[data-billno]');
    if (!t) return;
    if (t.dataset.role) enter(t.dataset.role);
    else if (t.dataset.view) setView(t.dataset.view);
    else if (t.dataset.br) { state.branch = t.dataset.br; renderBranchChips(); setView(state.view); }
    else if (t.dataset.kh) {
      state.khSub = t.dataset.kh;
      document.querySelectorAll('[data-kh]').forEach(function (c) { c.classList.toggle('on', c === t); });
      renderKhaata();
    } else if (t.dataset.book) {
      state.book = t.dataset.book;
      document.querySelectorAll('[data-book]').forEach(function (c) { c.classList.toggle('on', c === t); });
      renderCash();
    } else if (t.dataset.rel) releaseKhaata(t.dataset.rel);
    else if (t.dataset.opd) toast('OPD khaata committee ko — demo reason flow. Production OTP/committee nahi joda.');
    else if (t.dataset.tick) cbTick(t.dataset.tick);
    else if (t.dataset.ulat) cbUlat(t.dataset.ulat);
    else if (t.dataset.paid) markPaid(t.dataset.paid);
    else if (t.dataset.cx) cancelPay(t.dataset.cx);
    else if (t.dataset.billok) billOk(t.dataset.billok, true);
    else if (t.dataset.billno) billOk(t.dataset.billno, false);
  });
  $('logoutBtn').onclick = function () { state.role = null; showLogin(); };
  $('themeBtn').onclick = function () { document.body.classList.toggle('dark'); };
  $('cbAddBtn').onclick = cbAdd;
  $('payQ').addEventListener('input', renderPay);
  $('payF').addEventListener('change', renderPay);
  $('payM').addEventListener('change', renderPay);
  $('cbDate').value = '2026-09-15';

  fetch('data/seed.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (seed) { state.seed = JSON.parse(JSON.stringify(seed)); showLogin(); })
    .catch(function () { document.body.insertAdjacentHTML('afterbegin', '<div class="banner">Seed JSON nahi khuli — `npm start` se chalao.</div>'); });
})();
