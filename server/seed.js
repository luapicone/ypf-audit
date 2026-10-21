/** seed.js — Crea el usuario administrador la primera vez (si no hay usuarios). */
import bcrypt from 'bcryptjs';
import { q, one } from './db.js';

let done = false;
export async function seedIfEmpty() {
  if (done) return;
  const r = await one('SELECT COUNT(*)::int AS n FROM users');
  if (r.n === 0) {
    const user = process.env.ADMIN_USER || 'admin';
    const pass = process.env.ADMIN_PASSWORD || 'admin123';
    await q('INSERT INTO users (username, password_hash, nombre, rol) VALUES ($1,$2,$3,$4)',
      [user, bcrypt.hashSync(pass, 10), 'Administrador', 'admin']);
    console.log(`Usuario administrador creado: ${user}`);
  }
  done = true;
}
