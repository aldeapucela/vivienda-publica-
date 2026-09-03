#!/usr/bin/env node
// Contexto del municipio: cuánta gente vive donde se construye la promoción y
// cuántas viviendas hay ya. Cruza dos conjuntos del Portal de Datos Abiertos de
// la Junta de Castilla y León con los municipios de data/promociones.json.
//
// LOS CSV NO SE DESCARGAN AQUÍ. La aplicación que los sirve (el SIE) está
// prohibida por el robots.txt de la Junta —«Disallow: /sie/»—, así que los dos
// ficheros se bajaron a mano una sola vez y viven en fuentes/jcyl/*.csv.gz con
// el sha256 de lo que sirvió la Junta. Este script no toca la red, salvo con
// --vigilar: entonces pide la FICHA del conjunto (esa ruta sí está permitida)
// solo para avisar de que hay datos nuevos y toca refrescar el CSV a mano.
// Población se actualiza una vez al año y viviendas cada diez: automatizar la
// descarga diaria de esto no compraría nada. Ver docs/fuentes.md.
//
//   node scripts/contexto.mjs             regenera data/contexto-municipios.json
//   node scripts/contexto.mjs --vigilar   además mira si la ficha ha cambiado
//   node scripts/contexto.mjs --self-test pruebas puras (sin red)

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parseRobots, robotsPermite, rutaDeUrl, sha256 } from './lib.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'AldeaPucelaVivienda/1.0 (+https://github.com/aldeapucela/vivienda-publica-; proyecto vecinal sin ánimo de lucro)';
const HOY = new Date().toISOString().slice(0, 10);
const DIAS_ENTRE_VIGILANCIAS = 28;   // la fuente se actualiza una vez al año
const DECADA = 10;

// Los dos conjuntos, tal y como los publica el portal. La cita a la Junta de
// Castilla y León no es cortesía: la licencia CC BY 4.0 la exige.
const CONJUNTOS = [
  {
    id: 'poblacion',
    titulo: 'Estadística de Población',
    ficha: 'https://datosabiertos.jcyl.es/web/jcyl/set/es/demografia/poblacion/1284801460210',
    descarga: 'https://datosabiertos.jcyl.es/web/jcyl/risp/es/demografia/poblacion/1284801460210.csv',
    variable: 'Población de derecho (total)',
    actualizacion: 'anual',
    licencia: 'CC BY 4.0',
    atribucion: 'Junta de Castilla y León',
    fichero: 'fuentes/jcyl/poblacion.csv.gz',
  },
  {
    id: 'viviendas',
    titulo: 'Estadística de Viviendas',
    ficha: 'https://datosabiertos.jcyl.es/web/jcyl/set/es/urbanismo-infraestructuras/viviendas/1284801692025',
    descarga: 'https://datosabiertos.jcyl.es/web/jcyl/risp/es/urbanismo-infraestructuras/viviendas/1284801692025.csv',
    variable: 'Viviendas (censo)',
    actualizacion: 'decenal',
    licencia: 'CC BY 4.0',
    atribucion: 'Junta de Castilla y León',
    fichero: 'fuentes/jcyl/viviendas.csv.gz',
  },
];

const args = process.argv.slice(2);

if (args.includes('--self-test')) {
  const fallos = selfTest();
  for (const f of fallos) console.error('✖', f);
  console.log(fallos.length ? `\n${fallos.length} fallos` : '✔ contexto: self-test en verde');
  process.exit(fallos.length ? 1 : 0);
}

main().catch((e) => { console.error('✖', e.message); process.exit(1); });

async function main() {
  const captura = leeJson('fuentes/jcyl/captura.json', null);
  if (!captura) throw new Error('falta fuentes/jcyl/captura.json: sin él no se sabe qué se leyó ni cuándo');

  const series = {};
  for (const c of CONJUNTOS) {
    const texto = leeCsvComprimido(c.fichero);
    const esperado = captura.conjuntos?.[c.id]?.sha256;
    const real = sha256(Buffer.from(texto, 'latin1'));
    // Si el fichero no es el que se capturó, se para: el dato publicado tiene
    // que poder comprobarse contra lo que sirvió la Junta.
    if (esperado && esperado !== real) {
      throw new Error(`${c.fichero} no coincide con el sha256 de captura.json (${real.slice(0, 16)}… ≠ ${esperado.slice(0, 16)}…)`);
    }
    series[c.id] = parseSie(texto);
    console.log(`  · ${c.id}: ${series[c.id].municipios.size} municipios · años ${series[c.id].anios[0]}-${series[c.id].anios.at(-1)}`);
  }

  compruebaCoherencia(series);

  const indice = leeJson('data/promociones.json', { promociones: [] });
  const localidades = [...new Set(indice.promociones.map((p) => p.localidad).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));

  const { municipios, sinDato } = contexto({ series, localidades });

  const previo = leeJson('data/contexto-municipios.json', null);
  const vigilancia = args.includes('--vigilar')
    ? await vigila(previo?.vigilancia)
    : (previo?.vigilancia ?? null);

  guardaJson('data/contexto-municipios.json', {
    comprobado: HOY,
    fuente: 'https://datosabiertos.jcyl.es',
    licencia_datos: 'Datos originales de la Junta de Castilla y León (CC BY 4.0). El cruce con las promociones, CC BY-SA 4.0 (Aldea Pucela).',
    atribucion: 'Junta de Castilla y León',
    conjuntos: CONJUNTOS.map((c) => ({
      id: c.id, titulo: c.titulo, ficha: c.ficha, descarga: c.descarga,
      variable: c.variable, actualizacion: c.actualizacion,
      licencia: c.licencia, atribucion: c.atribucion,
      anio_ultimo: series[c.id].anios.at(-1),
      fecha_captura: captura.conjuntos?.[c.id]?.fecha_captura ?? null,
      sha256: captura.conjuntos?.[c.id]?.sha256 ?? null,
      descargado_a_mano: true,
    })),
    vigilancia,
    municipios,
  });

  console.log(`\n✔ contexto de ${municipios.length} municipios (de ${localidades.length} con promoción)`);
  if (sinDato.length) {
    console.log(`⚠ sin datos en los CSV de la JCyL: ${sinDato.join(', ')}`);
    console.log('  esos municipios se quedan sin bloque de contexto (no se inventa nada).');
  }
  if (vigilancia?.hay_novedad) {
    console.log('\n⚠ la Junta ha tocado la ficha de algún conjunto: toca refrescar el CSV a mano.');
    for (const v of vigilancia.conjuntos.filter((x) => x.cambiada)) {
      console.log(`  · ${v.id}: la ficha decía ${v.fecha_ordenacion_referencia} cuando se bajó el CSV y ahora dice ${v.fecha_ordenacion} (${v.ficha})`);
    }
    console.log('  instrucciones en docs/fuentes.md, sección «Datos abiertos de la Junta».');
  }
}

// ------------------------------------------------------------------ csv ----

/**
 * Los CSV del SIE no son una tabla plana: el año va solo en la primera fila de
 * su bloque y las siguientes lo dejan vacío, hay filas de totales y el nombre
 * del municipio viene pegado a su código INE («47186 VALLADOLID»).
 *
 *   FECHA,MUNICIPIO,Sum,
 *   "1986","05001 ADANERO",         419,
 *   ,"05002 ADRADA (LA)",        1832,
 */
export function parseSie(texto) {
  const municipios = new Map();   // clave normalizada → { codigo_ine, nombre, valores: Map<año, valor> }
  const anios = new Set();
  let anio = null;
  let ilegibles = 0;

  for (const linea of texto.split(/\r?\n/)) {
    if (!linea.trim()) continue;
    const m = linea.match(/^(?:"([^"]*)")?,"(\d{5}) ([^"]+)",\s*(-?\d+)\s*,?\s*$/);
    if (!m) {
      // Cabeceras, filas de total de fila/columna y líneas de rótulo.
      if (/^(FECHA|"|,,|,"TOTAL")/.test(linea) || /^,+$/.test(linea)) continue;
      ilegibles++;
      continue;
    }
    const [, fecha, codigo, nombre, valor] = m;
    if (fecha) anio = /^\d{4}$/.test(fecha) ? Number(fecha) : null;
    if (anio == null) continue;    // bloque «TOTAL»: suma de todos los años
    anios.add(anio);
    const k = clave(nombre);
    if (!municipios.has(k)) municipios.set(k, { codigo_ine: codigo, nombre, valores: new Map() });
    municipios.get(k).valores.set(anio, Number(valor));
  }

  return { municipios, anios: [...anios].sort((a, b) => a - b), ilegibles };
}

/**
 * Compara nombres de municipio entre la ficha de SOMACYL y el CSV de la JCyL:
 * sin acentos, en mayúsculas y con el artículo delante («BARCO DE ÁVILA (EL)»
 * y «El Barco de Ávila» son el mismo pueblo).
 */
export function clave(nombre) {
  let s = String(nombre).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const art = s.match(/^(.*?)\s*\((EL|LA|LOS|LAS)\)$/);
  if (art) s = `${art[2]} ${art[1]}`;
  return s.replace(/[^A-Z\s]/g, ' ').split(/\s+/).filter(Boolean).join(' ');
}

// -------------------------------------------------------------- el cruce ----

/**
 * Para cada municipio con promoción: población del último año publicado, la
 * del mismo mes diez años antes para poder decir si crece o se vacía, y el
 * parque de viviendas del último censo. Lo que no está en el CSV no se
 * rellena: el municipio se queda fuera y su ficha no enseña el bloque.
 */
export function contexto({ series, localidades }) {
  const municipios = [];
  const sinDato = [];

  for (const localidad of localidades) {
    const k = clave(localidad);
    const pob = series.poblacion.municipios.get(k);
    const viv = series.viviendas.municipios.get(k);
    if (!pob && !viv) { sinDato.push(localidad); continue; }

    const entrada = {
      localidad,
      municipio_jcyl: (pob ?? viv).nombre,
      codigo_ine: (pob ?? viv).codigo_ine,
      poblacion: null,
      poblacion_referencia: null,
      variacion_decada_pct: null,
      viviendas: null,
    };

    if (pob) {
      const anio = [...pob.valores.keys()].sort((a, b) => a - b).at(-1);
      const habitantes = pob.valores.get(anio);
      entrada.poblacion = { anio, habitantes };
      const antes = pob.valores.get(anio - DECADA);
      if (antes) {
        entrada.poblacion_referencia = { anio: anio - DECADA, habitantes: antes };
        entrada.variacion_decada_pct = Math.round(((habitantes - antes) / antes) * 1000) / 10;
      }
    }

    if (viv) {
      const anio = [...viv.valores.keys()].sort((a, b) => a - b).at(-1);
      entrada.viviendas = { anio, total: viv.valores.get(anio) };
    }

    municipios.push(entrada);
  }

  return { municipios, sinDato };
}

/**
 * Si el CSV llega a medias o la Junta cambia su formato, mejor fallar a gritos
 * que publicar una web con la mitad de los municipios sin contexto.
 */
function compruebaCoherencia(series) {
  const problemas = [];
  if (series.poblacion.municipios.size < 2000) problemas.push(`solo ${series.poblacion.municipios.size} municipios en el CSV de población (Castilla y León tiene 2.248)`);
  if (series.poblacion.anios.length < 30) problemas.push(`solo ${series.poblacion.anios.length} años de población (la serie empieza en 1986)`);
  if (series.viviendas.anios.length < 3) problemas.push(`solo ${series.viviendas.anios.length} censos de viviendas`);
  for (const [id, s] of Object.entries(series)) {
    if (s.ilegibles > 50) problemas.push(`${s.ilegibles} líneas ilegibles en ${id}: ¿ha cambiado el formato del CSV?`);
  }
  if (problemas.length) {
    console.error('\n✖ Lo leído no cuadra, así que no se escribe nada:');
    for (const x of problemas) console.error(`  · ${x}`);
    process.exit(1);
  }
}

// ------------------------------------------------------------ vigilancia ----

/**
 * Mira la ficha del conjunto —no el CSV— para saber si la Junta ha publicado
 * datos nuevos. La ficha lleva un <meta name="fechaOrdenacion">: si cambia, hay
 * que volver a bajar el CSV a mano. Se comprueba una vez al mes como mucho.
 */
async function vigila(previa) {
  if (previa?.comprobado && dias(previa.comprobado, HOY) < DIAS_ENTRE_VIGILANCIAS) {
    console.log(`  vigilancia: se miró el ${previa.comprobado}, aún no toca (cada ${DIAS_ENTRE_VIGILANCIAS} días)`);
    return previa;
  }

  const robots = await pide('https://datosabiertos.jcyl.es/robots.txt');
  const reglas = parseRobots(robots, UA);
  const conjuntos = [];

  for (const c of CONJUNTOS) {
    if (!robotsPermite(reglas, rutaDeUrl(c.ficha))) {
      throw new Error(`robots.txt ya no permite ${c.ficha} — la vigilancia se detiene (invariante 3)`);
    }
    const html = await pide(c.ficha);
    const fecha = html.match(/<meta\s+name="fechaOrdenacion"\s+content="([^"]*)"/i)?.[1] ?? null;
    const anterior = previa?.conjuntos?.find((x) => x.id === c.id);
    const referencia = anterior?.fecha_ordenacion_referencia ?? fecha;
    conjuntos.push({
      id: c.id,
      ficha: c.ficha,
      fecha_ordenacion: fecha,
      // La fecha que tenía la ficha cuando se bajó el CSV que hay en el repo.
      fecha_ordenacion_referencia: referencia,
      cambiada: Boolean(fecha && referencia && fecha !== referencia),
    });
    await espera(2000);
  }

  return { comprobado: HOY, hay_novedad: conjuntos.some((c) => c.cambiada), conjuntos };
}

async function pide(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} al pedir ${url}`);
  return res.text();
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function dias(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

// -------------------------------------------------------------- ficheros ----

function leeCsvComprimido(rel) {
  const f = path.join(RAIZ, rel);
  if (!fs.existsSync(f)) throw new Error(`falta ${rel}: se descarga a mano una vez (ver docs/fuentes.md)`);
  // Los CSV del SIE vienen en ISO-8859-1, con eñes y acentos.
  return zlib.gunzipSync(fs.readFileSync(f)).toString('latin1');
}

function leeJson(rel, porDefecto) {
  const f = path.join(RAIZ, rel);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : porDefecto;
}

function guardaJson(rel, valor) {
  const f = path.join(RAIZ, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, `${JSON.stringify(valor, null, 2)}\n`);
}

// -------------------------------------------------------------- self test ----

export function selfTest() {
  const fallos = [];
  const ok = (c, m) => { if (!c) fallos.push(m); };

  // Nombres: acentos, artículo detrás y mayúsculas.
  ok(clave('El Barco de Ávila') === clave('BARCO DE AVILA (EL)'), 'artículo entre paréntesis');
  ok(clave('Peñaranda de Bracamonte') === 'PENARANDA DE BRACAMONTE', 'eñe y acentos');
  ok(clave('Valladolid') === 'VALLADOLID', 'nombre simple');
  ok(clave('Adrada (La)') === clave('ADRADA (LA)'), 'artículo en minúsculas');

  // El CSV tal y como lo sirve el SIE: año disperso, totales y rótulos.
  const csv = [
    '" Datos Básicos  - Población"',
    '"Datos de: INDICADOR=POBLACIÓN DE DERECHO (TOTAL)"',
    '"FAMILIA INDICADOR",,"INDICADORES DEMOGRÁFICOS",',
    ',,VALOR,',
    'FECHA,MUNICIPIO,Sum,',
    '"2015","47186 VALLADOLID",      306830,',
    ',"05021 BARCO DE ÁVILA (EL)",        2500,',
    ',"TOTAL",     2447519,',
    '"2025","47186 VALLADOLID",      298412,',
    ',"05021 BARCO DE ÁVILA (EL)",        2300,',
    ',"TOTAL",     2383139,',
    '"TOTAL","47186 VALLADOLID",      605242,',
  ].join('\n');

  const s = parseSie(csv);
  ok(s.anios.join(',') === '2015,2025', `años leídos: ${s.anios.join(',')}`);
  ok(s.municipios.size === 2, `municipios leídos: ${s.municipios.size}`);
  ok(s.ilegibles === 0, `líneas ilegibles: ${s.ilegibles}`);
  const vll = s.municipios.get('VALLADOLID');
  ok(vll?.codigo_ine === '47186', 'código INE');
  ok(vll?.valores.get(2025) === 298412, 'valor del último año');
  ok(vll?.valores.get(2015) === 306830, 'el año se arrastra hacia abajo');
  ok(!s.municipios.has('TOTAL'), 'la fila TOTAL no es un municipio');
  ok(vll?.valores.size === 2, 'el bloque TOTAL de años no cuenta como año');

  const viviendas = parseSie([
    'FECHA,MUNICIPIO,Sum,',
    '"2011","47186 VALLADOLID",      160000,',
    '"2021","47186 VALLADOLID",      165000,',
  ].join('\n'));

  const { municipios, sinDato } = contexto({
    series: { poblacion: s, viviendas },
    localidades: ['Valladolid', 'El Barco de Ávila', 'Cabrerizos'],
  });

  const c = municipios.find((x) => x.localidad === 'Valladolid');
  ok(c.poblacion.anio === 2025 && c.poblacion.habitantes === 298412, 'población del último año');
  ok(c.poblacion_referencia.anio === 2015, 'referencia a diez años');
  ok(c.variacion_decada_pct === -2.7, `variación de la década: ${c.variacion_decada_pct}`);
  ok(c.viviendas.anio === 2021 && c.viviendas.total === 165000, 'viviendas del último censo');
  ok(c.codigo_ine === '47186', 'código INE en el cruce');

  // Municipio que sí está en población pero no en el censo de viviendas.
  const barco = municipios.find((x) => x.localidad === 'El Barco de Ávila');
  ok(barco.viviendas === null, 'sin censo de viviendas se deja en null');
  ok(barco.poblacion.habitantes === 2300, 'población del municipio con artículo');

  // Municipio que no aparece en ningún CSV: se omite, no se inventa.
  ok(sinDato.join(',') === 'Cabrerizos', `municipios sin dato: ${sinDato.join(',')}`);
  ok(!municipios.some((x) => x.localidad === 'Cabrerizos'), 'el municipio sin dato no entra en el JSON');

  // Sin referencia a diez años no se calcula variación (no se estima).
  const corta = parseSie(['FECHA,MUNICIPIO,Sum,', '"2025","09059 BURGOS",      175000,'].join('\n'));
  const solo = contexto({ series: { poblacion: corta, viviendas }, localidades: ['Burgos'] }).municipios[0];
  ok(solo.variacion_decada_pct === null && solo.poblacion_referencia === null, 'sin serie de diez años, sin variación');

  return fallos;
}
