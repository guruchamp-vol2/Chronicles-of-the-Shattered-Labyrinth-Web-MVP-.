// server.js — Express server for Chronicles of the Shattered Labyrinth (Web MVP)
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

// Health endpoint for Render
app.get('/health', (req, res) => res.status(200).send('ok'));

// Simple FNV-1a hash to turn a string into a 32-bit seed
function fnv1a(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Daily seed (UTC) so all players see the same reshaping each day
app.get('/api/daily-seed', (req, res) => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const seed = fnv1a(dateStr);
  res.json({ date: dateStr, seed });
});

// Basic version info
app.get('/api/version', (req, res) => {
  res.json({ name: 'chronicles-shattered-labyrinth-web', version: '0.1.0' });
});

// Ephemeral relic persistence (in-memory for demo purposes)
let relics = [];
app.get('/api/relics', (req, res) => res.json(relics));
app.post('/api/relics', (req, res) => {
  const relic = req.body;
  if (!relic || typeof relic !== 'object') return res.status(400).json({ ok:false, error: 'Invalid relic' });
  relics.push({ ...relic, ts: Date.now() });
  res.json({ ok: true, relic });
});

// Fallback to app
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`\n Labyrinth server running on http://localhost:${PORT}`);
});