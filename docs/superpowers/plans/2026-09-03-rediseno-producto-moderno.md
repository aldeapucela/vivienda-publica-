# Rediseño «Producto moderno» — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar vivienda.aldeapucela.org al diseño C validado (`docs/superpowers/specs/maqueta/pagina-completa.html`): claro por defecto con interruptor a oscuro, hero con la respuesta primero, ilustración de la casa, iconos funcionales, tipografía autoalojada y contraste AA comprobado en cada `npm test`.

**Architecture:** El sitio es HTML estático generado por `scripts/build.mjs` (plantillas como template strings), una hoja única `src/styles.css` y un único `src/app.js` sin dependencias. El rediseño se hace **por componentes**, de arriba abajo: primero tokens y tema (todo lo demás sigue funcionando mediante alias de las variables viejas), luego fuentes e iconos, luego cada plantilla con su CSS. Cada tarea deja la web completa y desplegable.

**Tech Stack:** Node 20 (`node:fs`, template strings), CSS con custom properties, JS sin frameworks, Chrome headless local para capturas. Ninguna dependencia npm.

**Spec:** `docs/superpowers/specs/2026-09-03-rediseno-producto-moderno.md` (léela entera antes de empezar; la maqueta está en `docs/superpowers/specs/maqueta/`).

## Global Constraints

- **Cero dependencias nuevas** (`package.json` sigue sin `dependencies`). Sin CDN, sin peticiones a terceros: las fuentes se autoalojan en `src/fonts/`.
- **Claro por defecto para todo el mundo**: no se usa `prefers-color-scheme`. Oscuro solo con `data-theme="dark"` en `<html>`, puesto por el interruptor y recordado en `localStorage` con la clave `vivienda:tema` (valores `claro` | `oscuro`).
- **Se conservan** el isotipo (`src/img/aldea-pucela.jpg`) y el morado `#6b4895`.
- **Sin JavaScript la web sigue completa**: interruptor de tema y botón «Me interesa» van `hidden` hasta que el JS los enseña.
- **Contraste**: texto ≥ 4,5:1 y componentes ≥ 3:1 en ambos temas. `scripts/check-contraste.mjs` lo comprueba y forma parte de `npm test`.
- **Ningún estado solo por color**: toda pastilla lleva texto; toda barra lleva la cifra al lado.
- **Textos** exactamente como los fija la sección «Textos» de la especificación. Lenguaje claro (invariante 7 de `CLAUDE.md`).
- **Antes de cada commit**: `npm test && node scripts/build.mjs` en verde.
- **Commits** en español, sin líneas de atribución.
- Invariantes de `CLAUDE.md` intactos: no se toca nada de `data/`, `scripts/sync.mjs`, `plazos.mjs`, `avisos.mjs` ni `contexto.mjs`.

## Herramienta de capturas (se usa en todas las tareas)

`scratch/` está en `.gitignore`. Crear `scratch/captura.sh` una vez (Tarea 1, paso 1). Uso:

```bash
bash scratch/captura.sh dist/index.html portada            # → scratch/portada-1440.png y scratch/portada-390.png
bash scratch/captura.sh dist/index.html portada-oscuro oscuro
```

Las capturas se revisan con la herramienta Read (son PNG). En móvil la página va dentro de un iframe de 390px porque Chrome en macOS no baja de 500px de ventana.

---

### Task 1: Tokens, tema claro/oscuro con interruptor y test de contraste

**Files:**
- Create: `scratch/captura.sh`
- Create: `scripts/check-contraste.mjs`
- Modify: `src/styles.css` (todo lo que hay antes de la línea `/* ---------- portada ---------- */`)
- Modify: `scripts/build.mjs` → `layout()` (líneas 107–192)
- Modify: `src/app.js` (cabecera del fichero y bloque de menú, líneas 1–36)
- Modify: `package.json` (`scripts.test`)
- Modify: `docs/privacidad.md` (sección «Y de quien visita esta web»)

**Interfaces:**
- Produces: tokens CSS `--papel --panel --tinta --tinta-suave --linea --acento --acento-fuerte --acento-fondo --acento-borde --sobre-acento --libre --libre-fondo --libre-barra --ocupada --ocupada-fondo --urge --aviso --aviso-fondo --sombra --radio-s --radio-m --radio-l --ancho` (usados por todas las tareas siguientes); alias temporales de los nombres viejos (`--brand-*`, `--tarjeta`, `--proxima*`, `--radio`) que la Tarea 8 elimina; clase `.ic` para iconos SVG; atributo `data-theme="dark"` en `<html>`; botón `[data-tema]` con `.tema__texto`.

- [ ] **Step 1: Crear la herramienta de capturas**

```bash
mkdir -p scratch && cat > scratch/captura.sh <<'EOF'
#!/bin/bash
# Uso: bash scratch/captura.sh <html> <nombre> [oscuro]
# Genera scratch/<nombre>-1440.png (escritorio) y scratch/<nombre>-390.png (móvil).
set -e
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HTML="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
NOMBRE="$2"
# Copia servida desde scratch/ con las rutas absolutas resueltas al dist/ local.
DIST="$(cd dist && pwd)"
sed -e "s|href=\"/|href=\"file://$DIST/|g" -e "s|src=\"/|src=\"file://$DIST/|g" -e "s|url(/|url(file://$DIST/|g" "$HTML" > "scratch/$NOMBRE.html"
sed -i '' -e "s|href=\"file://$DIST/promocion/\([^\"]*\)/\"|href=\"file://$DIST/promocion/\1/index.html\"|g" "scratch/$NOMBRE.html"
if [ "$3" = "oscuro" ]; then sed -i '' 's|<html lang="es">|<html lang="es" data-theme="dark">|' "scratch/$NOMBRE.html"; fi
# La hoja también lleva rutas absolutas a las fuentes.
sed -e "s|url(/fonts/|url(file://$DIST/fonts/|g" dist/styles.css > scratch/styles.css
sed -i '' -e "s|file://$DIST/styles.css|file://$(pwd)/scratch/styles.css|" "scratch/$NOMBRE.html"
cat > "scratch/$NOMBRE-marco.html" <<HTML
<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fff;height:100%}body{display:flex;align-items:center;justify-content:center}iframe{width:390px;height:1400px;border:0}</style><iframe src="$NOMBRE.html"></iframe>
HTML
"$CH" --headless=new --disable-gpu --hide-scrollbars --no-sandbox --allow-file-access-from-files --virtual-time-budget=6000 \
  --force-device-scale-factor=2 --window-size=1440,1450 --screenshot="$PWD/scratch/$NOMBRE-1440.png" "file://$PWD/scratch/$NOMBRE.html" 2>/dev/null
"$CH" --headless=new --disable-gpu --hide-scrollbars --no-sandbox --allow-file-access-from-files --virtual-time-budget=6000 \
  --force-device-scale-factor=2 --window-size=1200,1440 --screenshot="$PWD/scratch/$NOMBRE-crudo.png" "file://$PWD/scratch/$NOMBRE-marco.html" 2>/dev/null
sips -c 2800 780 "scratch/$NOMBRE-crudo.png" --out "scratch/$NOMBRE-390.png" >/dev/null && rm "scratch/$NOMBRE-crudo.png"
echo "scratch/$NOMBRE-1440.png · scratch/$NOMBRE-390.png"
EOF
node scripts/build.mjs && bash scratch/captura.sh dist/index.html antes
```

Expected: imprime las dos rutas. Abrir `scratch/antes-1440.png` con Read: es la web actual (referencia de «antes»).

- [ ] **Step 2: Escribir el test de contraste (falla antes de tocar el CSS)**

Crear `scripts/check-contraste.mjs`:

```js
#!/usr/bin/env node
// Test de contraste: falla si algún par de tokens de src/styles.css baja de lo
// que exige WCAG 2.2 AA (4,5:1 en texto, 3:1 en componentes), en claro y en
// oscuro. Lee los tokens del propio CSS: si alguien cambia un color, el test
// cambia con él.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(RAIZ, 'src/styles.css'), 'utf8');

// [primer plano, fondo, mínimo]
const PARES = [
  ['--tinta', '--papel', 4.5], ['--tinta', '--panel', 4.5],
  ['--tinta-suave', '--papel', 4.5], ['--tinta-suave', '--panel', 4.5],
  ['--acento', '--papel', 4.5], ['--acento', '--panel', 4.5], ['--acento', '--acento-fondo', 4.5],
  ['--acento-fuerte', '--panel', 4.5],
  ['--sobre-acento', '--acento', 4.5],
  ['--libre', '--libre-fondo', 4.5], ['--libre', '--panel', 4.5],
  ['--ocupada', '--ocupada-fondo', 4.5], ['--ocupada', '--panel', 4.5],
  ['--urge', '--papel', 4.5], ['--urge', '--panel', 4.5],
  ['--aviso', '--aviso-fondo', 4.5],
  ['--libre-barra', '--linea', 3],
];

function tokens(bloque) {
  const m = {};
  for (const [, k, v] of bloque.matchAll(/(--[a-z-]+)\s*:\s*(#[0-9a-f]{6})\b/gi)) m[k] = v.toLowerCase();
  return m;
}
function bloque(selector) {
  const i = css.indexOf(selector);
  if (i === -1) throw new Error(`no encuentro «${selector}» en src/styles.css`);
  return css.slice(i, css.indexOf('}', i));
}
const claro = tokens(bloque(':root {'));
const oscuro = { ...claro, ...tokens(bloque(':root[data-theme="dark"] {')) };

function luminancia(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const problemas = [];
for (const [nombre, paleta] of [['claro', claro], ['oscuro', oscuro]]) {
  for (const [fg, bg, minimo] of PARES) {
    if (!paleta[fg] || !paleta[bg]) { problemas.push(`${nombre}: falta el token ${paleta[fg] ? bg : fg}`); continue; }
    const r = ratio(paleta[fg], paleta[bg]);
    if (r < minimo) problemas.push(`${nombre}: ${fg} sobre ${bg} da ${r.toFixed(2)}:1 y el mínimo es ${minimo}:1`);
  }
}
if (problemas.length) {
  console.error('✖ Contraste insuficiente:');
  for (const p of problemas) console.error(`  · ${p}`);
  process.exit(1);
}
console.log(`✔ contraste: ${PARES.length} pares en verde, en claro y en oscuro`);
```

- [ ] **Step 3: Ejecutarlo para ver que falla con el CSS actual**

Run: `node scripts/check-contraste.mjs`
Expected: `✖ Contraste insuficiente:` con líneas `falta el token --panel` (los tokens nuevos aún no existen), salida 1.

- [ ] **Step 4: Sustituir la cabecera de `src/styles.css`**

Borrar **todo** lo que hay en `src/styles.css` desde la primera línea hasta la línea anterior a `/* ---------- portada ---------- */` y poner en su lugar:

