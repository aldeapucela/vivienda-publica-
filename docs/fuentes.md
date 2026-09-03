# De dónde salen los datos

Aquí no hay nada de cosecha propia. Todo lo que ves sale de fuentes oficiales, y cada dato lleva el
enlace al documento del que se ha sacado. Última comprobación de las fuentes: **13 de agosto de 2026**.

## Las fuentes

| Fuente | Qué se saca de ahí |
|---|---|
| **tuyavivienda.es** (SOMACYL) | La ficha de cada promoción: número de viviendas, dirección, estado de la obra, la tabla con el estado de cada vivienda —libre, próximamente u ocupada—, su superficie y su renta, y los enlaces a los documentos oficiales. |
| **Boletín Oficial de la Provincia y BOCYL** | Las convocatorias y sus plazos. Se leen los anuncios y se enlazan siempre. |
| **somacyl.es** | La sociedad pública que promueve las viviendas: quién es y cómo contactar con ella. |
| **datosabiertos.jcyl.es** (Portal de Datos Abiertos de la Junta de Castilla y León) | El contexto del municipio donde cae cada promoción: cuántos habitantes tiene y cuántas viviendas hay ya. Dos conjuntos: *Estadística de Población* (anual, desde 1986) y *Estadística de Viviendas* (censos de 1991, 2001, 2011 y 2021). |

## Qué se hace exactamente con ellas

Una vez al día se leen las 27 fichas de promoción publicadas (7 en la provincia de Valladolid) y se
anota lo que ha cambiado. De cada una se guardan solo **hechos**: cuántas viviendas hay, cuáles están
libres, cuánto miden, qué renta tienen, en qué fase va el procedimiento y qué documentos se han
publicado.

De los anuncios oficiales que enlaza cada promoción se sacan además **los hitos del procedimiento**:
que se ha celebrado el sorteo, que se ha aprobado la lista definitiva de adjudicatarios y con qué
fecha. Solo cuenta lo que el boletín declara como hecho: las convocatorias describen todo el
procedimiento en futuro («se procederá a aprobar la lista…»), y eso no significa que ya haya pasado.

También se leen esos mismos anuncios para sacar los plazos. La fecha no
se estima: se busca la regla tal y como está escrita en el documento…

> «Los interesados dispondrán de un plazo máximo para presentar sus solicitudes […] que concluirá a
> los quince días naturales, contados desde el día siguiente a la publicación de este Acuerdo en el
> Boletín Oficial de la Provincia de Valladolid.»

…y se combina con la fecha en que se publicó ese boletín, que aparece en la cabecera de todas sus
páginas. En cada plazo puedes desplegar la frase literal de la que sale. Si un plazo se cuenta desde
algo que todavía no ha ocurrido, no se inventa una fecha: se enseña la regla y se espera.

**Los listados de admitidos y adjudicatarios llevan nombres de personas.** Esos documentos se enlazan
a la web oficial y no se descargan, no se copian y no se leen nunca. [Por qué](/privacidad/).

## Datos abiertos de la Junta

En cada ficha de promoción hay un bloque que dice cuánta gente vive en ese municipio, cuánto ha
cambiado en diez años y cuántas viviendas hay ya construidas. No es adorno: diez viviendas nuevas no
significan lo mismo en un pueblo que crece que en uno que ha perdido un 14 % de sus vecinos.

Esos dos datos salen del **Portal de Datos Abiertos de Castilla y León**:

