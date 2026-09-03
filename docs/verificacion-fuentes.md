# Verificación técnica de las fuentes

Nota interna del proyecto: **no se publica en la web**. Recoge la evidencia literal con la que se
tomaron las decisiones de ingesta, para que dentro de un año se sepa por qué está hecho así.
Comprobado el 13/08/2026 pidiendo los ficheros reales.

La versión para el público está en [`fuentes.md`](fuentes.md).

## robots.txt: al revés de lo que parecía

`https://tuyavivienda.es/robots.txt`, literal:

```
User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php

Sitemap: https://tuyavivienda.es/sitemap_index.xml
```

Es el `robots.txt` por defecto de WordPress: **permite pedir todas las páginas de contenido**.
`somacyl.es` publica exactamente el mismo.

`https://bocyl.jcyl.es/robots.txt` (67 KB, 1.346 líneas) empieza así:

```
User-agent: *

Disallow: /boletines/
Disallow: /html/
Disallow: /mhtml/
```

Es decir: **los PDF del boletín están fuera del alcance de cualquier proceso automático**. El resto
del fichero son miles de líneas que bloquean documentos concretos, uno a uno, con su fecha, lo que
suele corresponder a peticiones de retirada de indexación.

Consecuencia práctica, y es lo contrario de lo que suponía el plan de partida: la ingesta se apoya en
`tuyavivienda.es`, y de BOCYL solo se vigila el sumario por RSS. Los anuncios que se leen para sacar
los plazos son las copias alojadas en `tuyavivienda.es`, no las de `bocyl.jcyl.es`.

## Datos abiertos de la JCyL: por qué la descarga es como es

Comprobado el 03/09/2026 pidiendo los ficheros reales.

Las dos URL que el portal anuncia como CSV **no son ficheros**. Responden `302`:

```
GET https://datosabiertos.jcyl.es/web/jcyl/risp/es/demografia/poblacion/1284801460210.csv
→ 302 Location: http://www.jcyl.es/sie/v2/datosbasv2-c-descargas.html?2
```

(el conjunto de viviendas hace lo mismo, con `?23`). Y `https://www.jcyl.es/robots.txt` incluye
`Disallow: /sie/` para `User-agent: *`, así que el destino está excluido. Tampoco sirve la vía
moderna: la plataforma Opendatasoft del portal, `analisis.datosabiertos.jcyl.es`, tiene API pero su
`robots.txt` prohíbe `/api/` y `/explore/dataset/*/download` a todos menos a Googlebot.

Esa página de descargas es un SAS webEIS: no enlaza el fichero, lo pide con un formulario cuyos
campos rellena su propio JavaScript. El `action` es relativo (`../sas/broker/datos.csv` desde
`/sie/v2/`), así que el destino real es **`https://www.jcyl.es/sie/sas/broker/datos.csv`**, también
bajo `/sie/`. Los campos que hay que enviar, sacados de `inicializar()` y del `case` de cada
conjunto:

```
D=FECHA & D=COD_MUNICIPIO                       (filas)
AC=COD_ORDEN_FAMILIA & AC=COD_ORDEN_VARIABLE    (columnas)
A=VALOR_VARIABLE                                (variable de análisis)
MDDB=VARANU.MDDB_VARIABLES_ANUALES · METABASE=RPOSWEB · _SERVICE=saswebl
_PROGRAM=SASHELP.WEBEIS.OPRPT.SCL · CLASS=mddbpgm.jcyl.custom_webeisv2.class
SL=COD_ORDEN_VARIABLE:POBLACIÓN DE DERECHO (TOTAL)   (población, case 2)
SL=COD_ORDEN_VARIABLE:VIVIENDAS                      (viviendas, case 23)
```

Dos trampas que costaron un rato:

- **La página es ISO-8859-1 y el formulario también.** Si el cuerpo se envía en UTF-8, la aplicación
  no reconoce «POBLACIÓN DE DERECHO (TOTAL)» y devuelve una tabla vacía, no un error. De ahí que
  `scripts/contexto.mjs` codifique el cuerpo en latin-1 (`formulario()`, con su self-test).
- **Cuando la consulta falla, responde `200` con una página HTML**, no un código de error. Por eso se
  comprueba que lo devuelto empiece por CSV y que traiga los 2.248 municipios antes de sobreescribir
  nada.

El export es determinista: dos descargas del mismo día dan el mismo `sha256`
(`b5230c4a…` población, `58624b76…` viviendas), así que un redownload sin cambios no genera diff.

La decisión de descargar de `/sie/` pese al `robots.txt` la tomó el proyecto el 03/09/2026 y está
contada en la web, en `/fuentes/`. Limitada a estos dos ficheros: una petición mensual a la ficha del
conjunto y una descarga al año.

## Estructura de los CSV del SIE

```
" Datos Básicos  - Población"
"Datos de: INDICADOR=POBLACIÓN DE DERECHO (TOTAL)"
...
FECHA,MUNICIPIO,Sum,
"1986","05001 ADANERO",         419,
,"05002 ADRADA (LA)",        1832,
```

