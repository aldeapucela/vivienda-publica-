#!/usr/bin/env node
// Genera el sitio estático en dist/ a partir de data/. Sin dependencias y sin
// red: todo el contenido informativo se sirve como HTML ya renderizado, así
// que la web funciona sin JavaScript (el JS solo filtra tarjetas).
//
//   node scripts/build.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minusculiza, estadoAdjudicacion, libresSignificaDisponible } from './lib.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RAIZ, 'dist');
// Dónde se publica. El sitio vive en su dominio propio y sirve desde la raíz, así
// que los enlaces internos van absolutos tal cual. SITIO_URL solo para pruebas.
const SITIO = (process.env.SITIO_URL ?? 'https://vivienda.aldeapucela.org').replace(/\/+$/, '');
const MATOMO_SITE_ID = '28'; // stats.aldeapucela.org
const PROVINCIA_POR_DEFECTO = 'Valladolid';

const indice = json('data/promociones.json');
const COMPROBADO = indice.comprobado ?? indice.actualizado ?? HOY_INICIAL();
function HOY_INICIAL() { return new Date().toISOString().slice(0, 10); }
const NOMBRES_PROPIOS = json('config/estilo.json', { nombres_propios: [] }).nombres_propios ?? [];
const historico = json('data/historico.json', { registros: [] });
const avisos = json('data/avisos.json', { avisos: [] }).avisos ?? [];
// Contexto del municipio (población y parque de viviendas, Junta de Castilla y
// León). Si el fichero no está, la web sale igual y sin ese bloque.
const CONTEXTO = json('data/contexto-municipios.json', { conjuntos: [], municipios: [] });
// Los plazos salen de los boletines (data/plazos.json) y config/plazos.json
// solo sirve para corregir a mano lo que la extracción haga mal.
const PLAZOS = mezcla(
  json('data/plazos.json', { plazos: [] }).plazos ?? [],
  (json('config/plazos.json', { plazos: [] }).plazos ?? []).filter((z) => z.fuente_url));

function mezcla(automaticos, manuales) {
  const pisados = new Set(manuales.map((z) => `${z.promocion_id}:${z.tipo}`));
  return [
    ...manuales.map((z) => ({ ...z, origen: 'manual' })),
    ...automaticos.filter((z) => !pisados.has(`${z.promocion_id}:${z.tipo}`)),
  ];
}
const promociones = indice.promociones ?? [];
const HOY = new Date().toISOString().slice(0, 10);

// Ficha completa y hitos de cada promoción: hacen falta para saber si su tabla
// de viviendas significa algo. La web oficial no actualiza esa tabla al ritmo
// del procedimiento, así que «libre» puede querer decir «sin tocar desde antes
// del sorteo».
const HITOS = json('data/hitos.json', { hitos: [] }).hitos ?? [];
const DETALLES = new Map(promociones.map((p) => [p.id, json(`data/promociones/${p.id}.json`)]));
const REPARTO = new Map(promociones.map((p) => [p.id, estadoAdjudicacion({
  documentos: DETALLES.get(p.id)?.documentos ?? [],
  hitos: hitosDe(p.id),
})]));

function hitosDe(id) { return HITOS.filter((h) => h.promocion_id === id); }
function reparto(id) { return REPARTO.get(id) ?? { estado: 'sin_reparto', desde: null }; }
function ofrece(id) { return libresSignificaDisponible(reparto(id).estado); }

// En modo `--single` se genera además un único HTML autocontenido con todas las
// páginas dentro (vista previa compartible mientras no hay dominio).
const SOLO_UNA = process.argv.includes('--single');
const paginas = [];

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

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

escribe('index.html', paginaPortada());
for (const p of promociones) {
  escribe(`promocion/${p.id}/index.html`, paginaPromocion(DETALLES.get(p.id)));
}
escribe('como-funciona/index.html', paginaDoc('docs/proceso.md', 'Cómo funciona el proceso', '/como-funciona/'));
escribe('privacidad/index.html', paginaDoc('docs/privacidad.md', 'Privacidad', '/privacidad/'));
escribe('fuentes/index.html', paginaDoc('docs/fuentes.md', 'De dónde salen los datos', '/fuentes/'));
escribe('datos/index.html', paginaDatos());
escribe('avisos/index.html', paginaAvisos());
escribe('avisos.xml', feedRss(avisos.slice(0, 50), 'Avisos de vivienda pública en Valladolid', '/avisos.xml'));
escribe('plazos.ics', calendario(PLAZOS));
for (const p of promociones) {
  const suyos = avisos.filter((a) => a.promocion_id === p.id).slice(0, 30);
  escribe(`promocion/${p.id}/avisos.xml`, feedRss(suyos, `Avisos · ${p.nombre}`, `/promocion/${p.id}/avisos.xml`));
  const plazos = PLAZOS.filter((z) => z.promocion_id === p.id);
  if (plazos.length) escribe(`promocion/${p.id}/plazos.ics`, calendario(plazos));
}
escribe('404.html', pagina404());
escribe('sitemap.xml', sitemap());
escribe('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITIO}/sitemap.xml\n`);

copia('src/styles.css', 'styles.css');
copia('src/app.js', 'app.js');
copiaDir('src/img', 'img');
copiaDir('src/fonts', 'fonts');
copiaDir('data', 'data');
copia('.nojekyll', '.nojekyll');
// El dominio propio viaja en el artefacto para que Pages no lo pierda al desplegar.
copia('CNAME', 'CNAME');

console.log(`✔ dist/ generado: ${promociones.length} fichas · ${PLAZOS.length} plazos · ${avisos.length} avisos`);

if (SOLO_UNA) {
  escribe('vista-previa.html', unaSolaPagina());
  console.log('✔ dist/vista-previa.html: todo el sitio en un único fichero');
}

// ------------------------------------------------------------- plantillas ----

function layout({ titulo, descripcion, ruta, cuerpo, activo = '' }) {
  if (SOLO_UNA) paginas.push({ titulo, ruta, cuerpo });
  const t = `${titulo} · Vivienda pública en Valladolid`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t)}</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${SITIO}${ruta}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Vivienda · Aldea Pucela">
