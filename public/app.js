'use strict';
(function () {
  var state = { seed: null, role: null, branch: 'ALL', view: 'board', khSub: 'doc', book: 'hospital' };
  var TITLES = {
    board: ['Group', 'Group overview'],
    khaata: ['Doctor Khaata', 'Combined IPD + OPD ledger'],
    cb: ['Cash Book', 'Hospital & pharmacy tills'],
    pay: ['Payment Register', 'Cash and bank payouts'],
    bills: ['Bills / NA Hisaab', 'Line-wise settlement']
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
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
  function stamp(st) {
    if (!st) return '';
    var cls = 'st-' + String(st).replace(/\s+/g, '-');
    return '<span class="stamp ' + cls + '">' + esc(st) + '</span>';
  }
  function emptyRow(cols, msg) {
    return '<tr><td colspan="' + cols + '" class="muted">' + esc(msg) + '</td></tr>';
  }

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
  function ledgerRows(book) {
    var bal = book.opening || 0;
    var rows = [{ opening: true, part: 'Opening balance', bal: bal, d: '', voucher: '', aaye: 0, gaye: 0, by: '', jBy: '—' }];
    book.entries.forEach(function (e) {
      bal += (e.aaye || 0) - (e.gaye || 0);
      rows.push(Object.assign({}, e, { bal: bal }));
    });
    return rows;
  }

  function showLogin() {
    $('loginView').classList.remove('hide');
    $('appView').classList.add('hide');
    $('roleGrid').innerHTML = state.seed.roles.map(function (r) {
      return '<tr><td><b>' + esc(r.name) + '</b></td><td>' + esc(r.title) + '</td>' +
        '<td class="num"><button class="btn primary" type="button" data-role="' + esc(r.id) + '">Enter</button></td></tr>';
    }).join('');
  }

  function enter(roleId) {
    state.role = state.seed.roles.find(function (r) { return r.id === roleId; });
    $('loginView').classList.add('hide');
    $('appView').classList.remove('hide');
    $('whoami').textContent = state.role.name + ' · ' + state.role.title;
    renderBranchSelect();
    setView(state.view);
  }

  function renderBranchSelect() {
    var html = '<option value="ALL">All branches</option>';
    html += state.seed.branches.map(function (b) {
      return '<option value="' + esc(b.id) + '">' + esc(b.id) + ' · ' + esc(b.name) + '</option>';
    }).join('');
    $('branchSelect').innerHTML = html;
    $('branchSelect').value = state.branch;
  }

  function setView(v) {
    state.view = v;
    document.querySelectorAll('.sidenav .navbtn').forEach(function (t) {
      t.classList.toggle('on', t.getAttribute('data-view') === v);
    });
    ['board', 'khaata', 'cb', 'pay', 'bills'].forEach(function (id) {
      $('view-' + id).classList.toggle('hide', id !== v);
    });
    $('crumb').textContent = TITLES[v][0];
    $('pageTitle').textContent = TITLES[v][1];
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
      kpi(inr(khTotal), 'Doctor khaata open') +
      kpi(inr(readyPay), 'Payments READY') +
      kpi(inr(cashInHand), 'Cash in hand') +
      kpi(String(billsPend), 'Bills waiting');
    var rows = state.seed.branches.map(function (br) {
      if (!inBranch(br.id)) return '';
      var kAmt = state.seed.khaata.reduce(function (s, row) {
        return s + row.entries.filter(function (e) { return e.branch === br.id && e.st === 'OPEN'; }).reduce(function (a, e) { return a + e.amt; }, 0);
      }, 0);
      var pN = state.seed.payments.filter(function (p) { return p.br === br.id && p.st !== 'PAID' && p.st !== 'CANCELLED'; }).length;
      var hosp = balanceOf(bookOf(br.id, 'hospital'));
      var pharm = balanceOf(bookOf(br.id, 'pharmacy'));
      return '<tr><td class="mono">' + esc(br.id) + '</td><td><b>' + esc(br.name) + '</b><div class="muted">' + esc(br.kind) + ' · ' + br.beds + ' beds</div></td>' +
        '<td class="num money">' + inr(hosp) + '</td><td class="num money">' + inr(pharm) + '</td>' +
        '<td class="num money">' + inr(hosp + pharm) + '</td><td class="num">' + inr(kAmt) + '</td><td class="num">' + pN + '</td></tr>';
    }).join('');
    $('boardHosp').innerHTML = '<table class="grid"><thead><tr><th>Code</th><th>Branch</th><th class="num">Hospital till</th><th class="num">Pharmacy till</th><th class="num">Cash in hand</th><th class="num">Khaata open</th><th class="num">Open pays</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }
  function kpi(v, k) { return '<div class="kpi"><div class="v">' + v + '</div><div class="kk">' + k + '</div></div>'; }

  function renderKhaata() {
    if (state.khSub === 'opd') {
      var q = state.seed.opdQueue.filter(function (x) { return inBranch(x.branch); });
      $('khHead').textContent = 'OPD jama · seema ' + inr(state.seed.meta.khaataMin) + ' · ' + q.filter(function (x) { return x.ready; }).length + ' taiyaar';
      var body = q.map(function (x) {
        return '<tr><td class="mono">' + esc(x.code) + '</td><td>' + esc(x.name) + '</td><td>' + esc(x.branch) + '</td><td class="num">' + x.visits + '</td>' +
          '<td class="num money">' + inr(x.amount) + '</td><td>' + (x.ready ? stamp('READY') : stamp('PENDING')) + '</td>' +
          '<td>' + (state.role.canRelease ? '<button class="mini" type="button" data-opd="' + esc(x.code) + '">Kholo</button>' : '') + '</td></tr>';
      }).join('') || emptyRow(7, 'Is branch me OPD jama nahi.');
      $('khList').innerHTML = '<table class="grid"><thead><tr><th>Code</th><th>Doctor</th><th>Unit</th><th class="num">Visits</th><th class="num">Amount</th><th>Status</th><th></th></tr></thead><tbody>' + body + '</tbody></table>';
      return;
    }
    var rows = khaataForView();
    var total = rows.reduce(function (s, r) { return s + r.amount; }, 0);
    var readyN = rows.filter(function (r) { return r.ready; }).length;
    $('khHead').textContent = 'Khaata CHALU · auto-jama 24h · seema ' + inr(state.seed.meta.khaataMin) + ' · kul jama ' + inr(total) + ' · ' + readyN + ' taiyaar · ' + branchName(state.branch);
    var body = rows.map(function (x) {
      var why = !x.ready && x.overMin
        ? (x.payLater ? 'seema paar, par pay-later — jama hi rahega' : 'seema paar, par pichhla bhugtan raaste me')
        : '';
      var srcs = Object.keys(x.srcs || {}).map(function (k) { return k + '×' + x.srcs[k]; }).join(' · ');
      var badges = (x.payLater ? stamp('pay-later') + ' ' : '') +
        (x.inFlight ? stamp('in-flight') + ' <span class="mono muted">' + esc(x.inFlight) + '</span>' : '') +
        (x.ready ? ' ' + stamp('READY') : '');
      var act = state.role.canRelease ? '<button class="mini ok" type="button" data-rel="' + esc(x.code) + '">Kholo</button>' : '';
      var parent = '<tr><td class="mono"><button class="mini linkish" type="button" data-open="' + esc(x.code) + '">▸ ' + esc(x.code) + '</button></td>' +
        '<td><b>' + esc(doctorName(x.code)) + '</b><div class="muted">' + esc(srcs) + (why ? ' · ' + esc(why) : '') + '</div></td>' +
        '<td class="num">' + x.n + '</td><td class="num money">' + inr(x.amount) + '</td><td>' + badges + '</td><td>' + act + '</td></tr>';
      var kids = x.entries.map(function (e) {
        return '<tr class="child hide" data-kid="' + esc(x.code) + '"><td class="mono">' + esc(e.id) + '</td><td>' +
          esc(e.src) + ' · ' + esc(e.ref) + ' · ' + esc(e.patient) + ' · ' + esc(e.branch) +
          '<div class="muted">' + esc(e.on) + ' · ' + esc(e.by) + '</div></td><td></td><td class="num money">' + inr(e.amt) + '</td><td>' + stamp(e.st) + '</td><td></td></tr>';
      }).join('');
      return parent + kids;
    }).join('') || emptyRow(6, 'Is filter me khaata khaali hai.');
    $('khList').innerHTML = '<table class="grid"><thead><tr><th>Code</th><th>Doctor / source</th><th class="num">NA</th><th class="num">Open</th><th>Status</th><th></th></tr></thead><tbody>' + body + '</tbody></table>';
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
    var book = bookOf(branchId, state.book);
    var jaanch = book.entries.filter(function (e) { return !e.jBy; }).length;
    var note = state.branch === 'ALL'
      ? 'All-branch rollup ke liye ek till chunein — ab <b>Meridian City</b> hospital/pharmacy dikh raha hai.'
      : '';
    $('cbTop').innerHTML = '<b>' + esc(branchName(branchId)) + ' · ' + (state.book === 'hospital' ? 'Hospital' : 'Pharmacy') + '</b> · CASH IN HAND: <b>' + inr(balanceOf(book)) + '</b> · ' +
      (jaanch ? '<span style="color:var(--amber)">' + jaanch + ' entry par ✓ baaki</span>' : 'sab ✓') +
      (note ? '<br>' + note : '');
    $('cbAddBox').classList.toggle('hide', !state.role.canWriteCash);
    var rows = ledgerRows(book);
    var body = rows.map(function (x) {
      if (x.opening) {
        return '<tr class="opening"><td></td><td><b>Opening balance</b></td><td></td><td class="num">—</td><td class="num">—</td><td class="num money">' + inr(x.bal) + '</td><td></td><td></td><td></td></tr>';
      }
      var b = '';
      if (!x.jBy && state.role.canCheck) b += '<button class="mini ok" type="button" data-tick="' + esc(x.id) + '">✓ Jaanch OK</button> ';
      if (!x.ulatOf && state.role.canWriteCash) b += '<button class="mini" type="button" data-ulat="' + esc(x.id) + '">Ulat</button>';
      return '<tr' + (x.ulatOf ? ' class="rev"' : '') + '><td class="mono">' + esc(x.d) + '</td><td><b>' + esc(x.part) + '</b>' + (x.note ? '<div class="muted">' + esc(x.note) + '</div>' : '') + '</td>' +
        '<td class="mono">' + esc(x.voucher || '') + '</td>' +
        '<td class="num money">' + (x.aaye ? inr(x.aaye) : '') + '</td>' +
        '<td class="num money">' + (x.gaye ? inr(x.gaye) : '') + '</td>' +
        '<td class="num money">' + inr(x.bal) + '</td>' +
        '<td>' + esc(x.by) + '</td>' +
        '<td>' + (x.jBy ? stamp('ok') + ' ' + esc(x.jBy) : '<span class="muted">jaanch baaki</span>') + '</td>' +
        '<td>' + b + '</td></tr>';
    }).join('');
    $('cbList').innerHTML = '<table class="grid"><thead><tr><th>Date</th><th>Particulars</th><th>Voucher</th><th class="num">Cash in</th><th class="num">Cash out</th><th class="num">Balance</th><th>By</th><th>Check</th><th></th></tr></thead><tbody>' + body + '</tbody></table>';
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
    var body = rows.map(function (c) {
      var open = c.st !== 'PAID' && c.st !== 'CANCELLED';
      var mode = c.mode === 'DIGITAL' ? 'Bank' + (c.utr ? ' · UTR ' + c.utr : '') : 'Cash' + (c.cstage ? ' · ' + c.cstage : '');
      var extra = (c.bankSt === 'VERIFIED' ? ' · khata ✓' : '') + (c.rokWhy ? '<div class="warnbox">' + esc(c.rokWhy) + '</div>' : '');
      var act = '';
      if (open && state.role.id === 'director') act += '<button class="mini no" type="button" data-cx="' + esc(c.code) + '">Radd</button> ';
      if (open && c.st === 'READY' && state.role.canWriteCash) act += '<button class="mini ok" type="button" data-paid="' + esc(c.code) + '">Paid mark</button>';
      return '<tr><td class="mono">' + esc(c.code) + '<div class="muted">' + esc(c.voucher) + '</div></td>' +
        '<td><b>' + esc(c.docName) + '</b> <span class="muted">[' + esc(c.docCode) + ']</span></td>' +
        '<td>' + esc(c.br) + '</td><td>' + esc(c.patient) + '<div class="muted">' + esc(c.uhid) + ' · ' + esc(c.caseId) + '</div></td>' +
        '<td class="num money">' + inr(c.amt) + '</td><td>' + esc(mode) + extra + '</td><td>' + stamp(c.st) + '</td><td>' + act + '</td></tr>';
    }).join('') || emptyRow(8, 'Kuch nahi mila.');
    $('payList').innerHTML = '<table class="grid"><thead><tr><th>NA</th><th>Doctor</th><th>Unit</th><th>Patient</th><th class="num">Amount</th><th>Mode</th><th>Status</th><th></th></tr></thead><tbody>' + body + '</tbody></table>';
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
    var body = rows.map(function (b) {
      var act = '';
      if (b.st === 'PENDING' && state.role.canCheck) {
        act = '<button class="mini ok" type="button" data-billok="' + esc(b.caseId) + '">Sahi</button> <button class="mini no" type="button" data-billno="' + esc(b.caseId) + '">Hold</button>';
      }
      var parent = '<tr><td class="mono"><button class="mini linkish" type="button" data-open="' + esc(b.caseId) + '">▸ ' + esc(b.caseId) + '</button></td>' +
        '<td>' + esc(b.br) + '</td><td>' + esc(b.patient) + '<div class="muted">' + esc(b.uhid) + '</div></td>' +
        '<td>' + esc(b.docName) + '</td><td>' + esc(b.scheme) + '</td>' +
        '<td class="num">' + inr(b.gross) + '</td><td class="num">' + inr(b.disc) + '</td><td class="num">' + inr(b.net) + '</td>' +
        '<td class="num money">' + inr(b.naAmt) + '</td><td>' + stamp(b.st) + (b.audit ? ' ' + stamp(b.audit) : '') + '</td><td>' + act + '</td></tr>';
      var kids = b.lines.map(function (l) {
        return '<tr class="child hide" data-kid="' + esc(b.caseId) + '"><td></td><td colspan="4">' + esc(l.n) + '</td>' +
          '<td class="num" colspan="2">dep ' + inr(l.dep) + ' · ' + l.pct + '%</td><td></td><td class="num money">' + inr(l.val) + '</td><td></td><td></td></tr>';
      }).join('');
      return parent + kids;
    }).join('');
    $('billList').innerHTML = '<table class="grid"><thead><tr><th>Case</th><th>Unit</th><th>Patient</th><th>Doctor</th><th>Scheme</th><th class="num">Gross</th><th class="num">Disc</th><th class="num">Net</th><th class="num">NA</th><th>Status</th><th></th></tr></thead><tbody>' + body + '</tbody></table>';
  }
  function billOk(id, okFlag) {
    var b = state.seed.bills.find(function (x) { return x.caseId === id; });
    if (!b) return;
    b.st = okFlag ? 'PAYABLE' : 'HOLD';
    b.audit = okFlag ? 'AUDITED_OK' : 'DISPUTE';
    toast(id + ' · ' + b.st);
    renderBills();
  }

  function toggleOpen(id) {
    document.querySelectorAll('[data-kid="' + id + '"]').forEach(function (tr) {
      tr.classList.toggle('hide');
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-role],[data-view],[data-kh],[data-book],[data-rel],[data-opd],[data-tick],[data-ulat],[data-paid],[data-cx],[data-billok],[data-billno],[data-open]');
    if (!t) return;
    if (t.dataset.role) enter(t.dataset.role);
    else if (t.dataset.view) setView(t.dataset.view);
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
    else if (t.dataset.open) toggleOpen(t.dataset.open);
  });
  $('logoutBtn').onclick = function () { state.role = null; showLogin(); };
  $('themeBtn').onclick = function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
  };
  $('cbAddBtn').onclick = cbAdd;
  $('payQ').addEventListener('input', renderPay);
  $('payF').addEventListener('change', renderPay);
  $('payM').addEventListener('change', renderPay);
  $('branchSelect').addEventListener('change', function () {
    state.branch = this.value;
    setView(state.view);
  });
  $('cbDate').value = '2026-09-15';

  fetch('data/seed.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (seed) { state.seed = JSON.parse(JSON.stringify(seed)); showLogin(); })
    .catch(function () { document.body.insertAdjacentHTML('afterbegin', '<div class="banner">Seed JSON nahi khuli — `npm start` se chalao.</div>'); });
})();
