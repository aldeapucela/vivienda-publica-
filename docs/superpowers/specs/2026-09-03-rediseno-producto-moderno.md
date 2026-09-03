# Rediseño «Producto moderno» (dirección C, segunda vuelta)

Especificación de diseño para vivienda.aldeapucela.org. La maqueta verificada está en
`maqueta/` (misma carpeta): `pagina-completa.html` es la referencia navegable; los CSS son las
piezas de las que sale. La decisión la tomó Aldea Pucela el 03/09/2026 tras comparar cuatro
direcciones y una segunda vuelta de esta.

## Decisiones ya tomadas (no se reabren)

- **Claro por defecto para todo el mundo**, sin mirar `prefers-color-scheme`. El modo oscuro es
  una elección de la persona, con un interruptor en la cabecera, recordada en su navegador
  (`localStorage`, clave `vivienda:tema`, valores `claro` | `oscuro`). Sin JavaScript, la web es
  clara y no hay interruptor.
- **Se conservan el isotipo y el morado** (`#6b4895` y su familia). La ilustración a lápiz de la
  imagen de compartir entra en el hero de la portada.
- **Público doble** (quien busca casa y quien evalúa el rigor): la portada y las fichas resuelven
  primero a quien busca casa; datos, fuentes y las citas literales siguen presentes, más quietas.
- **Economía verbal.** Se quita lo redundante: entradillas que repiten el nombre de la web,
  direcciones postales en tarjetas, frases de método en la portada. Lo que es honestidad
  (avisos de «esto puede no cuadrar con la web oficial») se queda, plegado en `<details>`.
- **Cero dependencias nuevas**: sin framework, sin librería de iconos, sin CDN. Las fuentes se
  autoalojan en `src/fonts/` (dos ficheros woff2, Inter e Inter Tight, licencia OFL). Ninguna
  petición a terceros: el proyecto no las hacía y no las va a empezar a hacer.

## Tokens

Todos declarados en `:root` (tema claro). El oscuro redefine solo los tokens bajo
`:root[data-theme="dark"]`. Ningún componente lleva un color literal.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--papel` | `#f7f6fa` | `#100e16` | fondo de página |
| `--panel` | `#ffffff` | `#1a1724` | tarjetas, tejas, paneles |
| `--tinta` | `#191623` | `#f3f0f8` | texto |
| `--tinta-suave` | `#6c6682` | `#a49cba` | texto secundario, rótulos |
| `--linea` | `#e7e3ee` | `#2b2539` | bordes, reglas, barra vacía |
| `--acento` | `#6b4895` | `#c2aee4` | enlaces, botón primario, iconos, chips activos |
| `--acento-fuerte` | `#5b3a86` | `#d8c9ee` | hover del acento |
| `--acento-fondo` | `#efe9f7` | `#241f30` | fondo suave (bloque fuente, código, cita) |
| `--acento-borde` | `#d8c9ee` | `#3d3357` | borde de citas y botón «me interesa» |
| `--sobre-acento` | `#ffffff` | `#151021` | texto sobre el acento |
| `--libre` | `#1a6b40` | `#71dda3` | texto «libre» |
| `--libre-fondo` | `#e8f4ec` | `#14301f` | fondo de la pastilla libre |
| `--libre-barra` | `#2f9160` | `#71dda3` | relleno de la barra de ocupación |
| `--ocupada` | `#8a4b52` | `#e2a3a9` | texto «completa / adjudicada» |
| `--ocupada-fondo` | `#f4eaec` | `#33191c` | fondo de esa pastilla |
| `--urge` | `#a4444f` | `#e2a3a9` | plazo a ≤ 3 días, variación negativa |
| `--aviso` | `#6b4f0d` | `#e8c579` | texto de avisos (datos rancios, desfases) |
| `--aviso-fondo` | `#fbf1da` | `#33280f` | fondo de avisos |
| `--sombra` | `0 1px 2px rgba(25,22,35,.06), 0 8px 24px -16px rgba(25,22,35,.24)` | `0 1px 2px rgba(0,0,0,.4)` | solo tarjetas y avisos de plazo |
| `--radio-s` / `--radio-m` / `--radio-l` | `8px` / `12px` / `14px` | igual | chips y pastillas / tejas / tarjetas y paneles |
| `--ancho` | `68rem` | igual | contenedor |