```css
/* Vivienda · Aldea Pucela — hoja única, sin framework.
   Diseño «Producto moderno» (docs/superpowers/specs/2026-09-03-rediseno-producto-moderno.md).
   Claro por defecto para todo el mundo; el oscuro lo elige la persona con el
   interruptor de la cabecera y se recuerda en su navegador. */

:root {
  color-scheme: light;

  --papel: #f7f6fa;
  --panel: #ffffff;
  --tinta: #191623;
  --tinta-suave: #6c6682;
  --linea: #e7e3ee;

  --acento: #6b4895;
  --acento-fuerte: #5b3a86;
  --acento-fondo: #efe9f7;
  --acento-borde: #d8c9ee;
  --sobre-acento: #ffffff;

  --libre: #1a6b40;
  --libre-fondo: #e8f4ec;
  --libre-barra: #2f9160;
  --ocupada: #8a4b52;
  --ocupada-fondo: #f4eaec;
  --urge: #a4444f;
  --aviso: #6b4f0d;
  --aviso-fondo: #fbf1da;

  --sombra: 0 1px 2px rgba(25, 22, 35, .06), 0 8px 24px -16px rgba(25, 22, 35, .24);
  --radio-s: 8px;
  --radio-m: 12px;
  --radio-l: 14px;
  --ancho: 68rem;

  /* Alias de los nombres antiguos, para que los componentes que aún no se han
     rediseñado sigan funcionando. Se quitan en la última tarea del rediseño. */
  --brand-50: var(--acento-fondo);
  --brand-100: var(--acento-fondo);
  --brand-200: var(--acento-borde);
  --brand-600: var(--acento);
  --brand-700: var(--acento-fuerte);
  --brand-900: var(--tinta);
  --tarjeta: var(--panel);
  --proxima: var(--aviso);
  --proxima-fondo: var(--aviso-fondo);
  --radio: var(--radio-l);
}

/* El oscuro solo se activa a petición: nunca por la preferencia del sistema. */
:root[data-theme="dark"] {
  color-scheme: dark;

  --papel: #100e16;
  --panel: #1a1724;
  --tinta: #f3f0f8;
  --tinta-suave: #a49cba;
  --linea: #2b2539;

  --acento: #c2aee4;
  --acento-fuerte: #d8c9ee;
  --acento-fondo: #241f30;
  --acento-borde: #3d3357;
  --sobre-acento: #151021;

  --libre: #71dda3;
  --libre-fondo: #14301f;
  --libre-barra: #71dda3;
  --ocupada: #e2a3a9;
  --ocupada-fondo: #33191c;
  --urge: #e2a3a9;
  --aviso: #e8c579;
  --aviso-fondo: #33280f;

  --sombra: 0 1px 2px rgba(0, 0, 0, .4);
}

/* ---------- base ---------- */
* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--papel);
  color: var(--tinta);
  font: 1rem/1.6 Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  -webkit-text-size-adjust: 100%;
  -webkit-font-smoothing: antialiased;
}

a { color: var(--acento); }
a:hover { color: var(--acento-fuerte); }
:focus-visible { outline: 3px solid var(--acento); outline-offset: 2px; border-radius: 4px; }

h1, h2, h3 { text-wrap: balance; }
h1 {
  font: 600 clamp(1.5rem, 2.2vw + .75rem, 2.125rem)/1.12 'Inter Tight', Inter, system-ui, sans-serif;
  letter-spacing: -.025em; margin: 0 0 .5rem;
}
h2 { font: 600 1.375rem/1.2 'Inter Tight', Inter, system-ui, sans-serif; letter-spacing: -.02em; margin: 0 0 .75rem; }
h3 { font: 600 1.03rem/1.3 'Inter Tight', Inter, system-ui, sans-serif; letter-spacing: -.015em; margin: 0 0 .35rem; }

.fino { font-size: .8125rem; line-height: 1.55; color: var(--tinta-suave); }

/* Iconos de línea (sprite al principio del <body>). El tamaño lo da el font-size del sitio donde van. */
.ic {
  width: 1em; height: 1em; flex: none; vertical-align: -.12em;
  fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round;
}

/* Las transiciones solo responden a acciones y solo si la persona no ha pedido menos movimiento. */
@media (prefers-reduced-motion: no-preference) {
  a, button { transition: color .15s ease, background-color .15s ease, border-color .15s ease, transform .12s ease; }
}

.container { width: 100%; max-width: var(--ancho); margin: 0 auto; padding: 0 1.25rem; }
@media (min-width: 48rem) { .container { padding: 0 2rem; } }

.saltar {
  position: absolute; left: -9999px; top: 0; background: var(--acento); color: var(--sobre-acento);
  padding: .6rem 1rem; z-index: 100;
}
.saltar:focus { left: 0; }

/* ---------- cabecera ---------- */
.topbar {
  position: sticky; top: 0; z-index: 50;
  background: var(--papel); border-bottom: 1px solid var(--linea);
}
.topbar__inner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1.25rem; padding-block: .875rem; position: relative;
}
.topbar__acciones { display: flex; align-items: center; gap: .5rem; }

.marca { display: flex; align-items: center; gap: .7rem; text-decoration: none; color: inherit; }
.marca__isotipo { width: 40px; height: 40px; border-radius: 10px; flex: none; background: #fff; }
.marca__texto { display: flex; flex-direction: column; line-height: 1.15; }
.marca__kicker {
  font-size: .625rem; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: var(--tinta-suave);
}
.marca__titulo { font-size: 1.0625rem; font-weight: 700; color: var(--acento); }
.marca:hover .marca__titulo { color: var(--acento-fuerte); }

/* Botones de la cabecera: tema y menú. Misma forma, mismo tamaño (36px). */
.tema, .menu-boton {
  display: none; align-items: center; gap: .45rem;
  font: inherit; font-size: .8125rem; font-weight: 500; cursor: pointer;
  background: transparent; color: var(--tinta);
  border: 1px solid var(--linea); border-radius: var(--radio-s); padding: .45rem .75rem; min-height: 36px;
}
.tema:hover, .menu-boton:hover { border-color: var(--acento); color: var(--acento); }
.tema:not([hidden]) { display: inline-flex; }
.tema .ic, .menu-boton .ic { font-size: 1rem; }
.tema__sol { display: none; }
:root[data-theme="dark"] .tema__sol { display: inline; }
:root[data-theme="dark"] .tema__luna { display: none; }
.menu-boton__cruz { display: none; }
.menu-boton[aria-expanded="true"] .menu-boton__barras { display: none; }
.menu-boton[aria-expanded="true"] .menu-boton__cruz { display: inline; }

/* En pantallas estrechas los dos botones se quedan en icono: con las etiquetas
   la fila mide más que la pantalla y arrastra toda la página. */
@media (max-width: 29.99rem) {
  .tema, .menu-boton { padding: .45rem .6rem; gap: 0; }
  .tema__texto, .menu-boton__texto {
    position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%);
  }
}

/* ---------- menú ---------- */
.menu { display: flex; flex-wrap: wrap; gap: .25rem 1.6rem; font-size: .9rem; }
.menu a {
  text-decoration: none; color: var(--tinta); padding: .35rem 0;
  border-bottom: 2px solid transparent; white-space: nowrap;
}
.menu a:hover { color: var(--acento); }
.menu a[aria-current] { font-weight: 600; border-color: var(--acento); }

/* Con JavaScript el menú se plega por debajo de 62rem; sin él se queda a la
   vista, que es mejor que un botón que no hace nada. */
@media (max-width: 61.99rem) {
  .con-js .menu-boton { display: inline-flex; }
  .con-js .menu {
    display: none;
    position: absolute; top: 100%; left: 0; right: 0; z-index: 60;
    flex-direction: column; gap: 0;
    background: var(--panel); border-bottom: 1px solid var(--linea);
    box-shadow: 0 14px 30px rgba(25, 22, 35, .12);
    padding: .35rem 1.25rem 1rem;
  }
  .con-js .menu.abierto { display: flex; }
  .con-js .menu a {
    padding: .8rem .25rem .8rem .6rem; border-bottom: 1px solid var(--linea);
    border-left: 3px solid transparent;
  }
  .con-js .menu a:last-child { border-bottom: 0; }
  .con-js .menu a:hover, .con-js .menu a[aria-current] {
    border-bottom-color: var(--linea); border-left-color: var(--acento); background: var(--acento-fondo);
  }
}

/* Aire entre la cabecera y el contenido. Selector de etiqueta + clase a
   propósito: `main` también es `.container`, y `.container` fija el padding. */
main.principal { padding-block: 2.125rem 3.5rem; }
@media (min-width: 48rem) { main.principal { padding-block: 3.25rem 4.5rem; } }

/* Aviso de datos rancios: solo aparece si la actualización automática lleva días parada. */
.rancio {
  margin: 0; padding: .7rem 1rem; text-align: center; font-size: .9rem;
  background: var(--aviso-fondo); color: var(--aviso);
  border-bottom: 1px solid var(--linea);
}

```

- [ ] **Step 5: Ejecutar el test de contraste y ver que pasa**

Run: `node scripts/check-contraste.mjs`
Expected: `✔ contraste: 17 pares en verde, en claro y en oscuro`. Si algún par falla, **se cambia el color, no el test**.

- [ ] **Step 6: Añadirlo a `npm test`**

En `package.json`, la clave `"test"` pasa a:

```json
"test": "node scripts/sync.mjs --self-test && node scripts/plazos.mjs --self-test && node scripts/avisos.mjs --self-test && node scripts/contexto.mjs --self-test && node scripts/check-privacidad.mjs && node scripts/check-contraste.mjs",
```

Run: `npm test` → termina con `✔ contraste: 17 pares en verde…`.

- [ ] **Step 7: El `<head>` aplica el tema guardado antes de pintar, y la cabecera lleva el interruptor**

En `scripts/build.mjs`, dentro de `layout()`, sustituir la línea

```js
<script>document.documentElement.className += ' con-js';</script>
```

por

```js
<script>document.documentElement.className += ' con-js';
try { if (localStorage.getItem('vivienda:tema') === 'oscuro') document.documentElement.setAttribute('data-theme', 'dark'); } catch (e) {}</script>
```

y sustituir el bloque de la cabecera (desde `<header class="topbar">` hasta `</header>`) por:

```js
<header class="topbar">
  <div class="container topbar__inner">
    ${marca()}
    <nav class="menu" id="menu-principal" aria-label="Menú principal">
      <a href="/"${activo === 'inicio' ? ' aria-current="page"' : ''}>Promociones</a>
      <a href="/avisos/"${activo === 'avisos' ? ' aria-current="page"' : ''}>Avisos y plazos</a>
      <a href="/como-funciona/"${activo === 'como' ? ' aria-current="page"' : ''}>Cómo funciona</a>
      <a href="/datos/"${activo === 'datos' ? ' aria-current="page"' : ''}>Datos abiertos</a>
      <a href="https://aldeapucela.org" rel="noopener">La comunidad</a>
    </nav>
    <div class="topbar__acciones">
      ${botonTema()}
      <button class="menu-boton" type="button" aria-expanded="false" aria-controls="menu-principal">
        <svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path class="menu-boton__barras" d="M4 7h16M4 12h16M4 17h16"/>
          <path class="menu-boton__cruz" d="M6 6l12 12M18 6L6 18"/>
        </svg>
        <span class="menu-boton__texto">Menú</span>
      </button>
    </div>
  </div>
</header>
```

y añadir, justo debajo de la función `marca()`, esta función:

```js
/**
 * Interruptor claro/oscuro. Va oculto hasta que el JS lo enseña: sin JS no
 * haría nada. Los dos iconos van inline (no en el sprite) porque este botón
 * también sale en la vista previa de un solo fichero.
 */
function botonTema() {
  return `<button class="tema" type="button" data-tema hidden aria-pressed="false" aria-label="Cambiar a tema oscuro">
        <svg class="ic tema__luna" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
        <svg class="ic tema__sol" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        <span class="tema__texto">Oscuro</span>
      </button>`;
}
```

- [ ] **Step 8: El JS del interruptor**

En `src/app.js`, sustituir el comentario de cabecera (líneas 1–7) por:

```js
// Único JS del sitio. Hace cuatro cosas y ninguna necesita servidor:
//   1. abrir y cerrar el menú en pantallas pequeñas;
//   2. cambiar entre tema claro y oscuro, y recordarlo en ESTE navegador;
//   3. filtrar las tarjetas de la portada;
//   4. recordar en ESTE navegador qué promociones te interesan.
//
// Todo el contenido viene ya renderizado en el HTML, así que sin JavaScript la
// web sigue completa: el menú se ve desplegado, sale todo en claro y salen
// todas las promociones.
```

y, justo después del bloque del menú (después de la línea `menu.addEventListener('click', function (e) { if (e.target.tagName === 'A') abre(false); });` y su `}` de cierre), añadir:

```js
  // ---------- tema claro / oscuro ----------
  // Claro para todo el mundo salvo que la persona pida oscuro. La elección se
  // guarda aquí, en su navegador; el <head> la aplica antes de pintar nada.
  var CLAVE_TEMA = 'vivienda:tema';
  var botonTema = document.querySelector('[data-tema]');
  if (botonTema) {
    var pintaTema = function () {
      var oscuro = document.documentElement.getAttribute('data-theme') === 'dark';
      botonTema.hidden = false;
      botonTema.setAttribute('aria-pressed', oscuro ? 'true' : 'false');
      botonTema.setAttribute('aria-label', oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
      var texto = botonTema.querySelector('.tema__texto');
      if (texto) texto.textContent = oscuro ? 'Claro' : 'Oscuro';
    };
    botonTema.addEventListener('click', function () {
      var aOscuro = document.documentElement.getAttribute('data-theme') !== 'dark';
      if (aOscuro) document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem(CLAVE_TEMA, aOscuro ? 'oscuro' : 'claro'); } catch (e) { /* modo privado */ }
      pintaTema();
    });
    pintaTema();
  }
```

- [ ] **Step 9: Documentar la preferencia en la página de privacidad**

En `docs/privacidad.md`, en la lista de «Y de quien visita esta web», añadir tras la primera viñeta:

