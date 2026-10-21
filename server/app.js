/**
 * app.js — API REST (login, usuarios, historial) + estáticos.
 * server/index.js la levanta en local; api/index.js la exporta como función serverless (Vercel).
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { q, one, many, ready } from './db.js';
import { seedIfEmpty } from './seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PUBLIC_DIR = join(__dirname, '..', 'public');
const JWT_SECRET = process.env.JWT_SECRET || 'ypf-audit-dev-secret-cambiar-en-produccion';
const MAX_FILE = 3 * 1024 * 1024; // Vercel limita el cuerpo de la request a ~4,5 MB

const app = express();
app.use(express.json({ limit: '4.4mb' }));

app.use('/api', (req, res, next) => {
  ready().then(seedIfEmpty).then(() => next())
    .catch((e) => { console.error(e); res.status(500).json({ error: 'Error de base de datos. ¿Está conectada la base Postgres?' }); });
});

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  console.error(e);
  if (!res.headersSent) res.status(500).json({ error: 'Error interno' });
});

/* ───────── Auth ───────── */
const sign = (u) => jwt.sign({ id: u.id, rol: u.rol, nombre: u.nombre }, JWT_SECRET, { expiresIn: '12h' });
const pub = (u) => ({ id: u.id, username: u.username, nombre: u.nombre, rol: u.rol });

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Sesión inválida o expirada' }); }
}
const soloAdmin = (req, res, next) =>
  req.user.rol === 'admin' ? next() : res.status(403).json({ error: 'Requiere perfil administrador' });

app.post('/api/auth/login', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  const u = await one('SELECT * FROM users WHERE lower(username) = lower($1)', [String(username || '').trim()]);
  if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash))
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  res.json({ token: sign(u), user: pub(u) });
}));

app.get('/api/auth/me', auth, wrap(async (req, res) => {
  const u = await one('SELECT id, username, nombre, rol FROM users WHERE id = $1', [req.user.id]);
  if (!u) return res.status(401).json({ error: 'Usuario inexistente' });
  res.json({ user: u });
}));

app.post('/api/auth/password', auth, wrap(async (req, res) => {
  const { actual, nueva } = req.body || {};
  const u = await one('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!bcrypt.compareSync(String(actual || ''), u.password_hash))
    return res.status(400).json({ error: 'La contraseña actual no es correcta' });
  if (String(nueva || '').length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  await q('UPDATE users SET password_hash = $1 WHERE id = $2', [bcrypt.hashSync(nueva, 10), u.id]);
  res.json({ ok: true });
}));

/* ───────── Usuarios (administrador) ───────── */
app.get('/api/users', auth, soloAdmin, wrap(async (_req, res) => {
  res.json(await many(`SELECT u.id, u.username, u.nombre, u.rol, u.created_at,
      (SELECT COUNT(*)::int FROM conversions c WHERE c.user_id = u.id) AS archivos
    FROM users u ORDER BY u.nombre`));
}));

app.post('/api/users', auth, soloAdmin, wrap(async (req, res) => {
  const { username, nombre, password, rol } = req.body || {};
  const un = String(username || '').trim();
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(un)) return res.status(400).json({ error: 'Usuario: 3 a 40 caracteres (letras, números, . _ -)' });
  if (!String(nombre || '').trim()) return res.status(400).json({ error: 'Falta el nombre' });
  if (String(password || '').length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  if (await one('SELECT 1 FROM users WHERE lower(username) = lower($1)', [un])) return res.status(409).json({ error: 'Ese usuario ya existe' });
  const r = rol === 'admin' ? 'admin' : 'usuario';
  const u = await one('INSERT INTO users (username, password_hash, nombre, rol) VALUES ($1,$2,$3,$4) RETURNING id, username, nombre, rol',
    [un, bcrypt.hashSync(password, 10), String(nombre).trim(), r]);
  res.status(201).json(u);
}));

app.post('/api/users/:id/password', auth, soloAdmin, wrap(async (req, res) => {
  const { password } = req.body || {};
  if (String(password || '').length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  await q('UPDATE users SET password_hash = $1 WHERE id = $2', [bcrypt.hashSync(password, 10), Number(req.params.id)]);
  res.json({ ok: true });
}));

app.delete('/api/users/:id', auth, soloAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'No podés eliminar tu propio usuario' });
  await q('DELETE FROM users WHERE id = $1', [id]); // borra también su historial (ON DELETE CASCADE)
  res.json({ ok: true });
}));

