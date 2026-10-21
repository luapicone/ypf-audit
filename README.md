# ypf-audit

Repositorio de la herramienta web para convertir auditorías por elemento.

## Contenido

- `auditoria-web/`: aplicación web estática, lógica de cálculo, mapeos y pruebas.
- `auditoria-web/tests/ejemplo_auditoria.xlsx`: archivo de ejemplo para validar la carga.
- `auditoria-web/vendor/xlsx.full.min.js`: dependencia local para procesar planillas Excel.
- `auditoria-web.zip`: archivo comprimido original conservado en el repositorio.

## Ejecución

Abrir `auditoria-web/index.html` en un navegador o publicar esa carpeta como sitio estático.

## Prueba del cálculo

```bash
cd auditoria-web
node tests/test_calc.js
```