Contraste medido (WCAG 2.2, relación mínima 4,5:1 en texto y 3:1 en componentes):
tinta/papel 16,5 · suave/papel 5,06 · suave/panel 5,44 · acento/papel 6,54 · acento/panel 7,03 ·
sobre-acento/acento 7,03 · libre/libre-fondo 5,77 · ocupada/ocupada-fondo 5,56 · urge/papel 5,55 ·
libre-barra/linea 3,11 (componente). Oscuro: tinta 17,0 · suave 6,75 · acento 8,78 · sobre-acento 9,28 ·
libre 8,54. `scripts/check-contraste.mjs` lo comprueba en cada `npm test`.

## Tipografía

- **Inter** (texto, datos, interfaz), variable 400–700, `src/fonts/inter.woff2`.
- **Inter Tight** (titulares, cifras, títulos de tarjeta), variable 500–700, `src/fonts/inter-tight.woff2`.
- Ambas con `font-display: swap` y pila de reserva `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`.

Escala (base 16 px, valores en `rem`):

| Rol | Tamaño | Peso | Interlineado | Tracking | Familia |
|---|---|---|---|---|---|
| cifra del hero | `clamp(4.5rem, 9vw, 6.75rem)` | 600 | .9 | −.045em | Inter Tight |
| titular del hero / `h1` de páginas | `clamp(1.5rem, 2.2vw + .75rem, 2.125rem)` | 600 | 1.12 | −.025em | Inter Tight |
| `h2` de prosa | `1.375rem` | 600 | 1.2 | −.02em | Inter Tight |
| título de sección (portada, ficha) | `.8125rem` | 600 | 1.4 | .02em | Inter, color `--tinta-suave`, con icono |
| título de tarjeta / aviso | `1.03rem` | 600 | 1.3 | −.015em | Inter Tight |
| cifra de teja | `1.625rem` | 600 | 1.05 | −.02em | Inter Tight, `tabular-nums` |
| texto | `1rem` | 400 | 1.6 | 0 | Inter |
| secundario (`.fino`) | `.8125rem` | 400 | 1.55 | 0 | Inter |
| pastilla / chip | `.72rem` / `.8125rem` | 600 / 500 | 1 | 0 | Inter |

Nada de mayúsculas con tracking en rótulos, salvo el «Aldea Pucela» de la marca, que es herencia
de la casa.

## Componentes

- **Cabecera** pegajosa: marca · menú (visible desde 62rem; botón «Menú» debajo) · **interruptor
  de tema** («Oscuro» / «Claro», `aria-pressed`, icono luna/sol). Por debajo de 30rem los dos
  botones se quedan en icono con `aria-label`.
- **Hero de portada** (dos columnas desde 52rem): a la izquierda la cifra de viviendas que se
  pueden pedir hoy como `h1`, tres hechos con icono (dónde, plazo que corre, comprobado), botón
  primario «Ver las N viviendas» (ancla al listado) y enlace «Cómo se pide una». A la derecha la
  ilustración (`src/img/promocion.jpg`) fundida con el papel mediante `mask-image` radial y
  `mix-blend-mode: multiply`; en oscuro, `filter: invert(1) hue-rotate(180deg)` + `screen`. En
  móvil la ilustración va arriba, recortada a 190px con fundido inferior. Si no hay viviendas que
  se puedan pedir, la cifra no se enseña y el titular dice que ahora mismo no hay ninguna.
- **Franja de cifras** bajo el hero: promociones en la provincia · viviendas anunciadas · ya
  repartidas, con icono, en una línea, separada por una regla. Debajo, plegado: «Por qué este
  número puede no cuadrar con la web oficial» (el aviso de honestidad que ya existía).
- **Aviso de plazo**: panel con borde izquierdo de 3px en acento, **ficha de reloj** (número de
  días grande + «días») a la izquierda, título, línea de regla corta, `<details>` con la cita y
  referencia con icono de documento. Variantes: urge (≤ 3 días, reloj y borde en `--urge`), hoy,
  sin fecha, pasado (reloj apagado).