```markdown
- Si eliges el tema oscuro, esa preferencia se guarda en tu navegador, igual que las promociones
  que marcas: no viaja a ningún servidor.
```

- [ ] **Step 10: Construir y comprobar**

Run: `npm test && node scripts/build.mjs && grep -c 'data-tema' dist/index.html && grep -c "vivienda:tema" dist/index.html && grep -c 'prefers-color-scheme' dist/styles.css`
Expected: tests en verde; `1`, `1`, y `0` (ya no queda ninguna media query de esquema de color).

Run: `bash scratch/captura.sh dist/index.html t1 && bash scratch/captura.sh dist/index.html t1-oscuro oscuro`
Abrir con Read `scratch/t1-1440.png`, `scratch/t1-390.png` y `scratch/t1-oscuro-1440.png`. Comprobar: cabecera con «Oscuro» a la derecha del menú; en 390 el botón «Menú» y el de tema se ven como iconos; la versión oscura es legible en todos los bloques (aún con el diseño viejo).

- [ ] **Step 11: Prueba de teclado y sin JS (manual, 2 minutos)**

Servir `dist/` (`python3 -m http.server 8000 --directory dist`), abrir `http://localhost:8000/` en Chrome:
- Tab desde el principio: «Saltar al contenido» → marca → enlaces del menú → botón «Oscuro» (foco visible en morado) → Enter cambia a oscuro y el botón dice «Claro»; recargar: sigue oscuro.
- Desactivar JavaScript (DevTools → Command+Shift+P → «Disable JavaScript») y recargar: web clara, sin botón de tema, menú desplegado.

- [ ] **Step 12: Commit**

```bash
git add scripts/check-contraste.mjs src/styles.css scripts/build.mjs src/app.js package.json docs/privacidad.md
git commit -m "Tokens nuevos, tema claro por defecto con interruptor a oscuro y test de contraste"
```

---

### Task 2: Fuentes autoalojadas (Inter e Inter Tight)

**Files:**
- Create: `src/fonts/inter.woff2`, `src/fonts/inter-tight.woff2`, `src/fonts/LICENCIA.txt`
- Modify: `src/styles.css` (añadir `@font-face` al principio, antes de `:root {`)
- Modify: `scripts/build.mjs` (junto a `copiaDir('src/img', 'img');`)
- Modify: `README.md` (tabla «Estructura»)

**Interfaces:**
- Produces: familias `Inter` (400–700) e `'Inter Tight'` (500–700) disponibles en `/fonts/`. Los `font-family` ya están escritos en la Tarea 1.

- [ ] **Step 1: Descargar los dos ficheros (una sola vez, desde el equipo de desarrollo)**

Google Fonts sirve una versión variable de cada familia, subconjunto latino, en un único woff2 (~24 KB). Se pide con user-agent de Chrome para obtener woff2, y se guarda el fichero, no el enlace:

```bash
mkdir -p src/fonts
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
for par in "Inter:wght@400..700|inter" "Inter+Tight:wght@500..700|inter-tight"; do
  fam="${par%%|*}"; out="${par##*|}"
  url=$(curl -s "https://fonts.googleapis.com/css2?family=$fam&display=swap" -H "User-Agent: $UA" \
    | python3 -c "
import re,sys; css=sys.stdin.read()
for b in re.findall(r'@font-face \{(.*?)\}', css, re.S):
    if 'U+0000-00FF' in b: print(re.search(r'url\((https://[^)]+)\)', b).group(1)); break")
  curl -s -o "src/fonts/$out.woff2" "$url" && echo "$out.woff2: $(wc -c < src/fonts/$out.woff2) bytes"
done
```

Expected: dos ficheros de entre 20 y 60 KB. Si el rango `400..700` devuelve 400, repetir con `wght@400;500;600;700`: la URL será la misma para todos los pesos (fuente variable) y basta con la primera.

Crear `src/fonts/LICENCIA.txt`:

```
Inter (Rasmus Andersson) e Inter Tight (Rasmus Andersson, Google Fonts) se distribuyen bajo la
SIL Open Font License 1.1: https://openfontlicense.org
Se autoalojan aquí para que esta web no haga ninguna petición a terceros.
```

- [ ] **Step 2: Declararlas en el CSS**

Al principio de `src/styles.css`, **antes** de `:root {` (justo después del comentario de cabecera), añadir:

```css
@font-face {
  font-family: Inter; font-style: normal; font-weight: 400 700; font-display: swap;
  src: url(/fonts/inter.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Inter Tight'; font-style: normal; font-weight: 500 700; font-display: swap;
  src: url(/fonts/inter-tight.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
```

- [ ] **Step 3: Copiarlas al sitio generado**

En `scripts/build.mjs`, después de `copiaDir('src/img', 'img');` añadir `copiaDir('src/fonts', 'fonts');`.

- [ ] **Step 4: Comprobar que no hay ninguna petición a terceros**

Run: `node scripts/build.mjs && ls dist/fonts && grep -rl 'fonts.googleapis\|fonts.gstatic\|cdn\.' dist/*.html dist/styles.css || echo "sin terceros"`
Expected: `inter.woff2 inter-tight.woff2 LICENCIA.txt` y `sin terceros`.

Run: `bash scratch/captura.sh dist/index.html t2` y abrir `scratch/t2-1440.png`: los titulares se ven en Inter Tight (más compacta que la fuente del sistema, con la «a» de dos pisos y tracking negativo).

- [ ] **Step 5: README**

En la tabla «Estructura» de `README.md`, añadir tras la fila de `src/styles.css`:

```markdown
| `src/fonts/` | Inter e Inter Tight (OFL) autoalojadas: la web no hace ninguna petición a terceros. |
```

- [ ] **Step 6: Commit**

```bash
npm test && node scripts/build.mjs
git add src/fonts src/styles.css scripts/build.mjs README.md
git commit -m "Fuentes Inter e Inter Tight autoalojadas"
```

---

### Task 3: Sprite de iconos y helper `icono()`

**Files:**
- Modify: `scripts/build.mjs` (constante `ICONOS` y funciones `sprite()` e `icono()` junto a `marca()`; `layout()` justo tras `<body>`)

**Interfaces:**
- Produces: `icono(nombre)` → `<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-${nombre}"/></svg>`. Nombres válidos: `llave reloj edificio vecinos baja doc ok flecha pin campana`. `sprite()` se emite una vez por página, justo después de `<body>`.

- [ ] **Step 1: Añadir el sprite y el helper**

En `scripts/build.mjs`, debajo de `botonTema()`:

```js
// Iconos de línea, 24×24, trazo 1.75. Los dibuja el sprite una vez por página y
// cada uso es un <use>: sin librería, sin peticiones, sin fuentes de iconos.
const ICONOS = {
  llave: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M14 6l3 3M16.5 3.5l3 3"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  edificio: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3"/>',
  vecinos: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4.5-6.2"/>',
  baja: '<path d="m3 7 7 7 4-4 7 7M15 17h6v-6"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
  campana: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
};

function sprite() {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
${Object.entries(ICONOS).map(([n, d]) => `  <symbol id="i-${n}" viewBox="0 0 24 24">${d}</symbol>`).join('\n')}
</svg>`;
}

function icono(nombre) {
  if (!ICONOS[nombre]) throw new Error(`icono desconocido: ${nombre}`);
  return `<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-${nombre}"/></svg>`;
}
```

En `layout()`, sustituir la línea `<body>` por:

```js
<body>
${sprite()}
```

- [ ] **Step 2: Comprobar**

Run: `node scripts/build.mjs && grep -c '<symbol id="i-' dist/index.html && grep -c '<symbol id="i-' dist/avisos/index.html`
Expected: `10` y `10`.

Run: `node -e "import('./scripts/build.mjs')" 2>&1 | grep -i 'icono desconocido' || echo "sin iconos rotos"`
Expected: `sin iconos rotos`.

- [ ] **Step 3: Commit**

```bash
npm test && node scripts/build.mjs
git add scripts/build.mjs
git commit -m "Sprite de iconos de línea y helper icono()"
```

---

### Task 4: Hero de portada con la respuesta primero

**Files:**
- Move: `docs/superpowers/specs/maqueta/promocion.jpg` → `src/img/promocion.jpg`
- Modify: `scripts/build.mjs` → `paginaPortada()` (sección `<section class="hero">…</section>` y su variable `libres`), `resumenContexto()`
- Modify: `src/styles.css` (sección `/* ---------- portada ---------- */`)

**Interfaces:**
- Consumes: `icono()` (T3), tokens (T1), `reparto()`, `ofrece()`, `plazosVivos()`, `cuentaAtras()`, `dias()`, `contextoDe()`, `conjuntoDe()`, `esc()`, `suma()`, `COMPROBADO`, `HOY`.
- Produces: clases `.hero .hero__cifra .hero__num .hero__que .hero__hechos .hero__acciones .hero__enlace .hero__dibujo .franja .boton .seccion .seccion__titulo` (las tres últimas las reutilizan T5–T7).

- [ ] **Step 1: La ilustración entra en `src/img/`**

```bash
git mv docs/superpowers/specs/maqueta/promocion.jpg src/img/promocion.jpg
sed -i '' 's|/img/promocion.jpg|/img/promocion.jpg|' docs/superpowers/specs/maqueta/portada.html
```

(`copiaDir('src/img', 'img')` ya la lleva a `dist/`. La referencia de la maqueta ya apunta a `/img/promocion.jpg`, así que el `sed` es un no-op de comprobación.)

- [ ] **Step 2: Nueva plantilla del hero**

En `paginaPortada()`, sustituir desde `const cuerpo = \`` hasta el `</section>` que cierra `<section class="hero">` (inclusive, incluyendo la línea `${resumenContexto(promociones)}`) por:

```js
  // Dónde están las viviendas que se pueden pedir, agrupadas por municipio y
  // de más a menos, para decirlo en una línea: «59 en Valladolid · 18 en Medina».
  const porLocalidad = new Map();
  for (const p of disponibles) {
    if (!p.disponibilidad.libres) continue;
    porLocalidad.set(p.localidad, (porLocalidad.get(p.localidad) ?? 0) + p.disponibilidad.libres);
  }
  const donde = [...porLocalidad.entries()].sort((a, b) => b[1] - a[1])
    .map(([loc, n]) => `<b>${n}</b> en ${esc(loc)}`).join(' · ');
  const proximo = plazosVivos().filter((z) => z.fin)[0] ?? null;
  const urge = proximo && dias(HOY, proximo.fin) <= 3;
  const localidadPlazo = proximo ? (promociones.find((x) => x.id === proximo.promocion_id)?.localidad ?? nombrePromocion(proximo.promocion_id)) : '';
  const cuandoComprobado = dias(COMPROBADO, HOY) === 0 ? 'hoy' : dias(COMPROBADO, HOY) === 1 ? 'ayer' : `el ${esc(COMPROBADO)}`;

  const cuerpo = `
<section class="hero">
  ${libres ? `<h1 class="hero__cifra">
    <span class="hero__num">${libres}</span>
    <span class="hero__que">viviendas públicas se pueden pedir hoy en Valladolid</span>
  </h1>` : `<h1 class="hero__cifra">
    <span class="hero__que">Ahora mismo no hay viviendas públicas que se puedan pedir en Valladolid</span>
  </h1>`}
  <figure class="hero__dibujo"><img src="/img/promocion.jpg" alt="" width="1200" height="768" decoding="async"></figure>
  <div>
    <ul class="hero__hechos">
      ${donde ? `<li>${icono('pin')}<span>${donde}</span></li>` : ''}
      ${proximo ? `<li>${icono('reloj')}<span><span${urge ? ' class="urge"' : ''}>${esc(cuentaAtras(proximo))}</span> para pedir las de ${esc(localidadPlazo)}</span></li>` : ''}
      <li>${icono('ok')}<span>Comprobado ${cuandoComprobado} en la web oficial</span></li>
    </ul>
    <div class="hero__acciones">
      <a class="boton" href="#listado">${libres ? `Ver las ${libres} viviendas` : 'Ver las promociones'} ${icono('flecha')}</a>
      <a class="hero__enlace" href="/como-funciona/">Cómo se pide una</a>
    </div>
  </div>
</section>

<div class="franja-bloque">
<p class="franja">
  <span>${icono('edificio')}<b>${deValladolid.length}</b> promociones en la provincia</span>
  <span>${icono('llave')}<b>${viviendas || '—'}</b> viviendas anunciadas</span>
  <span>${icono('ok')}<b>${repartidas}</b> ${repartidas === 1 ? 'ya repartida' : 'ya repartidas'}</span>
