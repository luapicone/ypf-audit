-- Esquema PostgreSQL (Postgres real en Vercel / PGlite en local). Se ejecuta en cada arranque.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nombre        TEXT NOT NULL,
  rol           TEXT NOT NULL DEFAULT 'usuario' CHECK (rol IN ('admin','usuario')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historial: una fila por Excel subido. Se guarda el archivo original y el resultado calculado.
CREATE TABLE IF NOT EXISTS conversions (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_nombre    TEXT NOT NULL,
  titulo         TEXT,
  filename       TEXT NOT NULL,
  size           INTEGER NOT NULL,
  file_data      BYTEA NOT NULL,
  resultado_json JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversions_user_idx ON conversions(user_id, created_at DESC);
