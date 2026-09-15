#!/usr/bin/env node
'use strict';
/**
 * Lead-demo scrub: production hospital / portal names is tree me nahi hone chahiye.
 * Seed fictional names (Meridian, Spark) allowed.
 */
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var BANNED = [
  /\bKHPL\b/i,
  /Dhanvantri/i,
  /Kabir/i,
  /Kabir Hospital/i,
  /\bDSH\b/,
  /\bDRH\b/,
  /\bGMH\b/,
  /\bDSB\b/,
  /Karexpert/i,
  /KareXpert/i,
  /\bAnjali\b/,
  /Anurag Misra/i,
  /Rakesh Sahu/i,
  /ASHISH SINGH/i,
  /SANJU PAL/i,
  /S Venkateshwar/i,
  /HasinaBegum/i,
  /UshaSharma/i,
  /Priya Thakur/,
  /Mrs Pooja/,
  /Mr Tazuddin/,
  /khpl-portal/i,
  /script\.google\.com/i
];

var SKIP_DIR = new Set(['node_modules', '.git']);
var hits = [];

function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    if (SKIP_DIR.has(ent.name)) return;
    var p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(p);
      return;
    }
    if (!/\.(js|html|css|json|md|svg|txt|example)$/i.test(ent.name)) return;
    /* checker file khud banned tokens rakhta hai — usko skip. */
    if (path.relative(ROOT, p) === path.join('scripts', 'scrub-check.js')) return;
    var text = fs.readFileSync(p, 'utf8');
    BANNED.forEach(function (re) {
      if (re.test(text)) {
        hits.push(path.relative(ROOT, p) + '  matches  ' + re);
      }
    });
  });
}

walk(ROOT);
if (hits.length) {
  console.error('SCRUB FAIL — production names leaked:\n' + hits.join('\n'));
  process.exit(1);
}
console.log('SCRUB OK — no banned production names in spark-ledger-demo/');
