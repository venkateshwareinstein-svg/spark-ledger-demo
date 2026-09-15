#!/usr/bin/env node
'use strict';
/**
 * Overlay-only deploy: copy public/ onto the EXISTING sparkstrategy.co.in
 * Netlify site at /ledger/demo/. Never replaces site root, /ledger/, or the
 * spark-ledger-lead form.
 *
 * Requires NETLIFY_AUTH_TOKEN for the team that owns sparkstrategy.co.in.
 */
var fs = require('fs');
var path = require('path');
var https = require('https');
var crypto = require('crypto');

var ROOT = path.join(__dirname, '..');
var PUBLIC = path.join(ROOT, 'public');
var TARGET_DOMAIN = 'sparkstrategy.co.in';
var DEMO_PREFIX = '/ledger/demo';
var TOKEN = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN || '';
var SITE_HINT = process.env.NETLIFY_SITE_ID || process.env.NETLIFY_SITE || '';

function blocker(extra) {
  var msg = [
    'BLOCKER: cannot publish https://sparkstrategy.co.in/ledger/demo/',
    '',
    'This Cloud Agent session is NOT logged into Netlify.',
    '  netlify status → Not logged in',
    '  ~/.config/netlify/config.json → telemetry cliId only (no auth token)',
    '  env → no NETLIFY_AUTH_TOKEN / NETLIFY_AUTH_TOKEN',
    '  GitHub Actions secrets → 403 (token cannot list secrets)',
    '',
    'I will not invent a token or deploy this repo as the site root',
    '(that would wipe /ledger/ and the spark-ledger-lead form).',
    '',
    'What is needed from whoever owns sparkstrategy.co.in on Netlify:',
    '  1. Log in as the team/user that already serves sparkstrategy.co.in',
    '     (DNS NS: dns*.p09.nsone.net — Netlify DNS).',
    '  2. Site identity (Site settings → General → Site details):',
    '       custom domain : sparkstrategy.co.in',
    '       site name     : unknown from outside (sparkstrategy.netlify.app 404s;',
    '                       Netlify assigned a random *.netlify.app name)',
    '       site ID       : API ID UUID from the same settings page',
    '  3. A Personal Access Token:',
    '       https://app.netlify.com/user/applications#personal-access-tokens',
    '       scopes: sites (read) + deploys (write) for that site/team.',
    '  4. Hand the token to this agent as env NETLIFY_AUTH_TOKEN',
    '     (and optionally NETLIFY_SITE_ID). Do not commit it.',
    '',
    'Then: node scripts/deploy-ledger-demo.js',
    '',
    'CLI alternative on a laptop already logged in:',
    '  netlify login',
    '  netlify link --id <SITE_ID>     # existing marketing site only',
    '  # do NOT netlify deploy --dir public --prod  (replaces the whole site)',
    '',
    'demo.sparkstrategy.co.in has no DNS. Path /ledger/demo/ is the target',
    'because /ledger/ must stay the marketing + lead form page.'
  ].join('\n');
  if (extra) msg += '\n\n' + extra;
  console.error(msg);
  process.exit(2);
}

function walk(dir, acc, prefix) {
  acc = acc || {};
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    var p = path.join(dir, ent.name);
    var rel = prefix ? prefix + '/' + ent.name : ent.name;
    if (ent.isDirectory()) walk(p, acc, rel);
    else acc[rel] = fs.readFileSync(p);
  });
  return acc;
}

function sha1(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex');
}

