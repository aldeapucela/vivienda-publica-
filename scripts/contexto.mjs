#!/usr/bin/env node
// Contexto del municipio: cuánta gente vive donde se construye la promoción y
// cuántas viviendas hay ya. Cruza dos conjuntos del Portal de Datos Abiertos de
// la Junta de Castilla y León con los municipios de data/promociones.json.
//
// EXCEPCIÓN CONSCIENTE AL INVARIANTE 3 (robots), decidida por el proyecto y no
// un descuido: el robots.txt de la Junta excluye a los programas de la
// aplicación que sirve estos CSV («Disallow: /sie/»), y aun así los
// descargamos. El motivo: son dos conjuntos que la propia Junta publica en su
// Portal de Datos Abiertos con licencia CC BY 4.0, es decir, para que se
// reutilicen. Todo lo demás del proyecto sigue respetando robots al pie de la
// letra; esta excepción empieza y acaba aquí.
//
// A cambio, la descarga es lo más discreta que puede ser: NO se baja a diario.
// Primero se mira la ficha del conjunto (una petición) y solo si la Junta ha
// publicado datos nuevos —o si falta el fichero— se baja el CSV. Población se
// actualiza una vez al año y viviendas cada diez, así que en la práctica son
// dos peticiones al mes y una descarga al año. Ver docs/fuentes.md.
//
// Del fichero descargado se guarda el sha256, de modo que cualquiera puede
// comprobar que el dato publicado sale exactamente de lo que sirvió la Junta.
//
//   node scripts/contexto.mjs               regenera data/contexto-municipios.json
//   node scripts/contexto.mjs --actualizar  mira la ficha y baja el CSV si hay novedad
//   node scripts/contexto.mjs --forzar      baja el CSV pase lo que pase
//   node scripts/contexto.mjs --self-test   pruebas puras (sin red)

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { sha256 } from './lib.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'AldeaPucelaVivienda/1.0 (+https://github.com/aldeapucela/vivienda-publica-; proyecto vecinal sin ánimo de lucro)';
const HOY = new Date().toISOString().slice(0, 10);
const DIAS_ENTRE_VIGILANCIAS = 28;   // la fuente se actualiza una vez al año
const PAUSA_MS = 2000;               // una petición cada 2 s, como con el resto de fuentes

// La aplicación del SIE no sirve un fichero: monta la consulta con un
// formulario y la devuelve en CSV. Estos son los campos que envía ese
// formulario para cada uno de los dos conjuntos, tal cual (es un SAS webEIS de
// hace veinte años; los nombres son suyos, no nuestros).
const BROKER = 'https://www.jcyl.es/sie/sas/broker/datos.csv';
const CONSULTA_COMUN = [
  ['D', 'FECHA'], ['D', 'COD_MUNICIPIO'],
  ['AC', 'COD_ORDEN_FAMILIA'], ['AC', 'COD_ORDEN_VARIABLE'],
  ['A', 'VALOR_VARIABLE'],
  ['SPDSHT', 'X'], ['_SERVICE', 'saswebl'], ['_DEBUG', '0'],
  ['MDDB', 'VARANU.MDDB_VARIABLES_ANUALES'], ['METABASE', 'RPOSWEB'],
  ['SSL', '3'], ['ST', '1'], ['SH', '3'], ['SW', '15'], ['DP', '1'],
  ['CSS', '../v2/tablasv2.css'], ['CSST', '../css/default.css'],
  ['_PROGRAM', 'SASHELP.WEBEIS.OPRPT.SCL'], ['_SAVEAS', 'datos.csv'],
  ['VMDOFF', 'y'], ['CLASS', 'mddbpgm.jcyl.custom_webeisv2.class'],
  ['DC', '1'], ['ACB', '0'], ['S', 'SUM'],
];
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
    consulta: [['DT', ' Datos Básicos  - Población '], ['SL', 'COD_ORDEN_VARIABLE:POBLACIÓN DE DERECHO (TOTAL)']],
    minimos: { municipios: 2000, anios: 30 },
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
    consulta: [['DT', ' Datos Básicos  - Viviendas '], ['SL', 'COD_ORDEN_VARIABLE:VIVIENDAS']],
    minimos: { municipios: 2000, anios: 3 },
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
  const forzar = args.includes('--forzar');
  const captura = leeJson('fuentes/jcyl/captura.json', { conjuntos: {} });
  const previo = leeJson('data/contexto-municipios.json', null);
  let vigilancia = previo?.vigilancia ?? null;

  // Mirar la ficha y, solo si hay novedad, bajar el CSV.
  if (args.includes('--actualizar') || forzar) {
    vigilancia = await vigila(vigilancia, forzar);
    await actualizaCsv({ vigilancia, captura, forzar });
  }

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

  guardaJson('data/contexto-municipios.json', {
    // El día que se miró la fuente, no el día que se recalculó el cruce: esto
    // se mira una vez al mes, así que poner hoy sería faltar a la verdad (y
    // haría cambiar el fichero a diario sin que nadie haya publicado nada).
    comprobado: vigilancia?.comprobado ?? captura.conjuntos?.poblacion?.fecha_captura ?? HOY,
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
    // No debería pasar: si la ficha cambió, el CSV se acaba de bajar. Si sigue
    // marcado, es que la descarga no se hizo (se ejecutó sin --actualizar).
    console.log('\n⚠ la ficha de algún conjunto ha cambiado y el CSV del repositorio es el viejo.');
    for (const v of vigilancia.conjuntos.filter((x) => x.cambiada)) {
      console.log(`  · ${v.id}: la ficha decía ${v.fecha_ordenacion_referencia} cuando se bajó el CSV y ahora dice ${v.fecha_ordenacion} (${v.ficha})`);
    }
    console.log('  ejecuta «node scripts/contexto.mjs --actualizar».');
  }
}

// ------------------------------------------------------------- descarga ----

/**
 * ¿Hay que bajar el CSV? Solo si falta, si la Junta ha publicado datos nuevos
 * (lo dice la ficha) o si se pide a mano. Bajarlo a diario sería maleducado y
 * no cambiaría un solo número: la fuente se actualiza una vez al año.
 */
export function tocaDescargar({ existe, cambiada, forzar }) {
  if (forzar) return 'se ha pedido con --forzar';
  if (!existe) return 'no está en el repositorio';
  if (cambiada) return 'la Junta ha publicado datos nuevos';
  return null;
}

async function actualizaCsv({ vigilancia, captura, forzar }) {
  for (const c of CONJUNTOS) {
    const estado = vigilancia?.conjuntos?.find((x) => x.id === c.id);
    const motivo = tocaDescargar({
      existe: fs.existsSync(path.join(RAIZ, c.fichero)),
      cambiada: Boolean(estado?.cambiada),
      forzar,
    });
    if (!motivo) {
      console.log(`  · ${c.id}: el CSV del repositorio está al día`);
      continue;
    }

    console.log(`  · ${c.id}: se descarga (${motivo})`);
    await espera(PAUSA_MS);
    const csv = await pideCsv(c);
    const texto = csv.toString('latin1');

    // Nada se sobreescribe hasta comprobar que lo descargado es un CSV
    // completo. Si la Junta cambia su formato, es mejor quedarse con el
    // fichero viejo y fallar a gritos que publicar una web a medias.
    const leido = parseSie(texto);
    const problemas = incumple(c, leido);
    if (problemas.length) {
      throw new Error(`el CSV descargado de ${c.id} no cuadra (${problemas.join('; ')}): se conserva el anterior`);
    }

    fs.writeFileSync(path.join(RAIZ, c.fichero), zlib.gzipSync(csv, { level: 9 }));
    captura.conjuntos[c.id] = {
      sha256: sha256(csv),
      bytes: csv.length,
      fecha_captura: HOY,
    };
    // La ficha que traía este CSV pasa a ser la referencia: así el próximo día
    // no se vuelve a descargar por el mismo cambio.
    if (estado) {
      estado.fecha_ordenacion_referencia = estado.fecha_ordenacion;
      estado.cambiada = false;
    }
    console.log(`    ${miles(csv.length)} bytes · ${leido.municipios.size} municipios · sha256 ${captura.conjuntos[c.id].sha256.slice(0, 16)}…`);
  }

  if (vigilancia) vigilancia.hay_novedad = vigilancia.conjuntos.some((x) => x.cambiada);
  guardaJson('fuentes/jcyl/captura.json', {
    _nota: 'Qué CSV del Portal de Datos Abiertos de la JCyL hay en este directorio, cuándo se bajó y con qué huella. El sha256 es el del CSV SIN comprimir, tal y como lo sirvió la Junta: «gunzip -c fichero.csv.gz | shasum -a 256» y compara. Lo mantiene scripts/contexto.mjs.',
    conjuntos: captura.conjuntos,
  });
}

/**
 * Pide el CSV a la aplicación del SIE. Su formulario es ISO-8859-1, así que el
 * cuerpo va codificado en latin-1: si se envía en UTF-8, no encuentra la
 * variable «POBLACIÓN DE DERECHO (TOTAL)» y devuelve una tabla vacía.
 */
async function pideCsv(c) {
  const res = await fetch(BROKER, {
    method: 'POST',
    headers: {
      'user-agent': UA,
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'text/csv,*/*',
    },
    body: formulario([...CONSULTA_COMUN, ...c.consulta]),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al pedir el CSV de ${c.id}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Cuando la consulta falla, la aplicación responde 200 con una página HTML.
  if (!buf.length || /^\s*<(!doctype|html)/i.test(buf.subarray(0, 200).toString('latin1'))) {
    throw new Error(`la aplicación del SIE no ha devuelto un CSV para ${c.id} (¿ha cambiado el formulario?)`);
  }
  return buf;
}

/** Cuerpo de formulario en latin-1, con los campos repetidos que espera el SIE. */
export function formulario(pares) {
  const esc = (v) => [...Buffer.from(String(v), 'latin1')]
    .map((b) => {
      const ch = String.fromCharCode(b);
      if (/[A-Za-z0-9*\-._]/.test(ch)) return ch;
      if (ch === ' ') return '+';
      return `%${b.toString(16).toUpperCase().padStart(2, '0')}`;
    })
    .join('');
  return pares.map(([k, v]) => `${esc(k)}=${esc(v)}`).join('&');
}

/** Los mínimos de cordura de un conjunto, para el CSV recién leído. */
function incumple(c, leido) {
  const problemas = [];
  if (leido.municipios.size < c.minimos.municipios) problemas.push(`${leido.municipios.size} municipios, esperábamos ${c.minimos.municipios}`);
  if (leido.anios.length < c.minimos.anios) problemas.push(`${leido.anios.length} años, esperábamos ${c.minimos.anios}`);
  if (leido.ilegibles > 50) problemas.push(`${leido.ilegibles} líneas ilegibles`);
  return problemas;
}

const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

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
  for (const c of CONJUNTOS) {
    for (const x of incumple(c, series[c.id])) problemas.push(`${c.id}: ${x}`);
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
 * datos nuevos. La ficha lleva un <meta name="fechaOrdenacion">: si cambia, se
 * baja el CSV otra vez. Se comprueba una vez al mes como mucho: la fuente se
 * actualiza una vez al año y no hace falta molestarla más.
 */
async function vigila(previa, forzar = false) {
  if (!forzar && previa?.comprobado && dias(previa.comprobado, HOY) < DIAS_ENTRE_VIGILANCIAS) {
    console.log(`  vigilancia: se miró el ${previa.comprobado}, aún no toca (cada ${DIAS_ENTRE_VIGILANCIAS} días)`);
    return previa;
  }

  const conjuntos = [];
  for (const c of CONJUNTOS) {
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
    await espera(PAUSA_MS);
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

  // Cuándo se baja el CSV y cuándo no se molesta a la fuente.
  ok(tocaDescargar({ existe: true, cambiada: false, forzar: false }) === null, 'sin novedad no se descarga');
  ok(tocaDescargar({ existe: false, cambiada: false, forzar: false }), 'si falta el fichero, se descarga');
  ok(tocaDescargar({ existe: true, cambiada: true, forzar: false }), 'si la Junta publica datos nuevos, se descarga');
  ok(tocaDescargar({ existe: true, cambiada: false, forzar: true }), '--forzar descarga siempre');

  // El formulario del SIE es ISO-8859-1: la Ó va como %D3, no como %C3%93.
  const cuerpo = formulario([['SL', 'COD_ORDEN_VARIABLE:POBLACIÓN DE DERECHO (TOTAL)'], ['D', 'FECHA']]);
  ok(cuerpo.includes('POBLACI%D3N'), `acentos en latin-1: ${cuerpo.slice(0, 40)}`);
  ok(!cuerpo.includes('%C3%93'), 'no se cuela UTF-8 en el formulario');
  ok(cuerpo.includes('DE+DERECHO'), 'los espacios van como +');
  ok(cuerpo.includes('%3A'), 'los dos puntos van escapados');
  ok(cuerpo.endsWith('&D=FECHA'), 'los campos repetidos se concatenan');

  // Sin referencia a diez años no se calcula variación (no se estima).
  const corta = parseSie(['FECHA,MUNICIPIO,Sum,', '"2025","09059 BURGOS",      175000,'].join('\n'));
  const solo = contexto({ series: { poblacion: corta, viviendas }, localidades: ['Burgos'] }).municipios[0];
  ok(solo.variacion_decada_pct === null && solo.poblacion_referencia === null, 'sin serie de diez años, sin variación');

  return fallos;
}