</p>
<details class="fino franja__nota">
  <summary>Por qué este número puede no cuadrar con la web oficial</summary>
  <p>La tabla de la web oficial no se actualiza al ritmo del procedimiento: en una promoción ya sorteada
     puede seguir marcando viviendas «libres» que en realidad están adjudicadas. Aquí solo se cuentan
     como disponibles las de promociones sin reparto en marcha. El último cambio en los datos es del
     ${esc(indice.actualizado)}.</p>
</details>
${resumenContexto(promociones)}
</div>
```

El resto del cuerpo (`${bloquePlazos(plazosVivos())}` en adelante) se queda como está.

- [ ] **Step 3: El resumen de contexto, en una línea**

Sustituir el `return` de `resumenContexto()` por:

```js
  return `<p class="fino franja__contexto">${bajan.length} de las ${conDato.length} promociones están en municipios que
     pierden población (<a href="${esc(conjuntoDe('poblacion').ficha)}" rel="noopener">Junta de Castilla y León</a>, ${esc(String(anio))}).</p>`;
```

- [ ] **Step 4: CSS del hero, la franja y las secciones**

En `src/styles.css`, sustituir las reglas `.hero { … }`, `.hero__sub { … }` y la antigua `.fino { font-size: .85rem; … }` de esta sección (la nueva `.fino` ya está en la base; dejar `.cifras*` intactas: aún las usa la ficha) por:

```css
/* ---------- portada: hero con la respuesta primero ---------- */
.hero { display: grid; gap: 1.375rem; align-items: center; margin-bottom: 1.875rem; }
@media (min-width: 52rem) {
  .hero { grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); grid-template-rows: auto auto; column-gap: 2.5rem; row-gap: 0; }
  .hero__dibujo { grid-column: 2; grid-row: 1 / 3; align-self: center; }
  .hero__cifra { grid-column: 1; grid-row: 1; }
  .hero > div { grid-column: 1; grid-row: 2; }
}
.hero__cifra { margin: 0; display: flex; flex-direction: column; letter-spacing: 0; }
.hero__num {
  font: 600 clamp(4.5rem, 9vw, 6.75rem)/.9 'Inter Tight', Inter, system-ui, sans-serif;
  letter-spacing: -.045em; color: var(--acento); font-variant-numeric: tabular-nums;
}
.hero__que {
  font: 600 clamp(1.5rem, 2.2vw + .75rem, 2.125rem)/1.12 'Inter Tight', Inter, system-ui, sans-serif;
  letter-spacing: -.025em; margin-top: .5rem; max-width: 16ch; text-wrap: balance;
}
.hero__hechos { list-style: none; margin: 1.375rem 0 0; padding: 0; display: grid; gap: .625rem; font-size: .97rem; line-height: 1.45; }
.hero__hechos li { display: flex; gap: .7rem; align-items: flex-start; }
.hero__hechos .ic { font-size: 1.25rem; color: var(--acento); margin-top: .05em; }
.hero__hechos b { font-weight: 600; }
.hero__hechos .urge { color: var(--urge); font-weight: 600; }
.hero__acciones { display: flex; flex-wrap: wrap; gap: .625rem 1.125rem; align-items: center; margin-top: 1.5rem; }
.hero__enlace { font-size: .9rem; font-weight: 500; color: var(--acento); text-decoration: none; border-bottom: 1px solid transparent; }
.hero__enlace:hover { border-bottom-color: currentColor; }

/* La ilustración se funde con el papel: multiply borra su fondo crema y la
   máscara radial evita el rectángulo. En oscuro se invierte y se funde con screen. */