function api(method, urlPath, body, contentType) {
  return new Promise(function (resolve, reject) {
    var payload = body == null ? null : (Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body)));
    var req = https.request({
      hostname: 'api.netlify.com',
      path: urlPath,
      method: method,
      headers: Object.assign({
        Authorization: 'Bearer ' + TOKEN,
        Accept: 'application/json'
      }, payload ? {
        'Content-Type': contentType || 'application/json',
        'Content-Length': payload.length
      } : {})
    }, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var raw = Buffer.concat(chunks);
        var text = raw.toString('utf8');
        var parsed = text;
        try { parsed = text ? JSON.parse(text) : null; } catch (e) {}
        if (res.statusCode >= 400) {
          var err = new Error(method + ' ' + urlPath + ' → ' + res.statusCode + ' ' + text.slice(0, 400));
          err.status = res.statusCode;
          err.body = parsed;
          reject(err);
          return;
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function pickSite(sites) {
  var list = Array.isArray(sites) ? sites : [];
  var hit = list.filter(function (s) {
    var names = [s.custom_domain, s.default_domain, s.url, s.ssl_url, s.name]
      .concat(s.domain_aliases || [])
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return names.indexOf(TARGET_DOMAIN) !== -1;
  });
  if (SITE_HINT) {
    var hinted = list.filter(function (s) {
      return s.id === SITE_HINT || s.site_id === SITE_HINT || s.name === SITE_HINT;
    });
    if (hinted.length) return hinted[0];
  }
  if (hit.length === 1) return hit[0];
  if (hit.length > 1) {
    throw new Error('Multiple Netlify sites mention ' + TARGET_DOMAIN + ': ' + hit.map(function (s) { return s.name + ' (' + s.id + ')'; }).join(', '));
  }
  return null;
}

async function main() {
  if (!TOKEN) blocker();

  var local = walk(PUBLIC);
  var overlay = {};
  Object.keys(local).forEach(function (rel) {
    var urlPath = DEMO_PREFIX + '/' + rel.replace(/\\/g, '/');
    overlay[urlPath] = local[rel];
  });

  var sites = await api('GET', '/api/v1/sites?per_page=100');
  var site = pickSite(sites);
  if (!site) {
    blocker('Token worked, but no site with custom domain ' + TARGET_DOMAIN + ' is visible to it. Use a token from the owning team, or set NETLIFY_SITE_ID.');
  }
  console.log('Site: ' + site.name + '  id=' + site.id + '  domain=' + (site.custom_domain || site.url));

  var deploys = await api('GET', '/api/v1/sites/' + site.id + '/deploys?per_page=5');
  var current = (deploys || []).find(function (d) { return d.state === 'ready' || d.published_at; }) || deploys[0];
  if (!current) throw new Error('No deploys on site ' + site.id);
  var files = await api('GET', '/api/v1/deploys/' + current.id + '/files');
  if (!Array.isArray(files) || !files.length) throw new Error('Could not list files for deploy ' + current.id);

  var digest = {};
  var ledgerOk = false;
  files.forEach(function (f) {
    var p = f.path || f.id;
    if (!p) return;
    if (p.charAt(0) !== '/') p = '/' + p;
    digest[p] = f.sha;
    if (p === '/ledger/index.html' || p === '/ledger/' || p.indexOf('/ledger/index') === 0) ledgerOk = true;
  });
  if (!ledgerOk) {
    throw new Error('Refusing to deploy: current production digest has no /ledger/ page. Aborting so the lead form cannot be dropped.');
  }

  Object.keys(overlay).forEach(function (p) {
    digest[p] = sha1(overlay[p]);
  });

  console.log('Creating deploy overlay: ' + Object.keys(overlay).length + ' demo files, keeping ' + files.length + ' existing files.');
  var created = await api('POST', '/api/v1/sites/' + site.id + '/deploys', { files: digest, draft: false });
  var required = created.required || [];
  var bySha = {};
  Object.keys(overlay).forEach(function (p) {
    bySha[sha1(overlay[p])] = { path: p, buf: overlay[p] };
  });

  for (var i = 0; i < required.length; i++) {
    var need = required[i];
    var item = bySha[need];
    if (!item) {
      throw new Error('Netlify asked for sha ' + need + ' which is not one of the new demo files. Aborting (will not re-upload unknown production blobs incorrectly).');
    }
    var putPath = item.path.replace(/^\//, '');
    await api(
      'PUT',
      '/api/v1/deploys/' + created.id + '/files/' + encodeURIComponent(putPath).replace(/%2F/g, '/'),
      item.buf,
      'application/octet-stream'
    );
    console.log('Uploaded ' + item.path);
  }

  console.log('Deploy ' + created.id + ' submitted. Waiting for ready…');
  var deploy = created;
  for (var t = 0; t < 30; t++) {
    deploy = await api('GET', '/api/v1/deploys/' + created.id);
    if (deploy.state === 'ready' || deploy.state === 'current') break;
    if (deploy.state === 'error' || deploy.error_message) throw new Error('Deploy failed: ' + (deploy.error_message || deploy.state));
    await new Promise(function (r) { setTimeout(r, 2000); });
  }
  console.log('Deploy state: ' + deploy.state);
  console.log('Live path should be: https://' + TARGET_DOMAIN + '/ledger/demo/');
}

main().catch(function (err) {
  if (err && err.status === 401) blocker('Token was rejected (401). Create a new PAT for the owning team.');
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