<meta property="og:locale" content="es_ES">
<meta property="og:title" content="${esc(t)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:url" content="${SITIO}${ruta}">
<meta property="og:image" content="${SITIO}/img/og.jpg?v=1">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Vivienda pública · Aldea Pucela: promociones de alquiler en Valladolid">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITIO}/img/og.jpg?v=1">
<link rel="icon" href="/img/aldea-pucela.jpg">
<link rel="stylesheet" href="/styles.css">
<script>document.documentElement.className += ' con-js';
try { if (localStorage.getItem('vivienda:tema') === 'oscuro') document.documentElement.setAttribute('data-theme', 'dark'); } catch (e) {}</script>
${matomo()}</head>
<body>
${sprite()}
<a class="saltar" href="#contenido">Saltar al contenido</a>
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
<p class="rancio" id="rancio" data-comprobado="${esc(COMPROBADO)}" hidden></p>
<main id="contenido" class="container principal">
${cuerpo}
</main>
<footer class="pie">
  <div class="container pie__inner">
    ${marca('pie')}
    <div class="pie__texto">
      <p><strong>Esta web no es oficial.</strong> La hacen vecinas y vecinos de
        <a href="https://aldeapucela.org" rel="noopener">Aldea Pucela</a>, y ordena información que ya publica
        <a href="https://tuyavivienda.es" rel="noopener">tuyavivienda.es</a> (SOMACYL, Junta de Castilla y León).
        Para cualquier trámite, lo que vale es la web oficial y el boletín.</p>
      <p>Aquí no se publican datos personales de quienes solicitan o reciben una vivienda.</p>
    </div>
    <nav class="pie__enlaces" aria-label="Enlaces del pie">
      <a href="/como-funciona/">Cómo funciona el proceso</a>
      <a href="/avisos/">Avisos y plazos</a>
      <a href="/datos/">Datos abiertos</a>
      <a href="/fuentes/">De dónde salen los datos</a>
      <a href="/privacidad/">Privacidad</a>
      <a href="https://github.com/aldeapucela/vivienda-publica-" rel="noopener">Código fuente</a>
    </nav>
    <p class="fino">Contenido y datos con licencia
      <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" rel="license noopener">CC BY-SA 4.0</a> ·
      Código con licencia
      <a href="https://github.com/aldeapucela/vivienda-publica-/blob/main/LICENSE" rel="license noopener">AGPL-3.0</a></p>
  </div>
</footer>
<script src="/app.js" defer></script>
</body>
</html>
`;
}

/**
 * La marca de la casa: isotipo de Aldea Pucela + nombre de la comunidad +
 * nombre de este proyecto, igual que en el resto de webs vecinales.
 */
function marca(donde = 'topbar') {
  return `<a class="marca marca--${donde}" href="/">
      <img class="marca__isotipo" src="/img/aldea-pucela.jpg" alt="" width="48" height="48" decoding="async">
      <span class="marca__texto">
        <span class="marca__kicker">Aldea Pucela</span>
        <span class="marca__titulo">Vivienda pública</span>
      </span>
    </a>`;
}

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

/** Plazos que aún no han terminado, del más urgente al más lejano. */
function plazosVivos(idPromocion = null) {
  return PLAZOS
    .filter((z) => (!idPromocion || z.promocion_id === idPromocion))
    .filter((z) => z.fin && dias(HOY, z.fin) >= 0)
    .sort((a, b) => a.fin.localeCompare(b.fin));
}

/** Plazos que dependen de un hecho cuya fecha no consta: se enseña la regla. */
function plazosSinFecha(idPromocion) {
  return PLAZOS.filter((z) => z.promocion_id === idPromocion && !z.fin);
}

function plazosPasados(idPromocion) {
  return PLAZOS.filter((z) => z.promocion_id === idPromocion && z.fin && dias(HOY, z.fin) < 0)
    .sort((a, b) => b.fin.localeCompare(a.fin));
}

function dias(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function cuentaAtras(z) {
  if (!z.fin) return 'Depende de una fecha que aún no consta';
  const quedan = dias(HOY, z.fin);
  if (quedan < 0) return `Cerrado el ${z.fin}`;
  if (quedan === 0) return 'Termina HOY';
  if (quedan === 1) return 'Queda 1 día';
  return `Quedan ${quedan} días`;
}

function bloquePlazos(lista, { titulo = 'Plazos abiertos', conPromocion = true, cerrados = false } = {}) {
  if (!lista.length) return '';
  return `<section class="bloque bloque--plazos">
    <h2>${esc(titulo)}</h2>
    <ul class="plazos">
${lista.map((z) => plazoHtml(z, conPromocion, cerrados)).join('\n')}
    </ul>
    <p class="fino">${cerrados ? 'Plazos ya cerrados, para poder reconstruir la cronología.'
      : 'Fechas sacadas del propio boletín oficial: se cuenta el plazo que fija el documento desde el día en que se publicó. Si hay discrepancia, manda el documento.'}
       <a href="/avisos/">Cómo te avisamos con tiempo →</a></p>
  </section>`;
}

function plazoHtml(z, conPromocion, cerrado) {
  const quedan = z.fin ? dias(HOY, z.fin) : null;
  const clase = cerrado ? 'pasado' : quedan != null && quedan <= 3 ? 'urge' : 'normal';
  return `      <li class="plazo plazo--${clase}">
        <p class="plazo__cuenta">${esc(cuentaAtras(z))}</p>
        <p class="plazo__que">${esc(z.titulo ?? 'Plazo')}${conPromocion ? ` · ${esc(nombrePromocion(z.promocion_id))}` : ''}</p>
        ${z.regla ? `<p class="fino">${esc(`${z.regla.cantidad} días ${z.regla.unidad}${
          z.regla.ancla_texto ? ` desde el día siguiente a ${z.regla.ancla_texto}` : ''}${
          z.regla.desde ? `, que fue el ${z.regla.desde}` : ''}.`)}${
          z.regla.unidad === 'habiles' ? ' <strong>Ojo:</strong> al contar días hábiles no sabemos los festivos locales; comprueba el documento.' : ''}</p>` : ''}
        ${z.cita ? `<details class="cita"><summary>Lo que dice el documento</summary><blockquote>${esc(z.cita)}</blockquote></details>` : ''}
        <p class="fino"><a href="${esc(z.fuente_url)}" rel="noopener nofollow">${esc(z.fuente_ref ?? 'Documento oficial')}</a>
          · ${z.origen === 'manual' ? 'corregido a mano por la comunidad' : `leído automáticamente del documento el ${esc(z.extraido ?? '')}`}</p>
      </li>`;
}

function nombrePromocion(id) {
  const p = promociones.find((x) => x.id === id);
  return p ? minusculiza(p.nombre, [...NOMBRES_PROPIOS, p.localidad, p.provincia]) : id;
}

function paginaPortada() {
  const deValladolid = promociones.filter((p) => p.provincia === PROVINCIA_POR_DEFECTO);
  const disponibles = deValladolid.filter((p) => p.disponibilidad?.publicada && ofrece(p.id));
  const libres = suma(disponibles.map((p) => p.disponibilidad.libres));
  const repartidas = deValladolid.filter((p) => reparto(p.id).estado === 'adjudicada').length;
  const viviendas = suma(deValladolid.map((p) => p.n_viviendas ?? 0));

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

${bloquePlazos(plazosVivos())}

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

${ultimosAvisos()}
`;
  return layout({
    titulo: 'Promociones',
    descripcion: 'Seguimiento vecinal de las promociones públicas de alquiler joven (SOMACYL) en Valladolid: estado, viviendas libres y documentos oficiales.',
    ruta: '/', cuerpo, activo: 'inicio',
  });
}

