// server.js — Express server (CSP relaxed to allow inline fallback)
const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json());

const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR, { maxAge: '1h', etag: true }));

app.get('/health', (req, res) => res.status(200).send('ok'));

// FNV-1a
function fnv1a(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
app.get('/api/daily-seed', (req, res) => {
  const d = new Date().toISOString().slice(0,10);
  res.json({ date: d, seed: fnv1a(d) });
});

app.get('/api/version', (req, res) => res.json({ name: 'chronicles-shattered-labyrinth-fixed', version: '0.2.0' }));

let relics = [];
app.get('/api/relics', (req, res) => res.json(relics));
app.post('/api/relics', (req, res) => { const r = req.body || {}; relics.push({ ...r, ts: Date.now() }); res.json({ ok:true }); });

app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Server on http://localhost:'+PORT));