- El año va **solo en la primera fila de su bloque**; las demás lo dejan vacío y hay que arrastrarlo.
- El municipio viene como `«código INE NOMBRE»`, en mayúsculas y con el artículo detrás
  (`BARCO DE ÁVILA (EL)`), que es lo que hace falta normalizar para casarlo con la ficha de SOMACYL.
- Hay filas `TOTAL` por año **y** un bloque final con `FECHA=TOTAL` que suma todos los años: si no se
  descarta, Zamora sale con 2,4 millones de habitantes.
- Población: 1986-2025, 2.249 municipios. Viviendas: 1991, 2001, 2011 y 2021, 2.248 municipios.

## Endpoints verificados

- **Sitemap de promociones:** `https://tuyavivienda.es/post-sitemap.xml` — 27 fichas en toda Castilla
  y León (agosto de 2026), 7 en la provincia de Valladolid.
- **RSS de BOCYL:** `https://bocyl.jcyl.es/rss.do` — `text/xml` con el sumario del día y el enlace a
  cada disposición. Sirve para vigilar publicaciones nuevas sin tocar `/boletines/`.
  `https://bocyl.jcyl.es/rss` devuelve lo mismo.
- No existen `/sumario.do`, `/rss/ultimos.xml` ni `/rssBocyl.do`: responden HTTP 500.

## Estructura de una ficha de promoción

Comprobado en *59 viviendas en Los Viveros (Valladolid)*:

- Bloque **Información**: categoría, estado de la obra, número de viviendas, localidad y dirección.
- **Tabla de viviendas por portal**, con clases CSS estables (`vivienda-fila-datos`,
  `vivienda-fila-estado libre|proximamente|ocupada`, `vivienda-fila-hab`, `vivienda-fila-metros`,
  `vivienda-fila-precio`). Ojo: la leyenda repite esas clases fuera de las filas de datos y hay que
  cortarla, o contamina la última vivienda de cada portal.
- **Documentos oficiales** en desplegables (`toggle-heading` + primer PDF del bloque) y en enlaces
  destacados (`link_text`).
- Metadatos con `datePublished` / `dateModified` y `articleSection` (de ahí sale si el procedimiento
  está abierto o cerrado).

## De dónde sale la fecha de un plazo

Los boletines no dan fechas de cierre: dan reglas («quince días naturales contados desde el día
siguiente a la publicación de este Acuerdo en el BOP»). La fecha del hecho que dispara el plazo está
en la cabecera repetida de cada página del propio boletín:

- BOP: `Número 2026/55 BOLETÍN OFICIAL DE LA PROVINCIA DE VALLADOLID Viernes, 20 de marzo de 2026`
- BOCYL: `Núm. 51 Pág. 229 Lunes, 16 de marzo de 2026`

Se toma la fecha que más se repite en el documento (la de la cabecera) y no la de la firma, que
también aparece. Cuando la regla se lee en el propio boletín que la ancla, la fecha es exacta; si se
lee en el BOCYL y el ancla es el BOP, se busca el BOP gemelo dentro de los 60 días siguientes.

El texto de los PDF se extrae interpretando los operadores `TJ`/`Tj`: el BOP coloca cada letra por
separado con su interletraje, y sin tratar el kerning sale «P A RT I C UL A R E S».

## Condiciones de reutilización

El [aviso legal de TUYA Vivienda](https://tuyavivienda.es/wp-content/uploads/2026/05/Aviso-legal-TUYA-Vivienda.pdf)
(SOMACYL, CIF A47600754) obliga al usuario a:

> No reproducir, copiar, distribuir, comunicar públicamente, transformar o modificar los contenidos,
> a menos que se cuente con la preceptiva autorización del titular de los correspondientes derechos
> **o ello resulte legalmente permitido**.

Cómo se sitúa el proyecto frente a esa cláusula:

- **No se copian contenidos**: ni textos, ni fotos, ni planos, ni PDF. Se extraen datos de hecho y se
  enlaza siempre al original.
- SOMACYL es sector público y la información administrativa que publica entra en el ámbito de la Ley
  37/2007 de reutilización de la información del sector público y de la Ley 19/2013 de transparencia.
  Ese es el «legalmente permitido» de la propia cláusula.
- Aun así, no es un dictamen. De ahí la tarea de escribir a SOMACYL antes de difundir el proyecto
  (F6 en [`../PLAN.md`](../PLAN.md)).

## Preguntas abiertas

1. ¿Actualiza SOMACYL la tabla de viviendas con regularidad, o solo al cerrar cada procedimiento? Se
   sabrá con unas semanas de histórico.
2. Los desfases entre viviendas anunciadas y filas de la tabla (Villalón de Campos 19 vs 15; Valencia
   de Don Juan 28 vs 17): ¿fases distintas, tipologías no listadas o error de la ficha?
3. ¿Publica SOMACYL en algún sitio cuántas solicitudes recibió cada promoción? Es el dato que más
   ayudaría y no aparece en ninguna fuente pública encontrada.
4. ¿El BOP de Valladolid tiene RSS o API? Varias promociones publican ahí sus anuncios.
5. Días hábiles: hoy se descuentan sábados y domingos, no los festivos locales. ¿Merece la pena meter
   el calendario laboral?
