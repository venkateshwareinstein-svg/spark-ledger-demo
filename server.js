#!/usr/bin/env node
'use strict';
/**
 * Tiny static server. Seed JSON is a file in public/ — koi secret, koi live API nahi.
 * Mutations browser memory me rehti hain (demo). Process restart par seed wapas.
 */
var http = require('http');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, 'public');
var PORT = Number(process.env.PORT) || 4173;

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function send(res, code, type, body) {
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

var server = http.createServer(function (req, res) {
  var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  var rel = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  var file = path.join(ROOT, rel);
  if (file.indexOf(ROOT) !== 0) {
    send(res, 403, 'text/plain', 'Forbidden');
    return;
  }
  fs.readFile(file, function (err, buf) {
    if (err) {
      send(res, 404, 'text/plain; charset=utf-8', 'Not found');
      return;
    }
    send(res, 200, MIME[path.extname(file)] || 'application/octet-stream', buf);
  });
});

server.listen(PORT, '127.0.0.1', function () {
  console.log('Spark Ledger demo  →  http://127.0.0.1:' + PORT);
  console.log('Fictional seed only. Brand: Spark Ledger / Spark Strategy.');
});