.hero__dibujo { position: relative; margin: 0; min-width: 0; }
.hero__dibujo img {
  display: block; width: 100%; height: auto; border-radius: 16px;
  mix-blend-mode: multiply;
  -webkit-mask-image: radial-gradient(ellipse 62% 58% at 52% 50%, #000 48%, transparent 100%);
  mask-image: radial-gradient(ellipse 62% 58% at 52% 50%, #000 48%, transparent 100%);
}
:root[data-theme="dark"] .hero__dibujo img { mix-blend-mode: screen; filter: invert(1) hue-rotate(180deg) saturate(.9); }
@media (max-width: 51.99rem) {
  .hero__dibujo { order: -1; max-height: 190px; overflow: hidden; }
  .hero__dibujo img {
    object-fit: cover; height: 190px;
    -webkit-mask-image: linear-gradient(0deg, transparent 0%, #000 45%); mask-image: linear-gradient(0deg, transparent 0%, #000 45%);
  }
}

/* Botón primario: una sola forma en toda la web. */
.boton {
  display: inline-flex; align-items: center; gap: .45rem; padding: .6rem .95rem; border-radius: var(--radio-s);
  background: var(--acento); color: var(--sobre-acento); font-size: .9rem; font-weight: 600; text-decoration: none;
  border: 0; cursor: pointer; font-family: inherit; box-shadow: var(--sombra);
}
.boton:hover { background: var(--acento-fuerte); color: var(--sobre-acento); transform: translateY(-1px); }
.boton .ic { font-size: 1rem; }

/* Franja de cifras de contexto, bajo el hero. */
.franja {
  display: flex; flex-wrap: wrap; gap: .5rem 1.625rem; margin: 0 0 .5rem; padding-top: 1rem;
  border-top: 1px solid var(--linea); font-size: .85rem; color: var(--tinta-suave);
}
.franja span { display: inline-flex; align-items: center; gap: .45rem; }
.franja b { color: var(--tinta); font-weight: 600; font-variant-numeric: tabular-nums; }
.franja__nota { margin: 0 0 .35rem; }
.franja__nota summary { cursor: pointer; color: var(--acento); }
.franja__nota p { margin: .4rem 0 0; max-width: 70ch; }
.franja__contexto { margin: 0; max-width: 70ch; }
.franja-bloque { margin-bottom: 2.75rem; }

/* Secciones de portada y ficha: título pequeño con icono, contenido debajo. */
.seccion { margin-bottom: 2.75rem; }
@media (min-width: 48rem) { .seccion { margin-bottom: 3.25rem; } }
.seccion__titulo {
  display: flex; align-items: center; gap: .5rem; margin: 0 0 .75rem;
  font: 600 .8125rem/1.4 Inter, system-ui, sans-serif; letter-spacing: .02em; color: var(--tinta-suave);
}
.seccion__titulo .ic { font-size: 1rem; }
```

- [ ] **Step 5: Comprobar**

Run: `npm test && node scripts/build.mjs && ls dist/img/promocion.jpg && grep -c 'hero__num' dist/index.html`
Expected: fichero presente; `1` (hay viviendas libres hoy) o `0` si `libres` es 0 (entonces debe salir `Ahora mismo no hay`).

Run: `bash scratch/captura.sh dist/index.html t4 && bash scratch/captura.sh dist/index.html t4-oscuro oscuro` y abrir las tres imágenes:
- 1440: cifra grande a la izquierda con los tres hechos y el botón debajo; ilustración a la derecha fundida sin bordes rectangulares; franja con tres cifras e iconos; el `<details>` cerrado debajo.
- 390: ilustración arriba recortada a 190px con fundido inferior, cifra debajo, nada cortado por la derecha.
- oscuro: la ilustración se ve en trazos claros sobre fondo oscuro (no un rectángulo negro ni crema). Si sale un rectángulo, revisar que la regla `:root[data-theme="dark"] .hero__dibujo img` esté después de la regla base.

- [ ] **Step 6: Commit**

```bash
git add src/img/promocion.jpg docs/superpowers/specs/maqueta scripts/build.mjs src/styles.css
git commit -m "Portada: hero con la cifra primero, ilustración y franja de cifras"
```

---

### Task 5: Tarjetas de promoción, chips de filtro y secciones de portada

**Files:**
- Modify: `scripts/build.mjs` → `tarjeta()`, `paginaPortada()` (las secciones «Lo que sigues», filtros, listado y `ultimosAvisos()`), `botonSeguir()`
- Modify: `src/styles.css` (secciones `/* ---------- filtros ---------- */` y `/* ---------- tarjetas ---------- */`; reglas `.seguir*` y `.estado*`)

**Interfaces:**
- Consumes: `.seccion`, `.seccion__titulo`, `icono()`; los atributos que lee `app.js` **no cambian**: `.tarjeta[data-provincia][data-libres]`, `[data-seguir]`, `.filtros button` con `data-provincia`/`data-estado` y la clase `.activo`, `#listado`, `#lo-tuyo`, `#tuyo-listado`, `#vacio`, `#novedades`, `[data-fecha]`, `[data-resumen]`.
- Produces: `.tarjeta__alto .tarjeta__lugar .tarjeta__pie .pastilla .pastilla--libre .pastilla--completa .pastilla--reparto .pastilla--pendiente .barra .barra--vacia`.

- [ ] **Step 1: Nueva tarjeta**

Sustituir la función `tarjeta(p)` completa por:

```js
function tarjeta(p) {
  const d = p.disponibilidad ?? {};
  const r = reparto(p.id);
  let clase = 'pendiente';
  let etiqueta = 'Sin tabla';
  let pie = p.n_viviendas ? `${p.n_viviendas} viviendas` : '';
  if (r.estado === 'adjudicada') {
    clase = 'completa'; etiqueta = 'Adjudicada';
    pie = r.desde ? `Adjudicada el ${r.desde}` : pie;
  } else if (r.estado === 'en_reparto') {
    clase = 'reparto'; etiqueta = 'En reparto';
  } else if (d.publicada) {
    clase = d.libres > 0 ? 'libre' : 'completa';
    etiqueta = d.libres > 0 ? `${d.libres} libres` : 'Completa';
    pie = `${d.libres} de ${d.total} libres`;
  }
  const marcaFiltro = r.estado !== 'sin_reparto' ? 'reparto'
    : d.publicada ? (d.libres > 0 ? 'si' : 'no') : 'sin-tabla';
  const conPlazo = plazosVivos(p.id).length > 0;
  const ocupacion = d.publicada && d.total ? Math.round((d.libres / d.total) * 100) : null;
  const lugar = [p.localidad, p.provincia && p.provincia !== p.localidad ? p.provincia : null, p.estado_obra?.toLowerCase()]
    .filter(Boolean).map(esc).join(' · ');

  return `  <li class="tarjeta" data-provincia="${esc(p.provincia ?? '')}" data-libres="${marcaFiltro}">
    <article>
      <div class="tarjeta__alto">
        <div>
          <h2><a href="/promocion/${esc(p.id)}/">${esc(minusculiza(p.nombre, [...NOMBRES_PROPIOS, p.localidad, p.provincia]))}</a></h2>
          <p class="tarjeta__lugar">${lugar}</p>
        </div>
        <span class="pastilla pastilla--${clase}">${esc(etiqueta)}</span>
      </div>
      ${ocupacion != null ? `<div class="barra${ocupacion ? '' : ' barra--vacia'}" role="img" aria-label="${d.libres} de ${d.total} libres"><i style="width:${ocupacion}%"></i></div>` : ''}
      <div class="tarjeta__pie">
        ${pie ? `<span>${esc(pie)}</span>` : ''}
        ${conPlazo ? `<span>${icono('reloj')} Plazo abierto</span>` : ''}
        ${botonSeguir(p.id)}
      </div>
    </article>
  </li>`;
}
```

- [ ] **Step 2: Secciones de la portada con título e icono**

En `paginaPortada()`, sustituir el bloque que va desde `<section class="bloque bloque--tuyo" id="lo-tuyo" hidden>` hasta `<p class="vacio" id="vacio" hidden>No hay promociones con ese filtro.</p>` (inclusive) por:

```js
<section class="seccion" id="lo-tuyo" hidden>
  <h2 class="seccion__titulo">${icono('campana')}Lo que sigues</h2>
  <ul class="tarjetas" id="tuyo-listado"></ul>
  <p class="fino">Vuelve a pulsar «La sigues» en una promoción para quitarla de aquí.</p>
</section>

<section class="seccion">
  <h2 class="seccion__titulo">${icono('edificio')}Promociones</h2>
  <div class="filtros" role="group" aria-label="Filtros">
    <div class="filtros__grupo" role="group" aria-label="Provincia">
      <button type="button" data-provincia="Valladolid" class="activo">Valladolid</button>
      <button type="button" data-provincia="todas">Toda Castilla y León</button>
    </div>
    <span class="filtros__separa" aria-hidden="true"></span>
    <div class="filtros__grupo" role="group" aria-label="Situación">
      <button type="button" data-estado="todas" class="activo">Todas</button>
      <button type="button" data-estado="libres">Se pueden pedir</button>
      <button type="button" data-estado="reparto">En reparto o adjudicadas</button>
      <button type="button" data-estado="sin-tabla">Aún sin tabla</button>
    </div>
  </div>
  <ul class="tarjetas" id="listado">
${ordenadas(promociones).map(tarjeta).join('\n')}
  </ul>
  <p class="vacio fino" id="vacio" hidden>No hay promociones con ese filtro.</p>
</section>
```

Y en `ultimosAvisos()`, sustituir `<section class="bloque" id="novedades">` y su `<h2>Últimos movimientos</h2>` por:

```js
<section class="seccion" id="novedades">
  <h2 class="seccion__titulo">${icono('campana')}Últimos movimientos</h2>
```

(el resto del bloque —`<p class="novedades__resumen"…>`, la lista `.docs` y el enlace final— se queda igual.)

- [ ] **Step 3: El botón «Me interesa», más discreto**

Sustituir `botonSeguir()` por:

```js
/** Botón de «me interesa». Sin JS no estorba: va oculto hasta que el JS lo activa. */
function botonSeguir(id, tamano = '') {
  return `<button type="button" class="seguir${tamano ? ` seguir--${tamano}` : ''}" data-seguir="${esc(id)}" hidden
        aria-pressed="false">Me interesa</button>`;
}
```

(Es el mismo código: se mantiene para dejar claro que el contrato con `app.js` no cambia.)

- [ ] **Step 4: CSS de filtros, tarjetas, pastillas y barra**

En `src/styles.css`, sustituir la sección `/* ---------- filtros ---------- */` (hasta antes de `/* ---------- tarjetas ---------- */`) y la sección `/* ---------- tarjetas ---------- */` (hasta antes de `.vacio`) por:

```css
/* ---------- filtros: chips ---------- */
.filtros { display: flex; flex-wrap: wrap; align-items: center; gap: .45rem; margin-bottom: 1rem; }
.filtros__grupo { display: flex; flex-wrap: wrap; gap: .45rem; }
.filtros__separa { width: 1px; height: 1.25rem; background: var(--linea); margin: 0 .3rem; }
.filtros button {
  font: 500 .8125rem/1 Inter, system-ui, sans-serif; cursor: pointer; min-height: 36px;
  background: var(--panel); color: var(--tinta);
  border: 1px solid var(--linea); border-radius: var(--radio-s); padding: .5rem .8rem;
}
.filtros button:hover { border-color: var(--acento); color: var(--acento); }
.filtros button.activo { background: var(--acento); border-color: var(--acento); color: var(--sobre-acento); }

/* ---------- tarjetas de promoción ---------- */
.tarjetas {
  list-style: none; margin: 0; padding: 0;
  display: grid; gap: .75rem; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
}
.tarjeta > article {
  height: 100%; display: flex; flex-direction: column;
  background: var(--panel); border: 1px solid var(--linea); border-radius: var(--radio-l);
  padding: 1rem; box-shadow: var(--sombra);
}
.tarjeta__alto { display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem; margin-bottom: .6rem; }
.tarjeta h2 { font-size: 1.03rem; margin: 0; letter-spacing: -.015em; }
.tarjeta h2 a { text-decoration: none; color: inherit; }
.tarjeta h2 a:hover { color: var(--acento); }
.tarjeta__lugar { margin: .15rem 0 0; font-size: .8125rem; color: var(--tinta-suave); }
/* La barra va al fondo de la tarjeta: así queda a la misma altura en toda la fila. */
.barra { height: 6px; border-radius: 99px; background: var(--linea); overflow: hidden; margin: auto 0 .5rem; }
.barra i { display: block; height: 100%; border-radius: 99px; background: var(--libre-barra); }
.barra--vacia i { background: transparent; }
.tarjeta__pie { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem .9rem; font-size: .8125rem; color: var(--tinta-suave); font-variant-numeric: tabular-nums; }
.tarjeta__pie span { display: inline-flex; align-items: center; gap: .3rem; }
.tarjeta__pie .seguir { margin-left: auto; }

/* Pastillas de estado: punto + texto (nunca solo color). */
.pastilla {
  display: inline-flex; align-items: center; gap: .4rem; flex: none;
  font-size: .72rem; font-weight: 600; line-height: 1; padding: .3rem .6rem; border-radius: var(--radio-s); white-space: nowrap;
}
.pastilla::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.pastilla--libre { background: var(--libre-fondo); color: var(--libre); }
.pastilla--completa, .pastilla--ocupada { background: var(--ocupada-fondo); color: var(--ocupada); }
.pastilla--reparto, .pastilla--proximamente { background: var(--aviso-fondo); color: var(--aviso); }
.pastilla--pendiente, .pastilla--sin-dato { background: var(--acento-fondo); color: var(--tinta-suave); }
.pastilla--doc { background: var(--acento-fondo); color: var(--acento); font-weight: 500; }
.pastilla--doc::before { display: none; }
```

Y sustituir las reglas `.seguir`, `.seguir:hover`, `.seguir.activo`, `.seguir--grande` (están en la sección «plazos y avisos») por:

```css
.seguir {
  font: 500 .8125rem/1 Inter, system-ui, sans-serif; cursor: pointer; min-height: 32px;
  background: transparent; color: var(--acento);
  border: 1px solid var(--acento-borde); border-radius: var(--radio-s); padding: .4rem .7rem;
}
.seguir:hover { border-color: var(--acento); }
.seguir.activo { background: var(--acento-fondo); border-color: var(--acento); font-weight: 600; }
.seguir--grande { font-size: .9rem; padding: .55rem .95rem; min-height: 36px; }
```

Borrar las reglas `.estado`, `.estado--libre`, `.estado--completa`, `.estado--pendiente`, `.tarjeta__datos` y `.tarjeta__datos li + li::before` (ya no hay markup que las use). También borrar las reglas viejas `.pastilla`, `.pastilla--libre`, `.pastilla--ocupada`, `.pastilla--proximamente`, `.pastilla--sin-dato`, `.pastilla--doc` de la sección «tablas» (las nuevas de arriba las sustituyen).

- [ ] **Step 5: Comprobar**

Run: `npm test && node scripts/build.mjs && grep -c 'class="barra' dist/index.html && grep -c 'pastilla--' dist/index.html && grep -c 'tarjeta__datos\|class="estado' dist/index.html`
Expected: el primer número = promociones con tabla publicada (hoy, 3 o más); el segundo ≥ 26; el tercero `0`.

Run: `bash scratch/captura.sh dist/index.html t5` y abrir las dos capturas: tres tarjetas por fila a 1440 con **las barras a la misma altura** aunque los títulos ocupen distinto número de líneas; pastillas con punto; chips con esquinas de 8px; en 390 una tarjeta por fila y el botón «Me interesa» a la derecha del pie.

Manual (servidor local): pulsar «Se pueden pedir» filtra; pulsar «Me interesa» en una tarjeta la copia a «Lo que sigues» sin el botón. Es el comportamiento de `app.js`, que no se ha tocado.

- [ ] **Step 6: Commit**

```bash
git add scripts/build.mjs src/styles.css
git commit -m "Tarjetas con pastilla y barra de ocupación, chips de filtro y secciones de portada"
```

---

### Task 6: Avisos de plazo con ficha de reloj

**Files:**
- Modify: `scripts/build.mjs` → `bloquePlazos()`, `plazoHtml()`; añadir `relojHtml()` y `reglaCorta()` junto a `cuentaAtras()`
- Modify: `src/styles.css` (reglas `.bloque--plazos .plazos .plazo* .cita*` de la sección «plazos y avisos»)

**Interfaces:**
- Consumes: `icono()`, `.seccion`, `.seccion__titulo`, `cuentaAtras()`, `dias()`, `nombrePromocion()`.
- Produces: `bloquePlazos(lista, opciones)` conserva su firma; clases `.avisos-plazo .aviso-plazo .aviso-plazo--urge .aviso-plazo--pasado .aviso-plazo--sin-fecha .reloj .aviso-plazo__cuerpo .aviso-plazo__fuente .cita`. `bloqueReparto()` (T7) reutiliza `.aviso-plazo--pasado` para los hitos.

- [ ] **Step 1: Reloj y regla corta**

Debajo de `cuentaAtras()` añadir:

```js
/** La ficha de reloj del aviso: número grande y unidad debajo. */
function relojHtml(z, cerrado) {
  if (!z.fin) return '<span class="reloj reloj--apagado"><b>?</b><span>sin fecha</span></span>';
  const quedan = dias(HOY, z.fin);
  if (cerrado || quedan < 0) return `<span class="reloj reloj--apagado"><b>${esc(z.fin.slice(8, 10))}</b><span>${esc(mesCorto(z.fin))}</span></span>`;
  if (quedan === 0) return '<span class="reloj"><b>Hoy</b><span>cierra</span></span>';
  return `<span class="reloj"><b>${quedan}</b><span>${quedan === 1 ? 'día' : 'días'}</span></span>`;
}

function mesCorto(iso) {
  return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][Number(iso.slice(5, 7)) - 1] ?? '';
}

/** «Cierra el 2026-06-12. 15 días naturales desde el día siguiente a la publicación en el BOP (2026-05-28).» */
function reglaCorta(z) {
  const partes = [];
  if (z.fin) partes.push(`Cierra el ${z.fin}.`);
  if (z.regla) {
    partes.push(`${z.regla.cantidad} días ${z.regla.unidad}${z.regla.ancla_texto ? ` desde el día siguiente a ${z.regla.ancla_texto}` : ''}${z.regla.desde ? ` (${z.regla.desde})` : ''}.`);
  }
  return esc(partes.join(' '));
}
```

- [ ] **Step 2: Nuevo bloque y nuevo aviso**

Sustituir `bloquePlazos()` y `plazoHtml()` por:

```js
function bloquePlazos(lista, { titulo = 'Plazos abiertos', conPromocion = true, cerrados = false } = {}) {
  if (!lista.length) return '';
  return `<section class="seccion">
    <h2 class="seccion__titulo">${icono('reloj')}${esc(titulo)}</h2>
    <ul class="avisos-plazo">
${lista.map((z) => plazoHtml(z, conPromocion, cerrados)).join('\n')}
    </ul>
    <p class="fino">${cerrados ? 'Ya cerrados: sirven para reconstruir la cronología.'
      : 'Las fechas se cuentan desde la publicación del boletín, como dice el propio documento. Si algo no cuadra, manda el documento.'}
       <a href="/avisos/">Cómo te avisamos con tiempo</a></p>
  </section>`;
}

function plazoHtml(z, conPromocion, cerrado) {
  const quedan = z.fin ? dias(HOY, z.fin) : null;
  const clase = cerrado || (quedan != null && quedan < 0) ? 'pasado' : !z.fin ? 'sin-fecha' : quedan <= 3 ? 'urge' : 'normal';
  return `      <li class="aviso-plazo aviso-plazo--${clase}">
        ${relojHtml(z, cerrado)}
        <div class="aviso-plazo__cuerpo">
          <h3>${esc(z.titulo ?? 'Plazo')}${conPromocion ? ` · ${esc(nombrePromocion(z.promocion_id))}` : ''}</h3>
          <p>${clase === 'sin-fecha' ? 'Depende de una fecha que aún no consta. ' : ''}${reglaCorta(z)}${
            z.regla?.unidad === 'habiles' ? ' <strong>Ojo:</strong> no descontamos festivos locales; comprueba el documento.' : ''}</p>
          ${z.cita ? `<details class="cita"><summary>Lo que dice el documento</summary><blockquote>${esc(z.cita)}</blockquote></details>` : ''}
          <p class="aviso-plazo__fuente">${icono('doc')} <a href="${esc(z.fuente_url)}" rel="noopener nofollow">${esc(z.fuente_ref ?? 'Documento oficial')}</a>
            · ${z.origen === 'manual' ? 'corregido a mano por la comunidad' : `leído del documento el ${esc(z.extraido ?? '')}`}</p>
        </div>
      </li>`;
}
```

- [ ] **Step 3: CSS**

En `src/styles.css`, borrar las reglas `.bloque--plazos`, `.plazos`, `.plazo`, `.plazo--urge`, `.plazo__cuenta`, `.plazo--urge .plazo__cuenta`, `.plazo--normal .plazo__cuenta`, `.plazo__que`, `.plazo p:last-child`, `.plazo--pasado`, `.plazo--pasado .plazo__cuenta`, `.cita`, `.cita summary`, `.cita blockquote` y añadir en su lugar:

```css
/* ---------- avisos de plazo ---------- */
.avisos-plazo { list-style: none; margin: 0 0 .75rem; padding: 0; display: grid; gap: .75rem; }
.aviso-plazo {
  display: flex; gap: .875rem; align-items: flex-start;
  background: var(--panel); border: 1px solid var(--linea); border-left: 3px solid var(--acento);
  border-radius: var(--radio-m); padding: .9rem 1rem; box-shadow: var(--sombra);
}
.aviso-plazo--urge { border-left-color: var(--urge); }
.aviso-plazo--pasado, .aviso-plazo--sin-fecha { border-left-color: var(--linea); box-shadow: none; }
.aviso-plazo__cuerpo { min-width: 0; flex: 1; }
.aviso-plazo h3 { margin: 0 0 .2rem; }
.aviso-plazo p { margin: 0; font-size: .8125rem; line-height: 1.5; color: var(--tinta-suave); }
.aviso-plazo .aviso-plazo__fuente { margin-top: .4rem; display: flex; flex-wrap: wrap; align-items: center; gap: .3rem; }
.aviso-plazo__fuente .ic { font-size: .95rem; }

.reloj {
  flex: none; text-align: center; min-width: 3.25rem; padding: .4rem .5rem; border-radius: var(--radio-s);
  background: var(--acento); color: var(--sobre-acento);
}
.aviso-plazo--urge .reloj { background: var(--urge); color: #fff; }
.reloj--apagado { background: var(--acento-fondo); color: var(--tinta-suave); }
.reloj b { display: block; font: 600 1.3rem/1 'Inter Tight', Inter, system-ui, sans-serif; font-variant-numeric: tabular-nums; }
.reloj span { display: block; font-size: .65rem; margin-top: .15rem; opacity: .9; }

.cita { margin-top: .45rem; font-size: .8125rem; }
.cita summary { cursor: pointer; color: var(--acento); font-weight: 500; }
.cita blockquote {
  margin: .45rem 0 0; padding: .6rem .8rem; border-radius: var(--radio-s);
  background: var(--acento-fondo); color: var(--tinta); font-style: italic; line-height: 1.55;
}
```

- [ ] **Step 4: Comprobar**

Run: `npm test && node scripts/build.mjs && grep -c 'class="reloj' dist/avisos/index.html && grep -c 'plazo__cuenta' dist/avisos/index.html dist/index.html`
Expected: número > 0 en `avisos`; `0` y `0` para la clase vieja. (Si hoy no hay plazos vivos, `avisos/index.html` muestra «Ahora mismo no hay ningún plazo abierto» y el primer conteo es 0: entonces comprobar el reloj en una ficha con plazos cerrados, p. ej. `grep -l 'reloj--apagado' dist/promocion/*/index.html | head -1`.)

Run: `bash scratch/captura.sh dist/avisos/index.html t6` y abrir: cada plazo con su reloj a la izquierda (morado si abierto, rojo si ≤ 3 días, apagado con día y mes si cerrado), título, regla en una línea, «Lo que dice el documento» plegado, referencia con icono.

- [ ] **Step 5: Commit**

```bash
git add scripts/build.mjs src/styles.css
git commit -m "Plazos como avisos con ficha de reloj"
```

---

### Task 7: Ficha de promoción

**Files:**
- Modify: `scripts/build.mjs` → `paginaPromocion()`, `bloqueReparto()`, `bloqueContexto()`, `tablaViviendas()` (solo la `caption`), `avisosDe()`
- Modify: `src/styles.css` (sección `/* ---------- ficha ---------- */`, reglas `.cifras*`, `.bloque--reparto*`, `.bloque--tuyo*`, `.bloque--seguir`)

**Interfaces:**
- Consumes: `icono()`, `bloquePlazos()` (T6), `.seccion`, `.seccion__titulo`, `.pastilla` (T5), `.boton`, `miles()`, `porcentaje()`, `contextoDe()`, `conjuntoDe()`.
- Produces: `.tejas .teja .teja--foco .teja__unidad .teja--baja .panel .panel--aviso .panel--fuente .ficha__lugar .hitos`.

- [ ] **Step 1: La plantilla de la ficha**

Sustituir el contenido de `const cuerpo = \`…\`;` de `paginaPromocion()` (desde `<nav class="miga">` hasta `</article>`) por:

```js
<nav class="miga fino"><a href="/">Promociones</a> › <span>${esc(p.localidad ?? '')}</span></nav>
<article class="ficha">
  <header class="ficha__cabecera">
    <p class="ficha__lugar">${icono('pin')}${esc([...new Set([p.localidad, p.provincia].filter(Boolean))].join(' · '))}${p.estado_obra ? ` · obra ${esc(p.estado_obra.toLowerCase())}` : ''}</p>
    <h1>${esc(minusculiza(p.nombre, [...NOMBRES_PROPIOS, p.localidad, p.provincia]))}</h1>
    ${p.direccion ? `<p class="fino">${esc(p.direccion)}</p>` : ''}
  </header>

  ${bloqueReparto(p, d)}

  <section class="seccion">
    <h2 class="seccion__titulo">${icono('llave')}${reparto(p.id).estado === 'sin_reparto' ? 'Viviendas libres' : 'Qué dice la tabla de la web oficial'}</h2>
    ${d.publicada ? `
    <dl class="tejas">
      <div class="teja${ofrece(p.id) && d.libres ? ' teja--foco' : ''}"><dt>Marcadas «libre»</dt><dd>${d.libres}</dd></div>
      <div class="teja"><dt>Próximamente</dt><dd>${d.proximamente}</dd></div>
      <div class="teja"><dt>Ocupadas</dt><dd>${d.ocupadas}</dd></div>
      <div class="teja"><dt>En la tabla</dt><dd>${d.total}</dd></div>
    </dl>
    ${desfase ? `<p class="panel panel--aviso">La ficha oficial anuncia ${p.n_viviendas} viviendas pero su tabla detalla ${d.total}.
       No sabemos por qué: lo dejamos tal cual lo publica la fuente.</p>` : ''}
    ${tablaViviendas(p.viviendas)}
    ${serie.length > 1 ? historicoHtml(serie) : `<p class="fino">Miramos esta tabla todos los días desde el ${esc(serie[0]?.fecha ?? p.capturado)}. Cuando cambie algo, aparecerá aquí.</p>`}
    ` : `<p class="panel panel--aviso">La web oficial todavía no publica la tabla de viviendas de esta promoción, así que no
       podemos decir cuántas quedan libres. En cuanto la publique, aparecerá aquí sola.</p>`}
  </section>

  ${bloquePlazos(plazosVivos(p.id), { titulo: 'Plazos abiertos', conPromocion: false })}
  ${bloquePlazos(plazosSinFecha(p.id), { titulo: 'Plazos que dependen de lo que pase antes', conPromocion: false })}
  ${bloquePlazos(plazosPasados(p.id), { titulo: 'Plazos ya cerrados', conPromocion: false, cerrados: true })}

  <section class="seccion">
    <h2 class="seccion__titulo">${icono('campana')}Que no se te pase</h2>
    <div class="panel">
      ${botonSeguir(p.id, 'grande')}
      <ul class="docs">
        <li><a href="/promocion/${esc(p.id)}/avisos.xml">Avisos de esta promoción por RSS</a>
          <p class="fino">Para tu lector de siempre o para engancharlo a Telegram.</p></li>
        ${plazosVivos(p.id).length ? `<li><a href="/promocion/${esc(p.id)}/plazos.ics">Plazos en tu calendario (.ics)</a>
          <p class="fino">Tu móvil te avisa 14, 7, 3 y 1 días antes del cierre.</p></li>` : ''}
        <li><a href="/avisos/">Cómo funcionan los avisos</a></li>
      </ul>
    </div>
  </section>

  ${avisosDe(p.id)}

  <section class="seccion">
    <h2 class="seccion__titulo">${icono('ok')}¿En qué punto está mi solicitud?</h2>
    <div class="panel prosa">
      ${situacion(p, d)}
      <p><a href="/como-funciona/">Ver el proceso completo, paso a paso</a></p>
    </div>
  </section>

  <section class="seccion">
    <h2 class="seccion__titulo">${icono('doc')}Documentos oficiales</h2>
    <div class="panel">
      ${p.documentos.length ? `<ul class="docs">
        ${p.documentos.map(documentoHtml).join('\n        ')}
      </ul>` : '<p class="fino">La ficha oficial no enlaza documentos todavía.</p>'}
    </div>
  </section>

  ${bloqueContexto(p.localidad)}

  <section class="seccion">
    <h2 class="seccion__titulo">${icono('doc')}De dónde sale esto</h2>
    <div class="panel panel--fuente fino">
      <p>Fuente: <a href="${esc(p.url_oficial)}" rel="noopener nofollow">ficha oficial en tuyavivienda.es</a>,
         leída el ${esc(p.capturado)}${p.actualizado_fuente ? ` (la fuente dice haberla actualizado el ${esc(p.actualizado_fuente.slice(0, 10))})` : ''}.</p>
      <p>Huella digital de la página que leímos: <code>${esc((p.sha256_pagina ?? '').slice(0, 16))}…</code>.
         Sirve para comprobar que el dato salió exactamente de ahí.</p>
    </div>
  </section>
</article>
```

- [ ] **Step 2: Reparto, contexto, avisos de la promoción y tabla**

Sustituir el `return` de `bloqueReparto()` (desde `return \`<section class="bloque bloque--reparto">` hasta `</section>\`;`) por:

```js
  return `<section class="seccion">
    <h2 class="seccion__titulo">${icono('ok')}Reparto</h2>
    <div class="panel panel--reparto">
      <h3>${titular}</h3>
      ${r.estado === 'adjudicada'
        ? `<p>La lista definitiva de adjudicatarios está aprobada y publicada en el boletín oficial, así que
           <strong>estas viviendas ya tienen destinatario</strong>. Si estabas en la lista de reserva, tu turno
           depende de que alguien renuncie, y eso se comunica de forma individual.</p>`
        : `<p>Hay un procedimiento en marcha: se han presentado solicitudes y todavía no consta publicada la lista
           definitiva de adjudicatarios. Hasta que eso ocurra, estas viviendas no se pueden pedir por libre.</p>`}
      ${desfase ? `<p class="panel panel--aviso"><strong>La tabla de la web oficial sigue marcando las ${d.total} viviendas como
         «libres»</strong>, pero eso no significa que estén disponibles: esa tabla no se ha actualizado desde que se
         resolvió el reparto. Nos fiamos del boletín, que es el documento con validez.</p>` : ''}
      ${hitos.length ? `<ul class="avisos-plazo hitos">
        ${hitos.map((h) => `<li class="aviso-plazo aviso-plazo--pasado">
          <span class="reloj reloj--apagado"><b>${esc(h.fecha ? h.fecha.slice(8, 10) : '?')}</b><span>${esc(h.fecha ? mesCorto(h.fecha) : 'sin fecha')}</span></span>
          <div class="aviso-plazo__cuerpo">
            <h3>${esc(h.titulo)}</h3>
            <p>${esc(h.fecha ?? 'Sin fecha')}${h.fecha && !h.fecha_es_del_acuerdo ? ' (fecha de publicación del boletín)' : ''}</p>
            ${h.cita ? `<details class="cita"><summary>Lo que dice el documento</summary><blockquote>${esc(h.cita)}</blockquote></details>` : ''}
            <p class="aviso-plazo__fuente">${icono('doc')} <a href="${esc(h.fuente_url)}" rel="noopener nofollow">${esc(h.fuente_ref ?? 'Documento oficial')}</a></p>
          </div>
        </li>`).join('\n        ')}
      </ul>` : ''}
    </div>
  </section>`;
```

Sustituir el `return` de `bloqueContexto()` (desde `return \`<section class="bloque bloque--contexto">` hasta `</section>\`;`) por:

```js
  return `<section class="seccion">
    <h2 class="seccion__titulo">${icono('pin')}El municipio · ${esc(localidad)}</h2>
    <div class="panel">
      <dl class="tejas tejas--municipio">
        ${c.poblacion ? `<div class="teja"><dt>${icono('vecinos')}Habitantes</dt><dd>${miles(c.poblacion.habitantes)}
          <span class="teja__unidad">en ${c.poblacion.anio}</span></dd></div>` : ''}
        ${c.variacion_decada_pct != null ? `<div class="teja${c.variacion_decada_pct < 0 ? ' teja--baja' : ''}"><dt>${icono('baja')}En diez años</dt><dd>${porcentaje(c.variacion_decada_pct)}
          <span class="teja__unidad">desde ${c.poblacion_referencia.anio}</span></dd></div>` : ''}
        ${c.viviendas ? `<div class="teja"><dt>${icono('edificio')}Viviendas que ya hay</dt><dd>${miles(c.viviendas.total)}
          <span class="teja__unidad">censo de ${c.viviendas.anio}</span></dd></div>` : ''}
      </dl>
      ${frase ? `<p>${frase}</p>` : ''}
      <p class="fino">Fuente: <strong>Junta de Castilla y León</strong>, ${c.poblacion ? `<a href="${esc(pob.ficha)}" rel="noopener">${esc(pob.titulo)}</a>` : ''}${c.poblacion && c.viviendas ? ' y ' : ''}${c.viviendas ? `<a href="${esc(viv.ficha)}" rel="noopener">${esc(viv.titulo)}</a>` : ''}
         (<a href="https://creativecommons.org/licenses/by/4.0/deed.es" rel="noopener">CC BY 4.0</a>), del
         <a href="https://datosabiertos.jcyl.es" rel="noopener">Portal de Datos Abiertos de Castilla y León</a>.
         Ficheros leídos el ${esc(pob.fecha_captura ?? viv.fecha_captura ?? '')}. En esos ficheros el municipio es «${esc(c.municipio_jcyl)}», código INE ${esc(c.codigo_ine)}.</p>
    </div>
  </section>`;
```

En `bloqueContexto()`, sustituir la línea de `frase` por esta versión más corta:

```js
  const frase = d == null ? ''
    : d <= -1 ? `Un ${porcentaje(d).replace('−', '')} menos de vecinos que hace diez años.`
    : d >= 1 ? `Un ${porcentaje(d).replace('+', '')} más de vecinos que hace diez años.`
    : 'Casi los mismos vecinos que hace diez años.';
```

En `avisosDe()`, sustituir `<section class="bloque">` y `<h2>Qué ha pasado aquí</h2>` por:

```js
<section class="seccion">
    <h2 class="seccion__titulo">${icono('campana')}Qué ha pasado aquí</h2>
    <div class="panel">
```

y añadir `</div>` antes de su `</section>` de cierre.

En `tablaViviendas()`, la `caption` pasa a `<caption class="fino">Cada vivienda, tal y como la publica la web oficial.</caption>` (ya lo es: no tocar). `etiquetaEstado()` ya usa `.pastilla pastilla--{libre|ocupada|proximamente|sin-dato}`, que T5 restyló con punto: no tocar.

- [ ] **Step 3: CSS de la ficha**

En `src/styles.css`, borrar las reglas `.cifras`, `.cifras > div`, `.cifras dt`, `.cifras dd`, `.cifras .de`, `.cifras--ficha .es-libre dd`, la sección `/* ---------- ficha ---------- */` completa (`.miga`, `.ficha header`, `.direccion`, `.bloque`, `.bloque--fuente`, `.bloque p:last-child`, `.aviso`), y las reglas `.bloque--tuyo`, `.bloque--tuyo .tarjetas`, `.bloque--seguir .docs`, `.bloque--reparto`, `.bloque--reparto h2`, `.bloque--reparto .plazos`. Añadir:

```css
/* ---------- ficha ---------- */
.miga { margin-bottom: 1rem; }
.miga a { text-decoration: none; }
.ficha__cabecera { margin-bottom: 2rem; }
.ficha__lugar { display: flex; align-items: center; gap: .4rem; margin: 0 0 .5rem; font-size: .8125rem; color: var(--tinta-suave); }
.ficha__lugar .ic { color: var(--acento); font-size: 1rem; }
.ficha__cabecera h1 { margin-bottom: .35rem; }

/* Paneles: superficie sin sombra (la sombra es de tarjetas y avisos de plazo). */
.panel { background: var(--panel); border: 1px solid var(--linea); border-radius: var(--radio-l); padding: 1.125rem 1.25rem; }
.panel > :last-child { margin-bottom: 0; }
.panel > h3 { margin-bottom: .5rem; }
.panel--fuente { background: var(--acento-fondo); border-color: transparent; }
.panel--fuente p { margin: 0 0 .5rem; }
.panel--reparto { border-left: 3px solid var(--ocupada); }
.panel--aviso {
  background: var(--aviso-fondo); color: var(--aviso); border-color: transparent;
  padding: .75rem 1rem; font-size: .9rem; margin: .75rem 0;
}
.panel .seguir--grande { margin-bottom: 1rem; }
.hitos { margin-top: 1rem; }

/* Tejas: rótulo, cifra grande, unidad debajo. */
.tejas { display: grid; gap: .625rem; grid-template-columns: repeat(auto-fit, minmax(8.25rem, 1fr)); margin: 0 0 .75rem; }
.teja { background: var(--panel); border: 1px solid var(--linea); border-radius: var(--radio-m); padding: .8rem .875rem; }
.teja dt { display: flex; align-items: center; gap: .4rem; font-size: .8125rem; color: var(--tinta-suave); margin-bottom: .3rem; }
.teja dt .ic { color: var(--acento); font-size: .95rem; }
.teja dd { margin: 0; font: 600 1.625rem/1.05 'Inter Tight', Inter, system-ui, sans-serif; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.teja__unidad { display: block; font: 400 .8125rem/1.4 Inter, system-ui, sans-serif; letter-spacing: 0; color: var(--tinta-suave); margin-top: .2rem; }
.teja--foco { background: var(--acento); border-color: var(--acento); box-shadow: var(--sombra); }
.teja--foco dt, .teja--foco dd { color: var(--sobre-acento); }
.teja--foco dt .ic { color: var(--sobre-acento); }
.teja--baja dd { color: var(--urge); }
.teja--baja dt .ic { color: var(--urge); }
.panel .tejas .teja { background: var(--papel); }
```

- [ ] **Step 4: Comprobar**

Run: `npm test && node scripts/build.mjs && grep -c 'class="teja' dist/promocion/*/index.html | grep -vc ':0$' && grep -rc 'class="bloque\b\|cifras' dist/promocion/ | grep -vc ':0$'`
Expected: primer número = fichas con tejas (todas las que tienen tabla o contexto: ≥ 22); segundo `0` (no queda markup viejo en las fichas).

Run: `F=$(ls -d dist/promocion/*astorga*/ | head -1); bash scratch/captura.sh "$F/index.html" t7 && bash scratch/captura.sh "$F/index.html" t7-oscuro oscuro` y abrir: cabecera con icono de ubicación, tejas (la de «libre» en morado sólido si se pueden pedir), secciones con título pequeño e icono, paneles sin sombra, bloque del municipio con tres tejas con icono, fuente en panel morado claro. En oscuro, todo legible.

- [ ] **Step 5: Commit**

```bash
git add scripts/build.mjs src/styles.css
git commit -m "Ficha de promoción: tejas, secciones con icono y paneles"
```

---

### Task 8: Prosa, tablas, listas, pie y limpieza del CSS

**Files:**
- Modify: `scripts/build.mjs` → `layout()` (pie), `paginaDatos()` (solo la clase de la lista), `paginaAvisos()` (nada de markup), `pagina404()`
- Modify: `src/styles.css` (secciones «tablas», «prosa», «pie», `.docs`, `.historico`, `.novedades__resumen`, `.docs li.es-nuevo*`, alias de tokens)

**Interfaces:**
- Consumes: todos los tokens nuevos. Elimina los alias `--brand-*`, `--tarjeta`, `--proxima*`, `--radio`.

- [ ] **Step 1: El pie, más corto**

En `layout()`, sustituir el `<div class="pie__texto">…</div>` por:

```js
    <div class="pie__texto">
      <p><strong>Esta web no es oficial.</strong> Para cualquier trámite, ve a la web de
        <a href="https://tuyavivienda.es" rel="noopener">SOMACYL</a> y al boletín. La hacen vecinas y vecinos de
        <a href="https://aldeapucela.org" rel="noopener">Aldea Pucela</a>; todo dato lleva enlace a su fuente y aquí
        no hay datos personales de nadie.</p>
    </div>
```

En `pagina404()`, dejar el markup tal cual (usa `.prosa`).

- [ ] **Step 2: CSS de prosa, tablas, listas y pie; fuera alias y reglas muertas**

En `src/styles.css`:

1. Borrar del bloque `:root {` las líneas de alias (desde el comentario `/* Alias de los nombres antiguos…` hasta `--radio: var(--radio-l);`).
2. Sustituir la sección `/* ---------- tablas ---------- */` (solo `.tabla-scroll`, `.tabla`, `.tabla caption`, `.tabla th, .tabla td`, `.tabla th`, `.tabla .num`, `.tabla tbody tr:hover`; las pastillas ya se movieron en T5), `.historico summary`, `.docs*`, la sección `/* ---------- prosa ---------- */`, la sección `/* ---------- pie ---------- */` y las reglas `.novedades__resumen`, `.docs li.es-nuevo`, `.docs li.es-nuevo > a::after` por:

```css
/* ---------- tablas ---------- */
.tabla-scroll { overflow-x: auto; margin: 1rem 0; }
.tabla { width: 100%; border-collapse: collapse; font-size: .9rem; }
.tabla caption { text-align: left; margin-bottom: .5rem; }
.tabla th, .tabla td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid var(--linea); white-space: nowrap; }
.tabla th { font-size: .78rem; font-weight: 600; color: var(--tinta-suave); }
.tabla .num { text-align: right; font-variant-numeric: tabular-nums; }
.tabla tbody tr:hover { background: var(--acento-fondo); }
.historico summary { cursor: pointer; font-weight: 600; color: var(--acento); }

/* ---------- listas de documentos y avisos ---------- */
.docs { list-style: none; margin: 0; padding: 0; display: grid; gap: .75rem; }
.docs li { padding-bottom: .75rem; border-bottom: 1px solid var(--linea); }
.docs li:last-child { border-bottom: 0; padding-bottom: 0; }
.docs p { margin: .25rem 0 0; }
.novedades__resumen { font-weight: 600; color: var(--acento); }
.docs li.es-nuevo { border-left: 3px solid var(--libre); padding-left: .7rem; }
.docs li.es-nuevo > a::after {
  content: 'nuevo'; margin-left: .4rem; font-size: .7rem; font-weight: 700; color: var(--libre);
}
.vacio { margin-top: 1rem; }

/* ---------- prosa (avisos, cómo funciona, fuentes, privacidad, datos, 404) ---------- */
.prosa { max-width: 44rem; }
.prosa h1 { margin-bottom: 1rem; }
.prosa h2 { margin-top: 2.25rem; }
.prosa h3 { margin-top: 1.5rem; }
.prosa li { margin-bottom: .35rem; }
.prosa blockquote {
  margin: 1.25rem 0; padding: .6rem 1rem; border-left: 3px solid var(--acento-borde);
  color: var(--tinta-suave); background: var(--acento-fondo); border-radius: 0 var(--radio-s) var(--radio-s) 0;
}
.prosa code { background: var(--acento-fondo); padding: .1rem .35rem; border-radius: .3rem; font-size: .9em; }
.prosa hr { border: 0; border-top: 1px solid var(--linea); margin: 2rem 0; }
.prosa .seccion { margin-top: 1rem; }

/* ---------- pie ---------- */
.pie { border-top: 1px solid var(--linea); background: var(--papel); padding-block: 2rem 2.5rem; }
.pie__inner { display: grid; gap: 1.25rem; }
@media (min-width: 52rem) {
  .pie__inner { grid-template-columns: minmax(14rem, 17rem) 1fr; align-items: start; column-gap: 3rem; }
  .marca--pie { grid-row: span 3; }
}
.pie p { margin: 0 0 .6rem; max-width: 60ch; font-size: .875rem; color: var(--tinta-suave); line-height: 1.6; }
.pie p strong { color: var(--tinta); }
.pie__texto p:last-child { margin-bottom: 0; }
.pie__enlaces { display: flex; flex-wrap: wrap; gap: .4rem 1.25rem; font-size: .875rem; }
.pie__enlaces a { text-decoration: none; border-bottom: 1px solid transparent; }
.pie__enlaces a:hover { border-bottom-color: currentColor; }
.pie .fino { margin-bottom: 0; }

@media print {
  .topbar, .filtros, .saltar, .tema, .seguir { display: none; }
  body { background: #fff; }
}
```

3. Borrar la sección `@media print { … }` vieja (la nueva está arriba).

- [ ] **Step 3: Comprobar que no queda ningún token viejo ni selector huérfano**

Run: `grep -n 'brand-\|--tarjeta\|--proxima\|var(--radio)\|var(--sombra)' src/styles.css | grep -v '\-\-sombra:' ; echo "---"; node scripts/build.mjs >/dev/null && for c in bloque cifras estado-- tarjeta__datos plazo__ hero__sub; do printf "%-16s %s\n" "$c" "$(grep -rl "class=\"[^\"]*$c" dist --include=*.html | wc -l | tr -d ' ')"; done`
Expected: la primera lista está vacía salvo usos legítimos de `var(--sombra)` en `.tarjeta > article`, `.aviso-plazo`, `.boton` y `.teja--foco`; y la tabla de clases viejas da `0` en todas las filas.

Run: `npm test && for p in index avisos/index datos/index fuentes/index como-funciona/index privacidad/index; do bash scratch/captura.sh dist/$p.html "t8-$(basename $(dirname dist/$p.html))" >/dev/null; done; ls scratch/t8-*` y abrir las de 1440 de `avisos`, `datos` y `fuentes`: prosa a 44rem con títulos en Inter Tight, tablas con cabecera gris sin mayúsculas, citas en panel morado claro, pie de un párrafo.

- [ ] **Step 4: Commit**

```bash
git add scripts/build.mjs src/styles.css
git commit -m "Prosa, tablas, listas y pie al diseño nuevo; fuera los alias de tokens"
```

---

### Task 9: Vista previa de un solo fichero

**Files:**
- Modify: `scripts/build.mjs` → `unaSolaPagina()`

**Interfaces:**
- Consumes: `sprite()`, `botonTema()`, `marca()`, fuentes en `src/fonts/`, ilustración en `src/img/promocion.jpg`.

- [ ] **Step 1: Incrustar lo que en un fichero suelto no tiene ruta**

En `unaSolaPagina()`:

1. Tras la línea `const isotipo = …;` añadir:

```js
  const dibujo = `data:image/jpeg;base64,${fs.readFileSync(path.join(RAIZ, 'src/img/promocion.jpg')).toString('base64')}`;
  const fuente = (f) => `data:font/woff2;base64,${fs.readFileSync(path.join(RAIZ, 'src/fonts', f)).toString('base64')}`;
  const cssInline = css
    .replace('url(/fonts/inter.woff2)', `url(${fuente('inter.woff2')})`)
    .replace('url(/fonts/inter-tight.woff2)', `url(${fuente('inter-tight.woff2')})`);
```

2. En el template, sustituir `${css}` (dentro de `<style>`) por `${cssInline}`.
3. Sustituir la línea `<script>document.documentElement.className += ' con-js';</script>` por:

```js
<script>document.documentElement.className += ' con-js';
try { if (localStorage.getItem('vivienda:tema') === 'oscuro') document.documentElement.setAttribute('data-theme', 'dark'); } catch (e) {}</script>
${sprite()}
```

4. Sustituir la cabecera de la vista previa (desde `<header class="topbar">` hasta `</header>`) por:

```js
<header class="topbar">
  <div class="container topbar__inner">
    ${conIsotipo(marca()).replace('href="/"', 'href="#/"')}
    <nav class="menu" id="menu-principal" aria-label="Menú principal">
      <a href="#/">Promociones</a>
      <a href="#/avisos/">Avisos y plazos</a>
      <a href="#/como-funciona/">Cómo funciona</a>
      <a href="#/datos/">Datos abiertos</a>
      <a href="#/fuentes/">Fuentes</a>
      <a href="#/privacidad/">Privacidad</a>
    </nav>
    <div class="topbar__acciones">
      ${botonTema()}
      <button class="menu-boton" type="button" aria-expanded="false" aria-controls="menu-principal">
        <svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path class="menu-boton__barras" d="M4 7h16M4 12h16M4 17h16"/>
          <path class="menu-boton__cruz" d="M6 6l12 12M18 6L6 18"/>
        </svg>
        <span class="menu-boton__texto">Menú</span>
      </button>
    </div>
  </div>
</header>
```

5. La función `conIsotipo` pasa a incrustar también la ilustración:

```js
  const conIsotipo = (html) => html
    .replace(/src="\/img\/aldea-pucela\.jpg"/g, `src="${isotipo}"`)
    .replace(/src="\/img\/promocion\.jpg"/g, `src="${dibujo}"`);
```

y la línea que monta las secciones pasa a usarla: `${conIsotipo(enlacesInternos(p.cuerpo))}`. Como `secciones` se
construye antes, **mover la definición de `conIsotipo` por encima de `const secciones = …`** (si no, es un
`ReferenceError` por usar una `const` antes de declararla).

6. En el pie de la vista previa, sustituir el `<div class="pie__texto">…</div>` por el mismo párrafo único de la Tarea 8 (con los enlaces a SOMACYL y Aldea Pucela).

- [ ] **Step 2: Comprobar**

Run: `node scripts/build.mjs --single && ls -la dist/vista-previa.html && grep -c 'data:font/woff2' dist/vista-previa.html && grep -c '<symbol id="i-' dist/vista-previa.html`
Expected: fichero de menos de 2 MB; `2`; `10`.

Abrir `dist/vista-previa.html` en Chrome directamente (doble clic): portada con hero e ilustración, el botón «Oscuro» funciona, la navegación por `#/avisos/` cambia de sección.

- [ ] **Step 3: Commit**

```bash
npm test && node scripts/build.mjs
git add scripts/build.mjs
git commit -m "Vista previa de un fichero con el diseño nuevo: fuentes, iconos e ilustración incrustados"
```

---

### Task 10: Revisión de accesibilidad y documentación

**Files:**
- Create: `scratch/revisa-encabezados.mjs` (no se commitea)
- Modify: `README.md` (secciones «Las páginas» y «Cómo se mantiene al día» o donde se describa el tema), `CLAUDE.md` («Cómo trabajar aquí»)

- [ ] **Step 1: Un `h1` por página y orden de encabezados**

```bash
cat > scratch/revisa-encabezados.mjs <<'EOF'
import fs from 'node:fs'; import path from 'node:path';
function* html(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) yield* html(p); else if (p.endsWith('.html')) yield p; } }
let mal = 0;
for (const f of html('dist')) {
  if (f.endsWith('vista-previa.html')) continue;
  const t = fs.readFileSync(f, 'utf8');
  const h1 = (t.match(/<h1[\s>]/g) || []).length;
  const niveles = [...t.matchAll(/<h([1-4])[\s>]/g)].map((m) => Number(m[1]));
  const saltos = niveles.filter((n, i) => i && n > niveles[i - 1] + 1).length;
  if (h1 !== 1 || saltos) { mal++; console.log(`${f}: ${h1} h1, ${saltos} saltos de nivel`); }
}
console.log(mal ? `✖ ${mal} páginas con problemas` : '✔ encabezados: un h1 por página y sin saltos');
EOF
node scripts/build.mjs && node scratch/revisa-encabezados.mjs
```

Expected: `✔ encabezados…`. Si una página falla, se corrige la plantilla (por ejemplo, un `h3` dentro de una sección cuyo título es `h2` está bien; un `h3` sin `h2` antes, no).

- [ ] **Step 2: Sin peticiones externas, sin color solo, sin movimiento forzado**

Run: `grep -rhoE '(src|href)="https?://[^"]+"' dist/*.html dist/*/index.html | grep -vE 'aldeapucela|tuyavivienda|somacyl|jcyl|creativecommons|github|openfontlicense|datosabiertos' | sort -u`
Expected: vacío (solo enlaces de contenido a fuentes oficiales, ninguna carga de recurso externo).

Run: `grep -c 'prefers-reduced-motion: no-preference' dist/styles.css && grep -c 'transition' dist/styles.css`
Expected: `1` y `1` (todas las transiciones viven dentro de esa única media query).

Manual, en Chrome con DevTools → Rendering → «Emulate CSS prefers-reduced-motion: reduce»: los chips cambian de color al instante, sin transición. Con «Emulate vision deficiencies: Achromatopsia»: las pastillas siguen distinguibles por su texto y las barras por la cifra al lado.

- [ ] **Step 3: Recorrido de teclado (manual, 3 minutos, servidor local)**

En `/`: Tab recorre saltar → marca → menú → Oscuro → «Ver las N viviendas» → «Cómo se pide una» → resumen del `<details>` (Enter lo abre) → chips → enlaces de tarjeta → «Me interesa» (Enter marca, `aria-pressed` cambia). En 390px (DevTools móvil): el botón «Menú» abre la lista, Escape la cierra y devuelve el foco al botón. Anotar cualquier elemento sin foco visible y corregir en `styles.css` antes de seguir.

- [ ] **Step 4: Capturas finales**

```bash
node scripts/build.mjs
bash scratch/captura.sh dist/index.html final-portada
bash scratch/captura.sh dist/index.html final-portada-oscuro oscuro
F=$(ls -d dist/promocion/*viveros*/ | head -1); bash scratch/captura.sh "$F/index.html" final-ficha
bash scratch/captura.sh dist/avisos/index.html final-avisos
```

Abrir las ocho imágenes y compararlas con `docs/superpowers/specs/maqueta/pagina-completa.html` (abrirla en el navegador). Lo que difiera de la maqueta y no esté justificado por datos reales distintos, se corrige.

- [ ] **Step 5: Documentación**

En `README.md`, en la sección «Las páginas» (o la más cercana que describa la web), añadir un párrafo:

```markdown
La web es clara por defecto para todo el mundo. El botón «Oscuro» de la cabecera cambia al tema oscuro y
lo recuerda en el navegador de quien lo pulsa (`localStorage`, clave `vivienda:tema`); no se sigue la
preferencia del sistema a propósito, para que la decisión sea siempre de la persona. Las fuentes (Inter e
Inter Tight) van autoalojadas en `src/fonts/` y los iconos son un sprite SVG que genera `scripts/build.mjs`:
la web no carga nada de terceros.
```

En `CLAUDE.md`, en «Cómo trabajar aquí», añadir tras la viñeta de `npm test`:

```markdown
- `scripts/check-contraste.mjs` lee los tokens de `src/styles.css` y falla si un par de colores baja de
  4,5:1 (texto) o 3:1 (componentes) en claro o en oscuro. Si falla, se cambia el color, no el test.
```

- [ ] **Step 6: Commit final y despliegue**

```bash
npm test && node scripts/build.mjs
git add README.md CLAUDE.md
git commit -m "Rediseño: revisión de accesibilidad y documentación"
git push origin main
```

Esperar al despliegue (≈ 1 minuto) y comprobar en vivo: `curl -s https://vivienda.aldeapucela.org/ | grep -c 'hero__num\|data-tema'` → `2`, y `curl -s -o /dev/null -w '%{http_code}\n' https://vivienda.aldeapucela.org/fonts/inter.woff2` → `200`.

---

## Self-review

- **Cobertura de la especificación**: tokens (T1), tema con interruptor y `localStorage` (T1), tipografía autoalojada y escala (T1–T2), iconos (T3), hero con la respuesta primero e ilustración con fundido en claro y oscuro (T4), franja y aviso de honestidad plegado (T4), tarjetas con pastilla y barra (T5), chips (T5), avisos de plazo con reloj y variantes (T6), tejas, paneles y ficha (T7), prosa/tablas/pie y textos del pie (T8), vista previa (T9), WCAG: contraste automatizado (T1), foco (T1), objetivos ≥ 36px (T1, T5), `aria-label`/`aria-pressed` (T1), encabezados (T10), reduced motion (T1, T10), sin JS (T1), sin terceros (T2, T10).
- **Contratos entre tareas**: `icono()` (T3) se usa desde T4; `.seccion/.seccion__titulo/.boton` (T4) desde T5–T7; `.pastilla` (T5) la usa `etiquetaEstado()` en T7 sin cambios; `.aviso-plazo/.reloj/mesCorto()` (T6) los usa `bloqueReparto()` en T7; los alias de tokens viven de T1 a T8 y T8 los retira tras comprobar con `grep` que no quedan usos.
- **Riesgo conocido**: `mix-blend-mode` con `mask-image` sobre la ilustración en oscuro depende del navegador; si en la captura de T4 sale un rectángulo, la salida aceptada es `opacity: .85` sin blend en oscuro, y se anota en el commit.
