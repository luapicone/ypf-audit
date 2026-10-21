# YPF Audit

Aplicación web estática para convertir auditorías basadas en normas ISO en resultados agrupados por elemento y subelemento.

Los archivos se procesan completamente en el navegador y no se envían a ningún servidor.

## Estructura

- `index.html`: entrada principal de la aplicación.
- `app.js`: lectura del archivo e interfaz.
- `calc.js`: motor de cálculo.
- `mapping.js`: matriz normalizada de elementos y subelementos.
- `vendor/xlsx.full.min.js`: procesamiento local de archivos Excel.
- `tests/test_calc.js`: prueba del motor de cálculo.
- `tests/ejemplo_auditoria.xlsx`: planilla de ejemplo.

## Ejecución local

Podés abrir `index.html` directamente en el navegador o servir el directorio raíz con cualquier servidor estático.

```bash
npx serve .
```

## Pruebas

```bash
node tests/test_calc.js
```

## Deploy

El repositorio está listo para desplegarse desde la raíz como sitio estático:

- Directorio raíz: `.`
- Framework: `Other`
- Build command: ninguno
- Output directory: `.`