- **Tarjeta de promoción**: título + lugar/obra a la izquierda, **pastilla de estado con punto**
  a la derecha (libre / completa / adjudicada / en reparto / sin tabla), **barra de ocupación**
  (verde `--libre-barra` sobre `--linea`), pie con «x de y libres», «Plazo abierto» si lo hay y el
  botón «Me interesa». La barra siempre a la misma altura entre tarjetas de una fila.
- **Chips de filtro**: los `button` de `.filtros`, radio `--radio-s`, activo en acento.
- **Tejas** (`dl`): rótulo con icono + cifra + unidad debajo. Variante `--foco` en acento sólido
  para la cifra protagonista.
- **Paneles** (`.bloque`): panel blanco, borde 1px, radio `--radio-l`, sin sombra (la sombra es
  solo para tarjetas y avisos de plazo). Variante `--fuente` en `--acento-fondo`.
- **Pastillas**: punto + texto, radio `--radio-s`. Estados de vivienda en la tabla: mismo patrón.
- **Pie**: marca, un párrafo («Esta web no es oficial…»), enlaces, licencias.
- **Iconos**: sprite SVG inline al principio del `<body>`, trazo 1.75, cabos redondos, 24×24:
  `llave`, `reloj`, `edificio`, `vecinos`, `baja`, `doc`, `ok`, `flecha`, `pin`, `luna`, `sol`,
  `menu`, `cruz`, `campana`. Se usan con `<svg class="ic" aria-hidden="true"><use href="#i-…"/></svg>`.

## Movimiento

Solo como respuesta a una acción: `transition` de 150–200 ms en color, borde y `transform` de
chips, botones y enlaces; menú y `<details>` sin animar. Todo bajo `@media (prefers-reduced-motion:
no-preference)`; con `reduce`, ninguna transición.

## Accesibilidad (WCAG 2.2 AA, comprobable)

- Contraste ≥ 4,5:1 en todo texto y ≥ 3:1 en bordes/barras significativas, en ambos temas
  (`check-contraste.mjs`).
- Ningún estado se comunica **solo por color**: pastillas con texto, barra con cifra al lado,
  urgencia con texto «Quedan N días».
- Foco visible: `outline: 3px solid var(--acento); outline-offset: 2px` en todo lo enfocable.
- Objetivos táctiles ≥ 24×24 (chips 36px de alto, botones de cabecera 36px).
- Botones de icono con `aria-label`; interruptor de tema con `aria-pressed`; menú con
  `aria-expanded` y `aria-controls`; enlace «Saltar al contenido».
- Orden de encabezados: un `h1` por página; secciones de portada y ficha en `h2`; tarjetas y
  avisos en `h3` (o `h2` dentro de listados independientes, como ahora).
- Sin JavaScript: todo el contenido visible, menú desplegado, sin interruptor de tema ni botón
  «Me interesa» (ambos `hidden` hasta que el JS los activa).
- `prefers-reduced-motion` respetado. Texto redimensionable (todo en `rem`).
- La ilustración es decorativa: `alt=""`.

## Textos

Frases nuevas, tal cual van (lo demás se conserva):

- Hero, con viviendas: «**N** viviendas públicas se pueden pedir hoy en Valladolid».
- Hero, sin viviendas: «Ahora mismo no hay viviendas públicas que se puedan pedir en Valladolid».
- Hechos: «N en Localidad · M en Localidad» · «Quedan N días para pedir las de Localidad» ·
  «Comprobado hoy en la web oficial» (o «ayer», o «el AAAA-MM-DD»).
- Botón: «Ver las N viviendas». Enlace: «Cómo se pide una».
- Franja: «N promociones en la provincia» · «N viviendas anunciadas» · «N ya repartidas».
- Resumen de contexto: «N de las M promociones están en municipios que pierden población» +
  «(Junta de Castilla y León, AAAA)» enlazado.
- Aviso de plazo: «Cierra el AAAA-MM-DD. N días naturales desde el día siguiente a …» y, si es
  hábiles, «Ojo: no descontamos festivos locales; comprueba el documento».
- Pie: «**Esta web no es oficial.** Para cualquier trámite, ve a la web de SOMACYL y al boletín. La
  hacen vecinas y vecinos de Aldea Pucela; todo dato lleva enlace a su fuente y aquí no hay datos
  personales de nadie.»