/** Primero lo que le sirve a quien busca casa: promociones con viviendas libres. */
function ordenadas(lista) {
  const prioridad = (p) => {
    const d = p.disponibilidad ?? {};
    const r = reparto(p.id);
    if (r.estado === 'adjudicada') return 3;              // ya repartida: al final
    if (d.publicada && d.libres > 0 && ofrece(p.id)) return 0;
    if (r.estado === 'en_reparto') return 1;
    if (!d.publicada) return 2;
    return 3;
  };
  return lista.slice().sort((a, b) =>
    prioridad(a) - prioridad(b) ||
    (a.localidad ?? '').localeCompare(b.localidad ?? '', 'es') ||
    (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
}

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

/** 302614 → «302.614». Sin depender de la configuración regional del sistema. */
function miles(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** -0.4 → «−0,4 %» · 13.3 → «+13,3 %» */
function porcentaje(n) {
  const signo = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${signo}${Math.abs(n).toFixed(1).replace('.', ',')} %`;
}

function contextoDe(localidad) {
  return CONTEXTO.municipios.find((m) => m.localidad === localidad) ?? null;
}

function conjuntoDe(id) {
  return CONTEXTO.conjuntos.find((c) => c.id === id) ?? {};
}

/**
 * Para quién se construye: cuánta gente vive en el municipio y cuántas
 * viviendas hay ya. No es adorno: diez viviendas no significan lo mismo en un
 * municipio que crece que en uno que pierde vecinos.
 *
 * Sale de dos conjuntos del Portal de Datos Abiertos de la Junta de Castilla y
 * León, cuya licencia (CC BY 4.0) obliga a citarla. Si el municipio no aparece
 * en esos ficheros, no hay bloque: no se estima nada.
 */
function bloqueContexto(localidad) {
  const c = contextoDe(localidad);
  if (!c || (!c.poblacion && !c.viviendas)) return '';

  const pob = conjuntoDe('poblacion');
  const viv = conjuntoDe('viviendas');
  const d = c.variacion_decada_pct;
  const frase = d == null ? ''
    : d <= -1 ? `${esc(localidad)} tiene un ${porcentaje(d).replace('−', '')} menos de habitantes que hace diez años.`
    : d >= 1 ? `${esc(localidad)} tiene un ${porcentaje(d).replace('+', '')} más de habitantes que hace diez años.`
    : `La población de ${esc(localidad)} está prácticamente igual que hace diez años.`;

  return `<section class="bloque bloque--contexto">
    <h2>El municipio</h2>
    <dl class="cifras cifras--ficha">
      ${c.poblacion ? `<div><dt>Habitantes</dt><dd>${miles(c.poblacion.habitantes)}
        <span class="de">en ${c.poblacion.anio}</span></dd></div>` : ''}
      ${c.variacion_decada_pct != null ? `<div><dt>En diez años</dt><dd>${porcentaje(c.variacion_decada_pct)}
        <span class="de">desde ${c.poblacion_referencia.anio}</span></dd></div>` : ''}
      ${c.viviendas ? `<div><dt>Viviendas que ya hay</dt><dd>${miles(c.viviendas.total)}
        <span class="de">censo de ${c.viviendas.anio}</span></dd></div>` : ''}
    </dl>
    ${frase ? `<p>${frase}</p>` : ''}
    <p class="fino">Fuente: ${c.poblacion ? `<a href="${esc(pob.ficha)}" rel="noopener">${esc(pob.titulo)}</a>` : ''}${c.poblacion && c.viviendas ? ' y ' : ''}${c.viviendas ? `<a href="${esc(viv.ficha)}" rel="noopener">${esc(viv.titulo)}</a>` : ''},
       <strong>Junta de Castilla y León</strong> (<a href="https://creativecommons.org/licenses/by/4.0/deed.es" rel="noopener">CC BY 4.0</a>),
       del <a href="https://datosabiertos.jcyl.es" rel="noopener">Portal de Datos Abiertos de Castilla y León</a>.
       Ficheros leídos el ${esc(pob.fecha_captura ?? viv.fecha_captura ?? '')}.
       En esos ficheros el municipio es «${esc(c.municipio_jcyl)}», código INE ${esc(c.codigo_ine)}.</p>
  </section>`;
}

/** «19 de las 27 promociones están donde se pierde población» — para la portada. */
function resumenContexto(lista) {
  const conDato = lista.filter((p) => contextoDe(p.localidad)?.variacion_decada_pct != null);
  if (conDato.length < lista.length / 2) return '';
  const bajan = conDato.filter((p) => contextoDe(p.localidad).variacion_decada_pct < 0);
  if (!bajan.length) return '';
  const anio = conjuntoDe('poblacion').anio_ultimo;
  return `<p class="fino franja__contexto">${bajan.length} de las ${conDato.length} promociones están en municipios que
     pierden población (<a href="${esc(conjuntoDe('poblacion').ficha)}" rel="noopener">Junta de Castilla y León</a>, ${esc(String(anio))}).</p>`;
}

function paginaPromocion(p) {
  const d = p.disponibilidad ?? {};
  const serie = (historico.registros ?? []).filter((r) => r.promocion_id === p.id);
  const desfase = p.n_viviendas && d.total && p.n_viviendas !== d.total;

  const cuerpo = `
<nav class="miga"><a href="/">Promociones</a> › <span>${esc(p.localidad ?? '')}</span></nav>
<article class="ficha">
  <header>
    <p class="tarjeta__lugar">${esc([...new Set([p.localidad, p.provincia].filter(Boolean))].join(' · '))}</p>
    <h1>${esc(minusculiza(p.nombre, [...NOMBRES_PROPIOS, p.localidad, p.provincia]))}</h1>
    ${p.direccion ? `<p class="direccion">${esc(p.direccion)}</p>` : ''}
  </header>

  ${bloqueReparto(p, d)}

  <section class="bloque">
    <h2>${reparto(p.id).estado === 'sin_reparto' ? 'Viviendas libres' : 'Qué dice la tabla de la web oficial'}</h2>
    ${d.publicada ? `
    <dl class="cifras cifras--ficha">
      <div${ofrece(p.id) ? ' class="es-libre"' : ''}><dt>Marcadas «libre»</dt><dd>${d.libres}</dd></div>
      <div><dt>Próximamente</dt><dd>${d.proximamente}</dd></div>
      <div><dt>Ocupadas</dt><dd>${d.ocupadas}</dd></div>
      <div><dt>En la tabla</dt><dd>${d.total}</dd></div>
    </dl>
    ${desfase ? `<p class="aviso">La ficha oficial anuncia ${p.n_viviendas} viviendas pero su tabla detalla ${d.total}.
       No sabemos por qué: lo dejamos tal cual lo publica la fuente.</p>` : ''}
    ${tablaViviendas(p.viviendas)}
    ${serie.length > 1 ? historicoHtml(serie) : `<p class="fino">Miramos esta tabla todos los días desde el ${esc(serie[0]?.fecha ?? p.capturado)}. Cuando cambie algo, aparecerá aquí.</p>`}
    ` : `<p class="aviso">La web oficial todavía no publica la tabla de viviendas de esta promoción, así que no
       podemos decir cuántas quedan libres. En cuanto la publique, aparecerá aquí sola.</p>`}
  </section>

  ${bloquePlazos(plazosVivos(p.id), { titulo: 'Plazos abiertos', conPromocion: false })}
  ${bloquePlazos(plazosSinFecha(p.id), { titulo: 'Plazos que dependen de lo que pase antes', conPromocion: false })}
  ${bloquePlazos(plazosPasados(p.id), { titulo: 'Plazos ya cerrados', conPromocion: false, cerrados: true })}

  <section class="bloque bloque--seguir">
    <h2>Que no se te pase</h2>
    ${botonSeguir(p.id, 'grande')}
    <ul class="docs">
      <li><a href="/promocion/${esc(p.id)}/avisos.xml">Avisos de esta promoción por RSS</a>
        <p class="fino">Para leerlo con tu lector de siempre o enchufarlo a Telegram.</p></li>
      ${plazosVivos(p.id).length ? `<li><a href="/promocion/${esc(p.id)}/plazos.ics">Plazos en tu calendario (.ics)</a>
        <p class="fino">Tu móvil te avisa 14, 7, 3 y 1 días antes del cierre.</p></li>` : ''}
      <li><a href="/avisos/">Cómo funcionan los avisos</a></li>
    </ul>
  </section>

  ${avisosDe(p.id)}

  <section class="bloque">
    <h2>¿En qué punto está mi solicitud?</h2>
    ${situacion(p, d)}
    <p><a href="/como-funciona/">Ver el proceso completo, paso a paso →</a></p>
  </section>

  <section class="bloque">
    <h2>Documentos oficiales</h2>
    ${p.documentos.length ? `<ul class="docs">
      ${p.documentos.map(documentoHtml).join('\n      ')}
    </ul>` : '<p class="fino">La ficha oficial no enlaza documentos todavía.</p>'}
  </section>

  ${bloqueContexto(p.localidad)}

  <section class="bloque bloque--fuente">
    <h2>De dónde sale esto</h2>
    <ul class="fino">
      <li>Fuente: <a href="${esc(p.url_oficial)}" rel="noopener nofollow">ficha oficial en tuyavivienda.es</a></li>
      <li>Leída el ${esc(p.capturado)}${p.actualizado_fuente ? ` · la fuente dice haberla actualizado el ${esc(p.actualizado_fuente.slice(0, 10))}` : ''}</li>
      <li>Huella digital de la página que leímos: <code>${esc((p.sha256_pagina ?? '').slice(0, 16))}…</code>
        (sirve para comprobar que el dato salió exactamente de ahí)</li>
    </ul>
  </section>
</article>
`;
  return layout({
    titulo: minusculiza(p.nombre, [...NOMBRES_PROPIOS, p.localidad, p.provincia]) || 'Promoción',
    descripcion: `${p.n_viviendas ?? ''} viviendas públicas en ${p.localidad ?? ''}: estado, viviendas libres y documentos oficiales.`,
    ruta: `/promocion/${p.id}/`, cuerpo,
  });
}

/**
 * Lo primero de la ficha cuando la promoción ya se ha repartido: decirlo, con
 * la fecha del acuerdo y el boletín que lo publica. Sin esto, la tabla de la
 * web oficial —que sigue marcando las viviendas como libres— hace creer que
 * hay 59 pisos esperando a quien entre.
 */
function bloqueReparto(p, d) {
  const r = reparto(p.id);
  const hitos = hitosDe(p.id).filter((h) => h.tipo !== 'lista_provisional');
  if (r.estado === 'sin_reparto') return '';

  const desfase = r.estado === 'adjudicada' && d.publicada && d.libres === d.total;
  const titular = r.estado === 'adjudicada'
    ? (r.desde ? `Esta promoción ya está adjudicada (${esc(r.desde)})` : 'Esta promoción ya está adjudicada')
    : 'El reparto de estas viviendas está en marcha';

  return `<section class="bloque bloque--reparto">
    <h2>${titular}</h2>
    ${r.estado === 'adjudicada'
      ? `<p>La lista definitiva de adjudicatarios está aprobada y publicada en el boletín oficial, así que
         <strong>estas viviendas ya tienen destinatario</strong>. Si estabas en la lista de reserva, tu turno
         depende de que alguien renuncie, y eso se comunica de forma individual.</p>`
      : `<p>Hay un procedimiento en marcha: se han presentado solicitudes y todavía no consta publicada la lista
         definitiva de adjudicatarios. Hasta que eso ocurra, estas viviendas no se pueden pedir por libre.</p>`}
    ${desfase ? `<p class="aviso"><strong>La tabla de la web oficial sigue marcando las ${d.total} viviendas como
       «libres»</strong>, pero eso no significa que estén disponibles: esa tabla no se ha actualizado desde que se
       resolvió el reparto. Nos fiamos del boletín, que es el documento con validez.</p>` : ''}
    ${hitos.length ? `<ul class="plazos">
      ${hitos.map((h) => `<li class="plazo plazo--pasado">
        <p class="plazo__cuenta">${esc(h.fecha ?? 'Sin fecha')}</p>
        <p class="plazo__que">${esc(h.titulo)}${h.fecha && !h.fecha_es_del_acuerdo ? ' <span class="fino">(fecha de publicación del boletín)</span>' : ''}</p>
        ${h.cita ? `<details class="cita"><summary>Lo que dice el documento</summary><blockquote>${esc(h.cita)}</blockquote></details>` : ''}
        <p class="fino"><a href="${esc(h.fuente_url)}" rel="noopener nofollow">${esc(h.fuente_ref ?? 'Documento oficial')}</a></p>
      </li>`).join('\n      ')}
    </ul>` : ''}
  </section>`;
}

function tablaViviendas(viviendas = []) {
  if (!viviendas.length) return '';
  const filas = viviendas.map((v) => `      <tr class="v-${esc(v.estado ?? 'sin-dato')}">
        <td>${esc([v.portal, v.piso].filter(Boolean).join(' · '))}</td>
        <td>${etiquetaEstado(v.estado)}</td>
        <td class="num">${v.habitaciones ?? '—'}</td>
        <td class="num">${v.m2 != null ? `${v.m2.toString().replace('.', ',')} m²` : '—'}</td>
        <td class="num">${v.precio_eur_mes != null ? `${v.precio_eur_mes} €` : '—'}</td>
      </tr>`).join('\n');
  return `<div class="tabla-scroll">
    <table class="tabla">
      <caption class="fino">Cada vivienda, tal y como la publica la web oficial.</caption>
      <thead><tr><th scope="col">Vivienda</th><th scope="col">Estado</th><th scope="col">Hab.</th><th scope="col">Superficie</th><th scope="col">Renta</th></tr></thead>
      <tbody>
${filas}
      </tbody>
    </table>
  </div>`;
}

function etiquetaEstado(estado) {
  const mapa = { libre: 'Libre', ocupada: 'Ocupada', proximamente: 'Próximamente' };
  return `<span class="pastilla pastilla--${esc(estado ?? 'sin-dato')}">${esc(mapa[estado] ?? 'Sin dato')}</span>`;
}

function historicoHtml(serie) {
  const filas = serie.slice().reverse().map((r) => `      <tr><td>${esc(r.fecha)}</td><td class="num">${r.libres}</td><td class="num">${r.ocupadas}</td><td class="num">${r.proximamente}</td></tr>`).join('\n');
  return `<details class="historico">
    <summary>Cómo ha ido cambiando (${serie.length} registros)</summary>
    <div class="tabla-scroll">
      <table class="tabla">
        <thead><tr><th scope="col">Día</th><th scope="col">Libres</th><th scope="col">Ocupadas</th><th scope="col">Próximamente</th></tr></thead>
        <tbody>
${filas}
        </tbody>
      </table>
    </div>
    <p class="fino">Solo se anota el día en que algo cambia. Es la única forma honesta que tenemos de enseñar
       cómo avanza la lista: mirando lo que la propia fuente oficial publica, sin datos de nadie.</p>
  </details>`;
}

/** Explicación en lenguaje claro del punto del proceso, sin inventar plazos. */
function situacion(p, d) {
  const partes = [];
  const r = reparto(p.id);
  if (r.estado === 'adjudicada') {
    partes.push(`Esta promoción <strong>ya está adjudicada</strong>${r.desde ? ` (acuerdo de ${esc(r.desde)})` : ''}: la lista definitiva está publicada en el boletín. Si presentaste solicitud, tu situación —adjudicataria o en lista de reserva— consta en ese listado, que se abre en la web oficial.`);
  }
  if (p.estado_procedimiento === 'abierto') {
    partes.push('La ficha oficial marca el <strong>procedimiento como abierto</strong>: se pueden presentar solicitudes. Los plazos exactos están en el anuncio del BOCYL o del Boletín de la Provincia que enlazamos abajo — son los que valen.');
  } else if (p.estado_procedimiento === 'cerrado') {
    partes.push('La ficha oficial marca el <strong>procedimiento como cerrado</strong>: el plazo para solicitar esta promoción ya pasó. Si presentaste solicitud, tu situación depende del listado y del sorteo; los documentos publicados están abajo.');
  } else {
    partes.push('La ficha oficial no indica en qué fase está el procedimiento. Los documentos publicados abajo son la referencia.');
  }
  if (p.estado_obra) {
    partes.push(`Estado de la obra según la fuente: <strong>${esc(p.estado_obra.toLowerCase())}</strong>.`);
  }
  if (d.publicada && d.libres > 0 && ofrece(p.id)) {
    partes.push(`Hay <strong>${d.libres} viviendas marcadas como libres</strong>. Cuando quedan viviendas sin adjudicar, SOMACYL las arrienda por orden de solicitud; para saber cómo optar a ellas hay que preguntar directamente a <a href="mailto:tuyavivienda@somacyl.es">tuyavivienda@somacyl.es</a> o al 983 450 544.`);
  } else if (d.publicada && !ofrece(p.id)) {
    partes.push('Aunque la tabla oficial marque viviendas como libres, <strong>no están disponibles</strong>: el reparto ya se ha resuelto o está en marcha. Para preguntar por una vacante, el canal es <a href="mailto:tuyavivienda@somacyl.es">tuyavivienda@somacyl.es</a> o el 983 450 544.');
  } else if (d.publicada) {
    partes.push('Ahora mismo <strong>no hay ninguna vivienda marcada como libre</strong> en la tabla oficial. Si estás en lista de reserva, tu turno depende de que alguien renuncie: aquí verás el cambio el día que la fuente lo publique.');
  }
  partes.push('<strong>No tenemos ni podemos tener tu expediente.</strong> Esta web no sabe quién eres ni maneja datos de solicitantes: para consultar tu situación personal, el canal es SOMACYL.');
  return partes.map((t) => `<p>${t}</p>`).join('\n    ');
}

function documentoHtml(doc) {
  const nominal = doc.tipo === 'listado_nominal';
  return `<li>
        <a href="${esc(doc.url)}" rel="noopener nofollow">${esc(doc.titulo ?? 'Documento')}</a>
        <span class="pastilla pastilla--doc">${esc(nombreTipo(doc.tipo))}</span>
        ${nominal ? '<p class="fino">Contiene nombres de personas: lo enlazamos a la web oficial y no lo copiamos ni lo procesamos.</p>' : ''}
      </li>`;
}

function nombreTipo(tipo) {
  return {
    bocyl: 'BOCYL', bop: 'Boletín provincial', correccion: 'Corrección de errores',
    procedimiento: 'Procedimiento', tecnico: 'Documentación técnica',
    listado_nominal: 'Listado con datos personales', otro: 'Documento',
  }[tipo] ?? 'Documento';
}

/** Botón de «me interesa». Sin JS no estorba: va oculto hasta que el JS lo activa. */
function botonSeguir(id, tamano = '') {
  return `<button type="button" class="seguir${tamano ? ` seguir--${tamano}` : ''}" data-seguir="${esc(id)}" hidden
        aria-pressed="false">Me interesa</button>`;
}

function ultimosAvisos() {
  const ultimos = avisos.filter((a) => a.tipo !== 'plazo_sin_registrar').slice(0, 6);
  if (!ultimos.length) return '';
  return `<section class="seccion" id="novedades">
  <h2 class="seccion__titulo">${icono('campana')}Últimos movimientos</h2>
  <p class="novedades__resumen" data-resumen hidden></p>
  <ul class="docs">
    ${ultimos.map((a) => `<li data-fecha="${esc(a.fecha)}">
      <a href="${esc(rutaDe(a))}">${esc(a.titulo)}</a> <span class="pastilla pastilla--doc">${esc(a.fecha)}</span>
      <p class="fino">${esc(a.detalle ?? '')}</p>
    </li>`).join('\n    ')}
  </ul>
  <p class="fino"><a href="/avisos/">Todos los avisos y cómo enterarte a tiempo →</a></p>
</section>`;
}

function avisosDe(id) {
  const suyos = avisos.filter((a) => a.promocion_id === id && a.tipo !== 'plazo_sin_registrar').slice(0, 8);
  if (!suyos.length) return '';
  return `<section class="bloque">
    <h2>Qué ha pasado aquí</h2>
    <ul class="docs">
      ${suyos.map((a) => `<li><strong>${esc(a.fecha)}</strong> · ${esc(a.titulo)}
        <p class="fino">${esc(a.detalle ?? '')}</p></li>`).join('\n      ')}
    </ul>
  </section>`;
}

function rutaDe(a) {
  return a.url?.startsWith(SITIO) ? a.url.slice(SITIO.length) : (a.url ?? '/');
}

function paginaAvisos() {
  const vivos = plazosVivos();
  const sinFecha = PLAZOS.filter((z) => !z.fin);
  const cuerpo = `
<article class="prosa">
<h1>Que no se te pase el plazo</h1>
<p>El problema de esto no es entenderlo: es enterarte a tiempo. Las convocatorias salen en un boletín, los
   listados aparecen un martes cualquiera en una web y el plazo para alegar dura unos días. Por eso el proyecto
   mira las fichas oficiales <strong>todos los días</strong> y avisa cuando algo se mueve.</p>

<h2>Tres maneras de enterarte, ninguna te pide nada</h2>
<p>No hay registro, ni correo, ni cuenta. Aquí no sabemos quién eres y no queremos saberlo.</p>

<h3>1. Marcar lo que te interesa</h3>
<p>Dale a <em>Me interesa</em> en las promociones que sigues. La portada te abre con «Lo que sigues» y te marca
   las <strong>novedades desde la última vez que entraste</strong>. Se guarda en el almacenamiento de tu
   navegador, como una cookie: no viaja a ningún servidor y nadie —nosotros tampoco— puede saber qué sigues.
   Si cambias de móvil o borras los datos del navegador, se queda atrás. Es el precio de no pedirte datos, y nos
   parece que sale a cuenta.</p>

<h3>2. Calendario (lo más eficaz para los plazos)</h3>
<p>Suscribe tu calendario a <a href="/plazos.ics">plazos.ics</a> y cada plazo entra con avisos automáticos
   <strong>21, 14, 7, 3 y 1 días antes</strong>, más el propio día del cierre. Te avisa tu móvil, sin depender de
   que nosotros te mandemos nada. Cada promoción tiene el suyo en su ficha.</p>

<h3>3. RSS</h3>
<p><a href="/avisos.xml">Todos los avisos</a>, o el de una promoción concreta desde su ficha. Va bien para
   engancharlo a Telegram, a un lector o a lo que use la comunidad.</p>

<h2>De qué se avisa</h2>
<ul>
  <li><strong>Plazos que se acercan</strong>: recordatorios a 21, 14, 7, 3 y 1 días, y el día del cierre.</li>
  <li><strong>Convocatoria nueva</strong>: aparece un anuncio de BOCYL o del boletín provincial en la ficha.</li>
  <li><strong>Listado publicado</strong>: sale la lista de admitidos, la definitiva o la de adjudicatarios. Te
      decimos que existe y te llevamos a la web oficial; el listado no lo copiamos.</li>
  <li><strong>Se abre o se cierra el procedimiento</strong>.</li>
  <li><strong>Viviendas libres</strong>: cuando aparecen viviendas sin adjudicar (se alquilan por orden de
      solicitud) o cuando la lista se mueve porque se ocupan.</li>
</ul>

<h2>Los plazos salen del propio boletín</h2>
<p>Nadie los teclea a mano. Se leen los anuncios oficiales que enlaza cada promoción y se busca la regla tal
   cual está escrita —«un plazo máximo que concluirá a los quince días naturales contados desde el día siguiente
   a la publicación de este Acuerdo en el Boletín Oficial de la Provincia»— y se combina con la fecha en que se
   publicó ese boletín, que aparece en la cabecera de todas sus páginas. De ahí sale la fecha exacta.</p>
<p>En cada plazo puedes desplegar <em>«Lo que dice el documento»</em> y leer la frase literal de la que sale, con
   enlace al PDF oficial. Si el plazo cuelga de algo que aún no ha pasado —«diez días desde que se publique la
   lista provisional»— <strong>no nos inventamos una fecha</strong>: enseñamos la regla y ya está.</p>
<p>De los listados con nombres no se descarga nada, ni para esto: se enlazan y punto.</p>

${vivos.length ? `<h2>Plazos abiertos ahora</h2>${bloquePlazos(vivos)}` :
  '<h2>Ahora mismo no hay ningún plazo abierto</h2><p>Los que hay extraídos ya se han cerrado. Cuando salga una convocatoria nueva aparecerá aquí, en la portada y en los tres canales.</p>'}

${sinFecha.length ? `<h2>Plazos que dependen de lo que pase antes</h2>
<p>Están escritos en el boletín pero se cuentan desde un hecho que todavía no ha ocurrido, así que no tienen
   fecha. En cuanto ese hecho ocurra y quede publicado, el plazo aparecerá con su día.</p>
${bloquePlazos(sinFecha)}` : ''}

<h2>Cada cuánto</h2>
<p>Se comprueba una vez al día, así que un cambio puede tardar hasta 24 horas en aparecer. Para un plazo que
   cierra hoy no te fíes solo de esta web: por eso los recordatorios empiezan tres semanas antes.</p>
</article>`;
  return layout({
    titulo: 'Avisos',
    descripcion: 'Avisos de convocatorias, listados y plazos de la vivienda pública en Valladolid: calendario, RSS y seguimiento en tu propio navegador.',
    ruta: '/avisos/', cuerpo, activo: 'avisos',
  });
}

// ------------------------------------------------------------- sindicación ----

function feedRss(lista, titulo, ruta) {
  const items = lista.map((a) => `  <item>
    <title>${esc(a.titulo)}</title>
    <link>${esc(a.url ?? SITIO)}</link>
    <guid isPermaLink="false">${esc(a.id)}</guid>
    <pubDate>${new Date(`${a.fecha}T09:00:00Z`).toUTCString()}</pubDate>
    <description>${esc(`${a.detalle ?? ''}${a.enlace_documento ? ` Documento: ${a.enlace_documento}` : ''}`)}</description>
  </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${esc(titulo)}</title>
  <link>${SITIO}${ruta.replace(/avisos\.xml$/, '')}</link>
  <description>Avisos automáticos de una web vecinal. No es una comunicación oficial.</description>
  <language>es-ES</language>
  <lastBuildDate>${new Date(`${HOY}T09:00:00Z`).toUTCString()}</lastBuildDate>
${items}
</channel>
</rss>
`;
}

/**
 * Calendario iCalendar con un evento por plazo y alarmas a 21, 14, 7, 3 y 1
 * días. Es el canal más útil: avisa el móvil de cada cual, sin que tengamos que
 * saber quién es.
 */
function calendario(plazos) {
  const alarmas = [21, 14, 7, 3, 1].map((d) => `BEGIN:VALARM
TRIGGER:-P${d}D
ACTION:DISPLAY
DESCRIPTION:Faltan ${d} días para el cierre del plazo
END:VALARM`).join('\n');

  const eventos = plazos.filter((z) => z.fin).map((z) => {
    const fin = z.fin.replace(/-/g, '');
    const finExclusivo = new Date(Date.parse(`${z.fin}T00:00:00Z`) + 86400000).toISOString().slice(0, 10).replace(/-/g, '');
    return `BEGIN:VEVENT
UID:${z.promocion_id}-${z.tipo}-${fin}@vivienda-publica.aldeapucela.org
DTSTAMP:${HOY.replace(/-/g, '')}T090000Z
DTSTART;VALUE=DATE:${(z.inicio ?? z.fin).replace(/-/g, '')}
DTEND;VALUE=DATE:${finExclusivo}
SUMMARY:${ics(`${z.titulo ?? 'Plazo'} · ${nombrePromocion(z.promocion_id)}`)}
DESCRIPTION:${ics(`Termina el ${z.fin}${z.hora_limite ? ` a las ${z.hora_limite}` : ''}. Fuente: ${z.fuente_ref ?? z.fuente_url}. Ficha: ${SITIO}/promocion/${z.promocion_id}/`)}
URL:${SITIO}/promocion/${z.promocion_id}/
${alarmas}
END:VEVENT`;
  }).join('\n');

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Aldea Pucela//Vivienda//ES
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Plazos de vivienda pública (Valladolid)
X-WR-CALDESC:Plazos anotados por la comunidad a partir de los documentos oficiales
${eventos}${eventos ? '\n' : ''}END:VCALENDAR
`.replace(/\n/g, '\r\n');
}

/** Escapa según iCalendar (RFC 5545). */
function ics(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function paginaDatos() {
  const cuerpo = `
<article class="prosa">
<h1>Datos abiertos</h1>
<p>Todo lo que ves en esta web sale de estos ficheros, que puedes usar libremente citando la fuente
   (<a href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" rel="noopener">CC BY-SA 4.0</a>).
   Se actualizan solos cada día y se guarda el historial completo: de cada dato se puede saber cuándo cambió.</p>
<ul class="docs">
  <li><a href="/data/promociones.json">promociones.json</a> <span class="pastilla pastilla--doc">Índice</span>
      <p class="fino">Una entrada por promoción con su estado y el resumen de viviendas libres.</p></li>
  <li><a href="/data/historico.json">historico.json</a> <span class="pastilla pastilla--doc">Serie temporal</span>
      <p class="fino">Cuántas viviendas había libres cada día que hubo algún cambio.</p></li>
  <li><a href="/data/fuentes.json">fuentes.json</a> <span class="pastilla pastilla--doc">Trazabilidad</span>
      <p class="fino">Qué página o documento respalda cada dato, cuándo se leyó y con qué huella digital.</p></li>
  <li><a href="/data/promociones/">data/promociones/&lt;id&gt;.json</a> <span class="pastilla pastilla--doc">Detalle</span>
      <p class="fino">Ficha completa de cada promoción, vivienda a vivienda.</p></li>
  <li><a href="/data/contexto-municipios.json">contexto-municipios.json</a> <span class="pastilla pastilla--doc">Contexto</span>
      <p class="fino">Habitantes y parque de viviendas de cada municipio con promoción, con el año de cada dato y
         el enlace al conjunto de origen. Cruce de dos conjuntos del
         <a href="https://datosabiertos.jcyl.es" rel="noopener">Portal de Datos Abiertos de Castilla y León</a>
         (datos de la <strong>Junta de Castilla y León</strong>, CC BY 4.0) con nuestras promociones.</p></li>
</ul>
<h2>Lo que no vas a encontrar aquí</h2>
<p>Ningún dato personal: ni nombres, ni DNI, ni la posición de nadie en una lista. No es un descuido: es la regla
   del proyecto, y hay una comprobación automática que impide publicar nada que lo parezca.
   <a href="/privacidad/">Explicación completa</a>.</p>
<h2>Cómo se generan</h2>
<p>Una vez al día se leen las fichas públicas de <code>tuyavivienda.es</code> y los anuncios oficiales que
   enlazan, y de ahí se extraen solo hechos: cifras, estados, plazos y enlaces.
   <a href="/fuentes/">Aquí está el detalle de las fuentes</a>, y el programa que lo hace es libre y está
   <a href="https://github.com/aldeapucela/vivienda-publica-" rel="noopener">publicado en GitHub</a> para que
   cualquiera pueda revisarlo.</p>
</article>`;
  return layout({ titulo: 'Datos abiertos', descripcion: 'Ficheros JSON con las promociones de vivienda pública, su disponibilidad y la trazabilidad de cada dato.', ruta: '/datos/', cuerpo, activo: 'datos' });
}

function paginaDoc(rel, titulo, ruta) {
  const md = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  return layout({
    titulo, descripcion: `${titulo} · proyecto vecinal de seguimiento de la vivienda pública en Valladolid.`,
    ruta, cuerpo: `<article class="prosa">\n${markdown(md)}\n</article>`,
    activo: ruta === '/como-funciona/' ? 'como' : '',
  });
}

function pagina404() {
  return layout({
    titulo: 'Página no encontrada', descripcion: 'Esa página no existe.', ruta: '/404.html',
    cuerpo: '<article class="prosa"><h1>Aquí no hay nada</h1><p>Puede que la promoción haya cambiado de dirección. <a href="/">Vuelve al listado</a>.</p></article>',
  });
}

function sitemap() {
  const urls = ['/', '/como-funciona/', '/datos/', '/privacidad/', '/fuentes/',
    ...promociones.map((p) => `/promocion/${p.id}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITIO}${u}</loc><lastmod>${indice.actualizado}</lastmod></url>`).join('\n')}
</urlset>
`;
}

function matomo() {
  if (!MATOMO_SITE_ID) return '';
  return `<script>
  var _paq = window._paq = window._paq || [];
  _paq.push(['trackPageView']); _paq.push(['enableLinkTracking']);
  (function() { var u="//stats.aldeapucela.org/";
    _paq.push(['setTrackerUrl', u+'matomo.php']); _paq.push(['setSiteId', '${MATOMO_SITE_ID}']);
    var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
    g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s); })();
</script>
`;
}

// ------------------------------------------------- vista previa de 1 fichero ----

/**
 * Reúne todas las páginas en un único HTML autocontenido: los enlaces internos
 * pasan a `#/ruta/` y un router mínimo enseña la sección que toque. Sirve para
 * enseñar el sitio antes de tener dominio; el sitio de verdad son las páginas
 * separadas de dist/.
 */
function unaSolaPagina() {
  const css = fs.readFileSync(path.join(RAIZ, 'src/styles.css'), 'utf8');
  // En un fichero suelto no hay carpeta de imágenes: el isotipo va incrustado.
  const isotipo = `data:image/jpeg;base64,${fs.readFileSync(path.join(RAIZ, 'src/img/aldea-pucela.jpg')).toString('base64')}`;
  const filtros = fs.readFileSync(path.join(RAIZ, 'src/app.js'), 'utf8');
  const utiles = paginas.filter((p) => p.ruta !== '/404.html');

  const secciones = utiles.map((p) => `<section class="pagina" data-ruta="${esc(p.ruta)}" hidden>
${enlacesInternos(p.cuerpo)}
</section>`).join('\n');
  const conIsotipo = (html) => html.replace(/src="\/img\/aldea-pucela\.jpg"/g, `src="${isotipo}"`);

  return `<title>Vivienda Pucela</title>
<script>document.documentElement.className += ' con-js';</script>
<style>
${css}
.pagina[hidden] { display: none; }
.previo {
  background: var(--brand-100); color: var(--brand-700);
  padding: .6rem 0; font-size: .85rem; border-bottom: 1px solid var(--linea);
}
.previo p { margin: 0; }
</style>
<div class="previo"><div class="container"><p><strong>Vista previa.</strong> Todo el sitio en un solo fichero,
  con los datos leídos el ${esc(indice.actualizado)}. La web se publica en
  <code>${esc(SITIO.replace(/^https?:\/\//, ''))}</code>.</p></div></div>
<header class="topbar">
  <div class="container topbar__inner">
    ${conIsotipo(marca()).replace('href="/"', 'href="#/"')}
    <button class="menu-boton" type="button" aria-expanded="false" aria-controls="menu-principal">
      <svg class="menu-boton__icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path class="menu-boton__barras" d="M4 7h16M4 12h16M4 17h16"/>
        <path class="menu-boton__cruz" d="M6 6l12 12M18 6L6 18"/>
      </svg>
      <span>Menú</span>
    </button>
    <nav class="menu" id="menu-principal" aria-label="Menú principal">
      <a href="#/">Promociones</a>
      <a href="#/avisos/">Avisos y plazos</a>
      <a href="#/como-funciona/">Cómo funciona</a>
      <a href="#/datos/">Datos abiertos</a>
      <a href="#/fuentes/">Fuentes</a>
      <a href="#/privacidad/">Privacidad</a>
    </nav>
  </div>
</header>
<p class="rancio" id="rancio" data-comprobado="${esc(COMPROBADO)}" hidden></p>
<main id="contenido" class="container principal">
${secciones}
</main>
<footer class="pie">
  <div class="container pie__inner">
    ${conIsotipo(marca('pie')).replace('href="/"', 'href="#/"')}
    <div class="pie__texto">
      <p><strong>Esta web no es oficial.</strong> La hacen vecinas y vecinos de
        <a href="https://aldeapucela.org" rel="noopener">Aldea Pucela</a>, y ordena información que ya publica
        tuyavivienda.es (SOMACYL, Junta de Castilla y León). Para cualquier trámite, lo que vale es la web
        oficial y el boletín.</p>
      <p>Aquí no se publican datos personales de quienes solicitan o reciben una vivienda.</p>
    </div>
    <p class="fino">Contenido y datos con licencia CC BY-SA 4.0 · Código con licencia AGPL-3.0</p>
  </div>
</footer>
<script>
(function () {
  var secciones = [].slice.call(document.querySelectorAll('.pagina'));
  function pinta() {
    var ruta = location.hash.replace(/^#/, '') || '/';
    var elegida = secciones.filter(function (s) { return s.dataset.ruta === ruta; })[0] || secciones[0];
    secciones.forEach(function (s) { s.hidden = s !== elegida; });
    document.title = 'Vivienda Pucela';
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', pinta);
  pinta();
})();
${filtros}
</script>
`;
}

/**
 * `href="/x/"` → `href="#/x/"` (los externos se quedan igual). Los enlaces a
 * los JSON se quedan sin destino: en un fichero suelto no hay `data/`, así que
 * se muestran como nombres de fichero en vez de como enlaces rotos.
 */
function enlacesInternos(html) {
  return html
    .replace(/<a href="\/[^"]*\.(?:json|xml|ics)"[^>]*>([\s\S]*?)<\/a>/g, '<code>$1</code>')
    .replace(/<a href="\/data\/[^"]*"[^>]*>([\s\S]*?)<\/a>/g, '<code>$1</code>')
    .replace(/href="\/(?!\/)([^"]*)"/g, (_, resto) => `href="#/${resto}"`);
}

// -------------------------------------------------------------- markdown ----

/** Renderizador mínimo: encabezados, párrafos, listas, tablas, énfasis y enlaces. */
function markdown(md) {
  const lineas = md.split(/\r?\n/);
  const salida = [];
  let lista = null; let tabla = false; let parrafo = [];

  const cierraParrafo = () => { if (parrafo.length) { salida.push(`<p>${enLinea(parrafo.join(' '))}</p>`); parrafo = []; } };
  const cierraLista = () => { if (lista) { salida.push(`</${lista}>`); lista = null; } };
  const cierraTabla = () => { if (tabla) { salida.push('</tbody></table></div>'); tabla = false; } };
  const cierraTodo = () => { cierraParrafo(); cierraLista(); cierraTabla(); };

  for (const linea of lineas) {
    const l = linea.trimEnd();
    if (!l.trim()) { cierraTodo(); continue; }

    const enc = l.match(/^(#{1,4})\s+(.*)$/);
    if (enc) { cierraTodo(); const n = enc[1].length; salida.push(`<h${n}>${enLinea(enc[2])}</h${n}>`); continue; }

    if (/^[-*]\s+/.test(l)) {
      cierraParrafo(); cierraTabla();
      if (lista !== 'ul') { cierraLista(); salida.push('<ul>'); lista = 'ul'; }
      salida.push(`<li>${enLinea(l.replace(/^[-*]\s+/, ''))}</li>`); continue;
    }
    if (/^\d+[.)]\s+/.test(l)) {
      cierraParrafo(); cierraTabla();
      if (lista !== 'ol') { cierraLista(); salida.push('<ol>'); lista = 'ol'; }
      salida.push(`<li>${enLinea(l.replace(/^\d+[.)]\s+/, ''))}</li>`); continue;
    }
    // Un elemento de lista que sigue en la línea de abajo (sangrado) continúa
    // el mismo <li>: si no, se parte en dos y la negrita a caballo entre ambas
    // líneas sale con los asteriscos a la vista.
    if (lista && /^\s{2,}\S/.test(linea)) {
      const anterior = salida[salida.length - 1];
      if (anterior && anterior.endsWith('</li>')) {
        salida[salida.length - 1] = `${anterior.slice(0, -5)} ${enLinea(l.trim())}</li>`;
        continue;
      }
    }
    if (/^\|/.test(l)) {
      cierraParrafo(); cierraLista();
      const celdas = l.split('|').slice(1, -1).map((c) => c.trim());
      if (/^[-:\s|]+$/.test(l)) continue; // separador de cabecera
      if (!tabla) {
        salida.push('<div class="tabla-scroll"><table class="tabla"><thead><tr>');
        salida.push(celdas.map((c) => `<th scope="col">${enLinea(c)}</th>`).join(''));
        salida.push('</tr></thead><tbody>');
        tabla = true; continue;
      }
      salida.push(`<tr>${celdas.map((c) => `<td>${enLinea(c)}</td>`).join('')}</tr>`);
      continue;
    }
    if (/^>\s?/.test(l)) { cierraTodo(); salida.push(`<blockquote>${enLinea(l.replace(/^>\s?/, ''))}</blockquote>`); continue; }
    if (/^---+$/.test(l)) { cierraTodo(); salida.push('<hr>'); continue; }

    cierraLista(); cierraTabla();
    parrafo.push(l.trim());
  }
  cierraTodo();
  return salida.join('\n');
}

function enLinea(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}"${/^https?:/.test(u) ? ' rel="noopener"' : ''}>${t}</a>`);
}

// ------------------------------------------------------------- utilidades ----

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}


function suma(xs) { return xs.reduce((a, b) => a + (b ?? 0), 0); }

function json(rel, porDefecto) {
  const f = path.join(RAIZ, rel);
  if (!fs.existsSync(f)) {
    if (porDefecto !== undefined) return porDefecto;
    throw new Error(`falta ${rel}: ejecuta antes "npm run sync"`);
  }
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function escribe(rel, contenido) {
  const f = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, contenido);
}

function copia(origen, destino) {
  const d = path.join(DIST, destino);
  fs.mkdirSync(path.dirname(d), { recursive: true });
  fs.copyFileSync(path.join(RAIZ, origen), d);
}

function copiaDir(origen, destino) {
  fs.cpSync(path.join(RAIZ, origen), path.join(DIST, destino), { recursive: true });
}
