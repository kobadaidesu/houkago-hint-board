'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const catalog = require('./public/catalog.json');

const publicDir = path.join(__dirname, 'public');
const dataDir = process.env.BOARD_DATA_DIR || (process.env.WEBSITE_SITE_NAME
  ? '/home/data/houkago-hint-board'
  : path.join(__dirname, '.local-data'));
const stateFile = path.join(dataDir, 'board.json');
const week = 7 * 24 * 60 * 60 * 1000;
const topics = new Map(catalog.map(topic => [topic.id, topic]));
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/hint-plane.webp', ['hint-plane.webp', 'image/webp']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/catalog.json', ['catalog.json', 'application/json; charset=utf-8']]
]);
fs.mkdirSync(dataDir, { recursive: true });

function activePosts() {
  let rows;
  try {
    rows = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return rows.filter(row => row.created > Date.now() - week);
}

function persist(rows) {
  const temporary = stateFile + '.' + randomUUID();
  try {
    fs.writeFileSync(temporary, JSON.stringify(rows), { mode: 0o600 });
    fs.renameSync(temporary, stateFile);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function json(res, code, value) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

async function input(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') return null;
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 1024) return null;
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { return null; }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try {
    const route = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (route === '/api/posts') return json(res, 200, activePosts());
      const asset = assets.get(route);
      if (!asset) return json(res, 404, { error: 'ページが見つかりません。' });
      res.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-cache' });
      return res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(path.join(publicDir, asset[0])));
    }
    if (req.method !== 'POST' || !['/api/posts', '/api/hints'].includes(route)) {
      return json(res, 404, { error: 'ページが見つかりません。' });
    }
    const body = await input(req);
    if (!body || !topics.has(body.topic)) return json(res, 400, { error: '質問を選んでください。' });
    // On one Node process, this synchronous read-modify-write finishes before another request can change it.
    const rows = activePosts();
    let row = rows.find(item => item.topic === body.topic);
    if (route === '/api/posts') {
      if (row) return json(res, 200, row);
      row = { id: randomUUID(), topic: body.topic, created: Date.now(), hints: [] };
      rows.unshift(row);
    } else {
      if (!row || row.id !== body.post) return json(res, 409, { error: '掲載期間が終了しました。一覧を更新してください。' });
      if (!Number.isInteger(body.hint) || body.hint < 0 || body.hint >= topics.get(body.topic).hints.length) {
        return json(res, 400, { error: '一覧からヒントを選んでください。' });
      }
      if (row.hints.includes(body.hint)) return json(res, 200, row);
      row.hints.push(body.hint);
      row.hints.sort((a, b) => a - b);
    }
    persist(rows);
    json(res, 201, row);
  } catch (error) {
    console.error('Board request failed:', error.code || error.name);
    if (!res.headersSent) return json(res, 503, { error: '保存先に接続できません。少し待ってからやり直してください。' });
    res.end();
  }
});
server.listen(Number(process.env.PORT || 8080), '0.0.0.0');