/* ───────── Historial de conversiones ───────── */
const puede = (req, c) => c && (req.user.rol === 'admin' || c.user_id === req.user.id);

app.get('/api/conversions', auth, wrap(async (req, res) => {
  const todos = req.user.rol === 'admin' && req.query.todos === '1';
  const rows = await many(`SELECT id, user_id, user_nombre, titulo, filename, size, created_at,
        resultado_json->'resumen' AS resumen
      FROM conversions ${todos ? '' : 'WHERE user_id = $1'} ORDER BY created_at DESC LIMIT 500`,
    todos ? [] : [req.user.id]);
  res.json(rows);
}));

app.post('/api/conversions', auth, wrap(async (req, res) => {
  const { titulo, filename, fileBase64, resultado } = req.body || {};
  if (!filename || !fileBase64 || !resultado || !resultado.resumen) return res.status(400).json({ error: 'Datos incompletos' });
  const buf = Buffer.from(String(fileBase64), 'base64');
  if (!buf.length) return res.status(400).json({ error: 'Archivo vacío' });
  if (buf.length > MAX_FILE) return res.status(413).json({ error: 'El archivo supera los 3 MB' });
  const row = await one(`INSERT INTO conversions (user_id, user_nombre, titulo, filename, size, file_data, resultado_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, created_at`,
    [req.user.id, req.user.nombre, String(titulo || '').trim() || null, String(filename).slice(0, 200), buf.length, buf, JSON.stringify(resultado)]);
  res.status(201).json(row);
}));

app.get('/api/conversions/:id', auth, wrap(async (req, res) => {
  const c = await one('SELECT id, user_id, user_nombre, titulo, filename, size, created_at, resultado_json AS resultado FROM conversions WHERE id = $1', [Number(req.params.id)]);
  if (!puede(req, c)) return res.status(404).json({ error: 'No encontrado' });
  res.json(c);
}));

app.get('/api/conversions/:id/file', auth, wrap(async (req, res) => {
  const c = await one('SELECT user_id, filename, file_data FROM conversions WHERE id = $1', [Number(req.params.id)]);
  if (!puede(req, c)) return res.status(404).json({ error: 'No encontrado' });
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(c.filename)}`);
  res.send(Buffer.from(c.file_data));
}));

app.patch('/api/conversions/:id', auth, wrap(async (req, res) => {
  const c = await one('SELECT user_id FROM conversions WHERE id = $1', [Number(req.params.id)]);
  if (!puede(req, c)) return res.status(404).json({ error: 'No encontrado' });
  await q('UPDATE conversions SET titulo = $1 WHERE id = $2', [String((req.body || {}).titulo || '').trim() || null, Number(req.params.id)]);
  res.json({ ok: true });
}));

app.delete('/api/conversions/:id', auth, wrap(async (req, res) => {
  const c = await one('SELECT user_id FROM conversions WHERE id = $1', [Number(req.params.id)]);
  if (!puede(req, c)) return res.status(404).json({ error: 'No encontrado' });
  await q('DELETE FROM conversions WHERE id = $1', [Number(req.params.id)]);
  res.json({ ok: true });
}));

/* ───────── Estáticos + SPA ───────── */
app.use(express.static(PUBLIC_DIR, {
  setHeaders: (r, p) => { if (/\.(css|js|html)$/.test(p)) r.setHeader('Cache-Control', 'no-store'); },
}));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'No encontrado' });
  res.sendFile(join(PUBLIC_DIR, 'index.html'));
});

export default app;
