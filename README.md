# Conversor de auditorías por elemento (SGEO)

Sube el Excel de una auditoría (Norma · Punto · Porcentaje) y devuelve el % por elemento, usando la matriz
«Comparativa SGEO FINAL». Cada persona entra con su usuario y queda un historial de todo lo que cargó
(archivo original + resultado). El Excel de salida trae resumen con KPIs, colores por estado y gráficos.

Mismo stack y estilo que `sgeo-auditorias`: Express + Postgres + JWT, cliente en JS puro sin build.

## Correr en local
```bash
npm install
npm start        # http://localhost:4000  (usa PGlite, sin instalar nada)
```
Primer ingreso: usuario `admin`, contraseña `admin123` (o `ADMIN_USER` / `ADMIN_PASSWORD` si las definís).

## Desplegar en Vercel
1. Importar el repo en Vercel (Add New → Project). Framework: **Other**, sin build command.
2. **Storage → Create Database → Postgres** y conectarla al proyecto (inyecta `POSTGRES_URL`).
3. **Settings → Environment Variables** (antes del primer arranque):
   - `JWT_SECRET`: texto largo y aleatorio.
   - `ADMIN_PASSWORD`: contraseña inicial del usuario `admin`.
4. Redeploy. En el primer arranque se crean las tablas y el usuario administrador.
5. Entrar como `admin` → **Usuarios** → crear un usuario por persona.

## Estructura
- `server/` API (login, usuarios, historial). `api/index.js` es el entrypoint serverless.
- `public/js/calc.js` motor de cálculo · `lector.js` lectura del Excel de entrada · `excel.js` Excel de salida.
- `public/data/mapping.json` matriz normalizada (hoja «Comparativa SGEO FINAL»).
- Límite de archivo: 3 MB (límite de cuerpo de Vercel ≈ 4,5 MB).