| Conjunto | Qué se usa | Cada cuánto cambia |
|---|---|---|
| [Estadística de Población](https://datosabiertos.jcyl.es/web/jcyl/set/es/demografia/poblacion/1284801460210) | «Población de derecho (total)» por municipio y año: el último año publicado y el de diez años antes | Una vez al año |
| [Estadística de Viviendas](https://datosabiertos.jcyl.es/web/jcyl/set/es/urbanismo-infraestructuras/viviendas/1284801692025) | Número de viviendas por municipio en el último censo | Cada diez años (censo) |

Los datos son de la **Junta de Castilla y León** y se publican con licencia
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es), que obliga a citarla: por eso la
cita aparece en cada bloque, en [datos abiertos](/datos/) y en el propio fichero que generamos.

### Cómo se piden estos dos ficheros, y una excepción que preferimos contar

Aquí hacemos una excepción a nuestra propia norma, y es mejor decirlo que esconderlo. La aplicación
de la Junta que sirve estos dos CSV pide a los programas automáticos que no entren (su fichero de
reglas dice `Disallow: /sie/`), y aun así el programa los descarga. Lo hacemos porque son dos
conjuntos que la propia Junta publica en su Portal de Datos Abiertos con una licencia que existe
para que se reutilicen, y porque la alternativa —copiar los números a mano— sería peor para
cualquiera que quiera comprobarlos. **Con el resto de las fuentes esa norma se respeta al pie de la
letra.** Si desde la Junta preferís que no lo hagamos, se quita el mismo día: escribid a
[Aldea Pucela](https://aldeapucela.org).

Y se pide con toda la discreción posible:

- **No se descarga a diario.** Una vez al mes el programa mira la **ficha** del conjunto (una
  petición) para ver si la Junta ha publicado datos nuevos. Solo entonces baja el CSV. Como la
  población se actualiza una vez al año y las viviendas cada diez, en la práctica son dos peticiones
  al mes y una descarga al año.
- Se identifica con su nombre y un enlace a este proyecto, y espera dos segundos entre peticiones.
- Del fichero que baja se guarda la huella digital (`sha256`) en `fuentes/jcyl/captura.json`, y el
  CSV se queda en `fuentes/jcyl/`. Así cualquiera puede descomprimirlo y comprobar que el dato
  publicado sale exactamente de lo que sirvió la Junta, sin tener que volver a pedírselo a ella.
- Si lo descargado no es un CSV completo —la Junta cambia su formato, la aplicación devuelve un
  error—, se conserva el fichero anterior y la actualización falla a la vista en vez de publicar una
  web a medias.

Si un municipio con promoción no aparece en los ficheros de la Junta, su ficha se queda sin ese
bloque. Preferimos un hueco a un dato aproximado.

## Cómo se piden las páginas

Con educación, que la fuente es de todos:

- Una petición cada dos segundos, una vez al día. Son 27 páginas: menos carga que una persona
  navegando.
- Cada documento oficial se lee una sola vez; después ya no se vuelve a pedir.
- El programa se identifica al pedir cada página y deja un enlace a este proyecto, por si desde
  SOMACYL quieren decirnos algo.
- Antes de cada tanda se comprueba lo que la propia fuente permite a los programas automáticos (el
  fichero de reglas que publica toda web para eso). Si alguna página deja de estar permitida, el
  proceso se para solo. La única excepción, y está explicada arriba, son los dos ficheros de datos
  abiertos de la Junta.

## Y si algo no cuadra

Puede pasar: la fuente cambia su web, un dato se lee mal, un plazo se calcula regular. Todo lo
publicado lleva el enlace al documento original precisamente para poder comprobarlo. **Si algo no
coincide, manda el documento oficial y el error es nuestro**: avísanos en
[Aldea Pucela](https://aldeapucela.org) y se corrige.

Tres cosas que ya sabemos que no cuadran, y que preferimos dejar a la vista en vez de disimularlas:

- **La tabla de viviendas no se actualiza al ritmo del procedimiento.** En *Los Viveros* seguía
  marcando las 59 viviendas como «libres» dos meses después de que se aprobara la lista definitiva de
  adjudicatarios y mientras ya se entregaban llaves. Por eso el estado del reparto se toma del
  **boletín oficial**, no de esa tabla: cuando consta que la adjudicación está resuelta, la web lo
  dice y deja de contar esas viviendas como disponibles, aunque la tabla siga diciendo otra cosa.
- En **Villalón de Campos** la ficha anuncia 19 viviendas y su tabla detalla 15. En **Valencia de Don
  Juan**, 28 anunciadas y 17 en la tabla. No sabemos por qué; se muestra tal cual lo publica la fuente.
- Cuando un plazo se cuenta en días hábiles, aquí se descuentan sábados y domingos, pero no los
  festivos locales. En esos casos la web lo advierte: comprueba el documento.

## Lo que nos gustaría poder contar y no podemos

**Cuánta gente pide cada promoción.** Es la pregunta que más ayudaría —saber si eres uno entre
cincuenta o uno entre mil— y no aparece en ninguna fuente pública. Lo estamos pidiendo por escrito a
SOMACYL, al amparo de las leyes de transparencia. Si lo publican, aparecerá aquí.

## Reutilizar estos datos

Los ficheros están publicados en abierto, en formatos estándar, y se pueden usar citando la fuente:
[datos abiertos](/datos/). Son datos de hecho extraídos de información pública, y siempre se enlaza
al documento original en vez de copiar textos, imágenes o documentos.

Una parte no es nuestra y tiene su propia licencia: la población y el número de viviendas por
municipio son de la **Junta de Castilla y León** ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es)),
del Portal de Datos Abiertos de Castilla y León. Si reutilizas `contexto-municipios.json`, cita a la
Junta además de a nosotros.
