/** Arranque local: npm start / npm run dev. En Vercel se usa api/index.js. */
import app from './app.js';
import { USING_POSTGRES } from './db.js';
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n  Conversor de auditorías  →  http://localhost:${PORT}`);
  console.log(`  Base de datos: ${USING_POSTGRES ? 'PostgreSQL (DATABASE_URL)' : 'PGlite local (server/data/pgdata)'}\n`);
});
