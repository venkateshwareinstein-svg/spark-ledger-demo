#!/usr/bin/env node
'use strict';
var fs = require('fs');
var path = require('path');
var http = require('http');
var { spawn } = require('child_process');

var seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public/data/seed.json'), 'utf8'));
var fails = [];
function ok(cond, msg) { if (!cond) fails.push(msg); }

ok(seed.meta.product === 'Spark Ledger', 'product brand');
ok(seed.meta.company === 'Spark Strategy', 'company brand');
ok(seed.branches.length === 4, 'four branches');
ok(seed.khaata.length >= 5, 'doctor ledger rows');
ok(seed.payments.length >= 6, 'payment register rows');
ok(seed.bills.length >= 4, 'bill / NA rows');
ok(Object.keys(seed.cashBooks).length === 4, 'cash books per branch');
ok(seed.khaata.some(function (k) { return k.ready; }), 'at least one ready ledger');
ok(seed.khaata.some(function (k) { return k.payLater || seed.doctors.find(function (d) { return d.code === k.code && d.payLater; }); }), 'pay-later doctor present');
ok(seed.payments.some(function (p) { return p.mode === 'DIGITAL'; }), 'bank payment present');
ok(seed.payments.some(function (p) { return p.mode === 'CASH'; }), 'cash payment present');

var child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
  env: Object.assign({}, process.env, { PORT: '4179' }),
  stdio: ['ignore', 'pipe', 'pipe']
});

var killer;
function failOut(extra) {
  clearTimeout(killer);
  try { child.kill(); } catch (e) {}
  console.error('SMOKE FAIL:\n' + fails.concat(extra || []).join('\n'));
  process.exit(1);
}

function pass() {
  clearTimeout(killer);
  try { child.kill(); } catch (e) {}
  if (fails.length) failOut();
  console.log('SMOKE OK — seed shape + local server');
  process.exit(0);
}

setTimeout(function () {
  http.get('http://127.0.0.1:4179/', function (res) {
    var buf = '';
    res.on('data', function (c) { buf += c; });
    res.on('end', function () {
      ok(res.statusCode === 200, 'index http 200');
      ok(/Spark Ledger/.test(buf), 'index has Spark Ledger');
      ok(/Spark Strategy/.test(buf), 'index has Spark Strategy');
      http.get('http://127.0.0.1:4179/data/seed.json', function (r2) {
        var b2 = '';
        r2.on('data', function (c) { b2 += c; });
        r2.on('end', function () {
          ok(r2.statusCode === 200, 'seed http 200');
          ok(/Meridian Care Group/.test(b2), 'seed group name');
          pass();
        });
      }).on('error', function (e) { failOut(['seed fetch ' + e.message]); });
    });
  }).on('error', function (e) { failOut(['index fetch ' + e.message]); });
}, 400);

killer = setTimeout(function () { failOut(['server timeout']); }, 8000);
