# Auditoría de seguridad, scraping y carga de Convex

Fecha: 29 de septiembre de 2026. Proyecto: Eventos SimCodec.

## Conclusión basada en producción

El mecanismo de carga más fuerte observado es la sincronización RSS: acumula miles de entradas en una sola llamada a `events:saveEvents`, realiza una o dos búsquedas por entrada y vuelve a escribir datos existentes. Los logs de producción muestran dos advertencias por acercarse al límite de operaciones de lectura de una transacción. Las ejecuciones observadas terminaron sin error; no se observó todavía un rechazo por superar el límite.

La última ejecución RSS registrada usa 3.812 operaciones de lectura de un límite de 4.096, aproximadamente el 93,1%. Quedan 284 operaciones de margen. Una entrada puede generar dos búsquedas de índices, por lo que unas 142 entradas adicionales podrían consumir ese margen si mantienen ese patrón. Es una estimación del mecanismo, no una medición de la próxima ejecución.

El almacenamiento total y la cuota contratada no se obtuvieron. El consumo de I/O de los logs no equivale al espacio ocupado por las tablas. Tampoco se observó una llamada maliciosa en la muestra: las acciones registradas provienen de cron jobs.

## Alcance y evidencias

Se revisaron las funciones Convex, proveedores, esquema, cron jobs, rutas Astro, cliente HTTP, filtros, paginación, enlaces, JSON-LD, servicios antiguos, configuración y lockfile. Se ejecutó `bun audit --json` contra el registro npm y se capturaron logs mediante `convex logs --prod --history 50 --success --jsonl`. También se consultaron `convex function-spec --prod` e `insights --prod --details --json`.

La CLI devolvió 19 eventos disponibles: 18 ejecuciones completadas y un evento de error de un proveedor. La ventana va del 28 de septiembre a las 22:57 UTC al 29 de septiembre a las 16:58 UTC. No es un export completo de tráfico histórico. No contiene llamadas de las páginas públicas en esa ventana, por lo que no permite medir su carga actual.

Los datos estructurados están en [convex-production-evidence-2026-09-29.json](./convex-production-evidence-2026-09-29.json). Se omiten credenciales y datos de eventos. No se ejecutaron scrapers manualmente, migraciones ni borrados. Solo se añadieron este informe y su evidencia. La API de Insights devolvió una lista vacía para sus últimas 72 horas; eso no elimina las advertencias concretas que aparecen en los logs capturados.

### Mediciones de producción

| Ejecución | Lecturas de documentos | Escrituras de documentos | Bytes leídos | Bytes escritos | Filas de índices escritas |
| --- | ---: | ---: | ---: | ---: | ---: |
| RSS, 29/09 04:57 UTC | 3.750 | 1.873 | 6.164.076 | 4.917.817 | 16.829 |
| RSS, 29/09 16:58 UTC | 3.783 | 1.893 | 6.196.482 | 4.954.953 | 17.009 |
| APIs, cada una de cuatro ejecuciones | 80 | 41 | 69.200 | 57.060 | 362 |
| Scraping web, una ejecución | 12 | 8 | 12.393 | 11.773 | 58 |
| Consulta para validar enlaces | 5.121 | 0 | 7.270.304 | 0 | 0 |

Las escrituras incluyen inserciones y actualizaciones, además del registro del cron. **1.893 escrituras no significa 1.893 eventos nuevos ni necesariamente 1.893 eventos únicos.**

La muestra suma 19.920.643 bytes leídos y 10.114.114 bytes escritos. Las dos mutaciones RSS concentran 22.233.328 bytes: el 74,0% del I/O de base de datos registrado. La acción RSS tarda entre 37,19 y 40,38 segundos; la validación de enlaces tarda 210,34 segundos.

Las advertencias reportan 3.771 y 3.812 operaciones de lectura. Este límite de 4.096 corresponde a rangos de índices/operaciones de consulta, no al número máximo de documentos examinados. Los límites actuales también incluyen 16 MiB de lectura y 32.000 documentos examinados por transacción. [Límites oficiales de Convex](https://docs.convex.dev/production/state/limits).

## Hallazgos y acciones recomendadas

### 1. Alto: importación RSS sin límite por transacción

Evidencia: `convex/actions.ts:121`, `convex/events.ts:60`, `convex/events.ts:65`.

La acción envía todo `eventsToSave` a una mutación. `saveEvents` ejecuta una búsqueda por `externalId` y, cuando no encuentra coincidencia, otra por `registrationUrl`. El tamaño del trabajo depende de los feeds; no hay tope ni división por lotes. Los logs demuestran que esta ruta se aproxima al límite de lectura.

Acción: deduplicar el lote antes de acceder a la BD y dividirlo en transacciones acotadas, por ejemplo de 100 entradas. Ajustar el tamaño con las métricas reales de transacción. Los lotes reducen el pico de trabajo por transacción; comparar contenido reduce el I/O total. [Escrituras y límites de transacción](https://docs.convex.dev/database/writing-data).

### 2. Alto: eventos existentes se actualizan en cada extracción

Evidencia: `convex/events.ts:85`; `updatedAt: now` en Devpost, Coursera, Luma, Eventbrite y GenericRssProvider.

`updatedAt` representa el momento local del scraping. Como aumenta en cada ejecución, la condición de actualización acepta eventos aunque su contenido no haya cambiado. RSS y Coursera también cambian las fechas generadas localmente, de modo que una comparación superficial seguiría detectando cambios artificiales.

Acción: comparar solo campos relevantes o un hash de contenido normalizado. Separar la fecha de cambio del origen del instante de extracción. No renovar fechas de eventos ni validez de enlaces para forzar actualizaciones. Contabilizar añadidos, actualizados, omitidos y rechazados por separado.

### 3. Alto: entradas RSS se publican como eventos con fechas inventadas

Evidencia: `convex/providers/GenericRssProvider.ts:129`, `:179`, `:195`.

Los filtros aceptan títulos con palabras amplias, como `startup`, `career` o `course`. La fecha de publicación no se usa como fecha real de evento: todas las entradas reciben inicio en 14 días y fin 30 días después. Cada sincronización renueva esa vigencia. Noticias, convocatorias antiguas y duplicados consumen almacenamiento, escrituras y validaciones.

Acción: separar noticias de eventos verificables. Publicar un evento solo con fecha real o un tipo de oportunidad sin fecha claramente definido. Guardar candidatos sin verificar con estado y retención propios, y limitar resultados por proveedor.

### 4. Alto: no hay mantenimiento automático del ciclo de vida

Evidencia: `convex/crons.ts:6`, `convex/events.ts:37`, `convex/schema.ts:39`.

No hay cron para marcar eventos vencidos como `FINISHED`, archivar registros ni depurar logs. Los eventos desaparecen de la respuesta pública mediante un filtro posterior a la lectura, pero permanecen publicados en la BD. La validación de enlaces sigue examinándolos.

Acción: definir `expiresAt` o un estado activo persistido, mantenerlo con trabajos acotados y aplicar una política de retención. Medir antigüedad y tamaño por fuente antes de borrar datos. Conservar primero una copia o archivo de registros que se decida eliminar.

### 5. Alto: consultas completas y paginación solo visual

Evidencia: `convex/events.ts:17`, `:33`, `:139`; `src/pages/index.astro:17`, `:95`; `src/components/Sidebar.astro:289`, `:349`.

`getActiveEvents` usa un índice solo por estado. Los filtros restantes examinan documentos dentro de todo ese rango, luego `.collect()` carga el resultado y el código ordena en memoria. La página renderiza todas las tarjetas y sus bloques JSON-LD. Mostrar 12 tarjetas en el navegador no limita lo leído ni lo enviado.

`getAllEventsAdmin` lee toda la tabla. `getEventsForValidation` tampoco utiliza un índice; la ejecución observada lee 5.121 documentos y 7.270.304 bytes.

Acción: paginar en la BD, limitar bytes y filas por página y devolver solo campos necesarios. Diseñar índices compuestos según consultas reales, incluyendo estado/validez y fecha de caducidad. Revisar los índices por categoría, fecha y fuente, que no se usan en las consultas actuales. Los filtros fuera del rango de índice no reducen los documentos examinados. [Índices Convex](https://docs.convex.dev/database/reading-data/indexes/), [paginación](https://docs.convex.dev/database/pagination).

### 6. Alto: el tiempo de consulta reduce la reutilización de caché

Evidencia: `convex/events.ts:14`.

`getActiveEvents` depende de `Date.now()`. Convex puede reutilizar consultas con los mismos argumentos, pero documenta que usar el tiempo actual provoca invalidaciones más frecuentes y puede producir resultados temporales obsoletos. Las escrituras de todos los eventos amplían las invalidaciones de esta consulta.

Acción: consultar un estado activo mantenido por el backend o pasar una referencia de tiempo redondeada. No pasar un timestamp distinto en cada solicitud. [Uso del tiempo en consultas](https://docs.convex.dev/understanding/best-practices).

### 7. Crítico: mutaciones de mantenimiento públicas sin autorización

Evidencia: `convex/clean.ts:1`, `convex/addEkos.ts:1`.

`clean` es una mutación pública que borra registros RSS/noticias. `addEkos` es una mutación pública que inserta un evento fijo sin deduplicar. Ninguna comprueba identidad ni permisos. Un cliente puede borrar ese subconjunto de datos o repetir inserciones. Los metadatos de producción confirman que ambas mutaciones están desplegadas con visibilidad pública. No se probó una llamada destructiva.

Acción: convertir estas funciones en internas o retirarlas del despliegue. Mantener herramientas operativas fuera de la API pública. [Funciones internas Convex](https://docs.convex.dev/functions/internal-functions).

### 8. Alto: cron jobs y validación pueden invocarse desde clientes

Evidencia: las cuatro declaraciones `action` en `convex/actions.ts`; referencias `api.actions` en `convex/crons.ts`.

Las acciones no comprueban identidad, frecuencia ni exclusión de ejecuciones. Los metadatos de producción confirman la visibilidad pública de las cuatro acciones. Un cliente puede lanzar extracciones y validaciones repetidas. Esto permite multiplicar peticiones externas, lecturas, escrituras y consumo de acciones. La muestra de logs solo contiene invocaciones cron, por lo que no demuestra abuso externo.

Acción: usar `internalAction` y referencias internas desde los cron jobs. Añadir control de ejecución por fuente si se conserva una acción administrativa manual. Una protección en Vercel no controla llamadas directas a la API Convex.

### 9. Alto: admin y consultas administrativas carecen de control de acceso

Evidencia: `src/pages/admin.astro:6`; `convex/events.ts:102`, `:136`, `:144`; `src/lib/convex.ts:9`.

La página obtiene todos los eventos y logs sin autenticar al visitante. Los metadatos de producción confirman que las consultas administrativas y de validación son públicas. Devuelven documentos completos, por lo que proteger únicamente la ruta Astro dejaría la API accesible. No hay comprobaciones `ctx.auth.getUserIdentity()` en el código auditado.

Acción: aplicar autenticación y autorización administrativa en ambas capas. El catálogo público debe devolver solo eventos publicables y campos de presentación.

### 10. Alto: JSON-LD introduce un punto de XSS almacenado

Evidencia: `src/components/EventCard.astro:122`.

Se pasa `JSON.stringify()` de títulos, descripciones y URLs externas a `set:html`. JSON válido puede contener `</script>`, que el parser HTML interpreta como fin del bloque. Escapar atributos y usar `textContent` en el modal no protege este punto. El resto de `innerHTML` encontrado en las instrucciones del modal contiene texto estático, sin interpolación del scraping.

Acción: serializar JSON para contexto HTML escapando al menos `<` como `\u003c` antes de `set:html`. Considerar CSP como protección adicional. Astro no escapa automáticamente `set:html`. [Directivas de Astro](https://docs.astro.build/es/reference/directives-reference/).

### 11. Medio: URLs de fuentes externas no se validan

Evidencia: `convex/actions.ts:219`; `src/pages/index.astro:289`; `src/pages/admin.astro:230`.

Las URLs extraídas llegan a enlaces del navegador y a un `fetch` del backend. No se valida protocolo, host, credenciales, tamaño ni destino tras redirecciones. El riesgo de peticiones a destinos indebidos depende de que una fuente entregue una URL manipulada y de la conectividad del runtime. No hay un endpoint público que reciba directamente una URL arbitraria en el código actual.

Acción: aceptar HTTPS y dominios previstos por fuente, comprobar redirecciones y rechazar destinos locales/privados cuando se permita un host abierto. Aplicar validación al guardar y antes de hacer la petición.

### 12. Medio: fallos temporales invalidan enlaces y el siguiente scraping los reactiva

Evidencia: `convex/actions.ts:230`; `convex/events.ts:117`; `isLinkValid: true` en los proveedores.

Una excepción de red basta para invalidar un enlace. `lastLinkCheck` existe en el esquema, pero no se actualiza. La siguiente extracción puede volver a marcarlo válido sin una comprobación real. Esto produce oscilaciones, escrituras repetidas y ocultación de eventos por fallos transitorios.

Acción: registrar estado HTTP, última comprobación, próximos intentos y fallos consecutivos. Distinguir fallo temporal de 404/410 persistente. Validar solo enlaces activos que estén pendientes; conservar la decisión de validación al sincronizar el contenido.

### 13. Medio: scraping sin presupuesto de tiempo, tamaño ni reintentos

Evidencia: `convex/providers/GenericRssProvider.ts:116`; llamadas `fetch` de proveedores y `convex/actions.ts`.

Las respuestas completas se cargan con `.text()` o `.json()` sin límites de bytes. No hay timeout explícito, presupuesto global, reintento acotado ni respeto de `Retry-After`. Los feeds se procesan en serie; validar cinco enlaces simultáneos controla concurrencia, pero no limita trabajo total.

En producción EPN falla por certificado TLS: `invalid peer certificate: UnknownIssuer`. La acción de scraping termina sin error porque captura el fallo de esa fuente.

Acción: usar timeout/abort, topes de respuesta y número de entradas, concurrencia pequeña por host y reintentos solo para fallos temporales. Aislar EPN hasta resolver su certificado; no desactivar validación TLS. Utilizar ETag/Last-Modified cuando la fuente los ofrezca.

### 14. Medio: parsers y validadores frágiles

Evidencia: regex RSS en `GenericRssProvider.ts:122`, Meetup en `actions.ts:80`, Eventbrite en `EventbriteProvider.ts:20`; `v.array(v.any())` en `events.ts:60`.

Los parsers dependen del orden de etiquetas y del formato de una variable interna de Eventbrite. Un 200 con CAPTCHA o formato cambiado puede terminar como lista vacía sin diagnóstico. No se validan estructura, fechas finitas, URLs ni límites de campos antes de persistir. Las comparaciones con una fecha `NaN` no la rechazan. Un evento que viola el esquema puede abortar toda la mutación.

Acción: usar un parser RSS/Atom mantenido, validar cada entrada con un contrato de ingestión y rechazar errores por registro. Registrar causas y cantidades de rechazo. Diferenciar ausencia real de datos, bloqueo HTTP, error del parser y respuesta inválida.

### 15. Medio: tiempo global congelado y fuentes simuladas

Evidencia: `convex/actions.ts:9`, `:88`, `:156`; `convex/providers/LumaProvider.ts:12`; `CourseraProvider.ts:48`.

`now` se calcula fuera del handler. El tiempo global no representa necesariamente cada ejecución; el runtime Convex documenta su comportamiento de tiempo global y tiempo de ejecución. Meetup usa además `pubDate`, que es fecha de publicación, y la desplaza al futuro. Luma devuelve un mock fijo con fechas siempre futuras. Coursera renueva el inicio y un fin a 90 días en cada ciclo.

Acción: calcular tiempo dentro del handler, conservar las fechas del origen y representar cursos permanentes explícitamente. Retirar los mocks de la ingestión de producción. [Runtime Convex](https://docs.convex.dev/functions/runtimes).

### 16. Medio: deduplicación y contratos de tipos inconsistentes

Evidencia: `convex/events.ts:67`; `GenericRssProvider.ts:184`; `convex/providers/Provider.ts:1`; `src/types/index.ts:18`.

El mismo enlace puede tener distintos `externalId` por fuente. El fallback por URL puede encontrarlo y después sobrescribir su identificador y procedencia. La próxima entrada con el otro identificador necesita otra búsqueda y puede cambiarlo de nuevo. Los parámetros de tracking de URLs tampoco se normalizan.

`Provider.ts` importa `../../types`, una ruta inexistente en el inventario. Los proveedores tipan documentos de BD como `TechEvent`, pero esa interfaz describe la UI con `url`, `location`, `date` e `isLive`; los documentos producidos contienen `registrationUrl`, `dateStart`, `country`, etc. El uso de `any` debilita la protección durante ingestión. No se instaló un compilador adicional para convertir estas discrepancias estáticas en un listado de errores de TypeScript.

Acción: definir un tipo propio de ingestión alineado con el esquema, una identidad estable y URLs canónicas. Conservar aliases/procedencia sin sobrescribir la clave estable al unir fuentes.

### 17. Medio: métricas del dashboard dan una imagen incorrecta

Evidencia: `src/pages/admin.astro:73`, `:84`, `:93`, `:129`; `convex/events.ts:91`.

El panel muestra cifras estáticas de `~35 / ciclo` e `Ilimitado`, aunque hay 71 feeds RSS y Convex aplica límites. Calcula el próximo escaneo sumando seis horas a cualquier log, aunque RSS corre cada 12 horas y otros trabajos son diarios. `saveEvents` registra `SUCCESS` y añadidos; no registra actualizados, fuentes fallidas ni duración. La ejecución observada con error TLS puede mostrarse como exitosa.

Acción: mostrar métricas reales por tarea/fuente y estados de éxito parcial. Registrar lecturas, escrituras, omisiones, errores HTTP, duración y siguiente ejecución. Los límites de almacenamiento, I/O y transacciones deben mostrarse por separado.

### 18. Medio: caché SSR breve, rutas y parámetros requieren observación

Evidencia: `astro.config.mjs:9`; `src/pages/index.astro:8`, `:11`; `src/pages/en/index.astro:2`; `src/pages/admin.astro:6`.

El proyecto usa SSR. La página principal pide caché CDN de 60 segundos; admin no configura caché y efectúa dos consultas por render. `q` se lee pero no se envía al backend ni se utiliza para inicializar búsqueda. Las variantes de URL pueden fragmentar la caché dependiendo de su configuración. `/en` importa la página principal como componente; su cabecera debe comprobarse en la respuesta real antes de asumir que carece de caché.

Acción: medir `x-vercel-cache`, renderizaciones y llamadas Convex por ruta. Normalizar parámetros y decidir cuáles necesitan variantes. Aplicar caché de respuestas públicas acorde con la cadencia real de actualización y excluir contenido administrativo autenticado. No se midieron encabezados de producción. [Caché Vercel](https://vercel.com/docs/caching/cdn-cache), [SSR Astro](https://docs.astro.build/en/guides/on-demand-rendering/).

### 19. Bajo: servicios antiguos no ayudan al flujo actual

Evidencia: `src/services/events.ts:15` y ausencia de imports de `fetchEvents` en páginas/componentes.

La caché en memoria de 15 minutos no participa en el flujo Convex actual. Dev.to y el scraper local simulado de `src/services/api` tampoco se ejecutan desde las páginas. Mantener estas rutas antiguas dificulta entender qué consume recursos. `cheerio` se usa en esos servicios, no en los proveedores Convex activos.

Acción: documentar o retirar módulos sin uso después de confirmar que no existe consumidor externo. No atribuir carga actual a esa caché ni al scraper local de ejemplo.

## Presupuesto de peticiones derivado del código

| Tarea | Ejecuciones/día | Peticiones externas previstas/día |
| --- | ---: | ---: |
| Devpost + Coursera | 4 | 8 |
| Luma | 4 | 0: devuelve un mock |
| 71 feeds RSS + 3 grupos Meetup | 2 | 148 |
| 2 páginas Eventbrite + 4 sitios WordPress | 1 | 6 |
| Validación de enlaces | 1 | N llamadas HEAD, más fallback GET para respuestas 405 |

La base prevista es 162 peticiones externas diarias, más la validación. Es un cálculo de configuración, no un contador de red observado. Redirecciones, errores, ejecuciones manuales y cambios de proveedor alteran el total. Los filtros, búsqueda y botones de paginación del navegador no hacen peticiones a Convex por interacción en el código actual.

## Dependencias: resultados de `bun audit --json`

El registro reportó coincidencias de avisos en 13 paquetes del lockfile. Estar en un rango vulnerable no demuestra que el flujo afectado sea alcanzable desde esta aplicación.

| Paquete | Versión bloqueada | Máxima severidad reportada |
| --- | --- | --- |
| astro | 7.0.6 | Crítica |
| @astrojs/vercel | 11.0.2 | Moderada |
| brace-expansion | 5.0.7 | Alta |
| devalue | 5.8.1 | Moderada |
| js-yaml | 4.3.0 | Alta |
| nanoid | 3.3.15 | Alta |
| path-to-regexp | 6.1.0 | Alta |
| postcss | 8.5.16 | Alta |
| sharp | 0.35.3 | Alta |
| smol-toml | 1.7.0 | Alta |
| svgo | 4.0.1 | Alta |
| tar | 7.5.19 | Alta |
| undici | 7.28.0 | Alta |

El aviso crítico de Astro afecta la optimización de imágenes AVIF no confiables. La corrección publicada es Astro 7.2.8 con Sharp 0.35.4. Las tarjetas actuales usan `<img>`; no se encontraron `Image`, `Picture`, `getImage` ni una configuración de dominios remotos para optimización. La explotación de ese camino no se confirmó. [Aviso del mantenedor](https://github.com/withastro/astro/security/advisories/GHSA-26w7-cxv4-gfx2).

El aviso del adaptador Vercel afecta ISR habilitado con controles de acceso en el edge. Este proyecto usa `vercel()` y el adaptador instalado define `isr = false` por defecto. El camino afectado no está configurado aquí; aun así, la versión bloqueada coincide con el aviso y conviene actualizarla antes de introducir ISR. El parche del aviso es 11.0.3. [Aviso del mantenedor](https://github.com/withastro/astro/security/advisories/GHSA-x27w-589x-frm2).

Otros avisos afectan parsers, herramientas de compilación y usos específicos de HTTP/WebSocket. No se encontró procesamiento público de CSS, YAML, TOML o archivos tar suministrados por visitantes. El `fetch` del runtime Convex no es la dependencia npm `undici` del lockfile. Se recomienda actualizar dependencias de manera controlada y repetir el audit; cambiar solo `package.json` sin regenerar el lockfile no acredita una corrección.

### Identificadores reportados

- `@astrojs/vercel`: GHSA-x27w-589x-frm2.
- `astro`: GHSA-4g3v-8h47-v7g6, GHSA-26w7-cxv4-gfx2, GHSA-376h-93r7-7g6f.
- `brace-expansion`: GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895.
- `devalue`: GHSA-9rgm-9g3h-6x36.
- `js-yaml`: GHSA-5p4m-2wfm-xmqj, GHSA-2883-xcg3-v3hh.
- `nanoid`: GHSA-28wg-ghj8-5hjv, GHSA-2v37-7h3g-55p8.
- `path-to-regexp`: GHSA-9wv6-86v2-598j.
- `postcss`: GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849.
- `sharp`: GHSA-rgj7-g3m4-5g8c.
- `smol-toml`: GHSA-7w5x-hrqm-74c2.
- `svgo`: GHSA-2p49-hgcm-8545, GHSA-4vpr-x523-8j87, GHSA-w27v-7q3p-w38r.
- `tar`: GHSA-r292-9mhp-454m.
- `undici`: GHSA-8xcm-r25x-g524, GHSA-4cwx-7wf7-3272, GHSA-m8rv-5g2x-5cg5, GHSA-jr45-8vmc-qm54, GHSA-v3r7-h72x-cjcm, GHSA-3wwx-pv8p-q78v, GHSA-pmjh-fq2x-6v4x, GHSA-r53p-7pc4-xj5r, GHSA-rfgv-xxqx-mfg5, GHSA-3xpg-4rpp-hhhm, GHSA-2jfj-6hjv-fm6j, GHSA-2gqq-gqf2-x968, GHSA-w293-vg96-wgc3, GHSA-8436-99hf-9mmv, GHSA-rx4f-c7p8-82vq.

Los archivos `.env` y `.env.local` no están versionados en el estado actual. El escaneo limitado de archivos de aplicación no encontró claves privadas ni los patrones de tokens comprobados. Esto no sustituye una revisión de secretos del historial completo.

## Orden de intervención

1. Cerrar las mutaciones de mantenimiento y acciones cron públicas; proteger las consultas y página administrativa.
2. Dividir la ingestión RSS, deduplicar entradas y omitir escrituras cuando contenido no cambia.
3. Corregir fechas inventadas y separar noticias, cursos permanentes y eventos con fecha real.
4. Mantener estados de caducidad, paginar consultas y validar solo enlaces activos pendientes.
5. Actualizar dependencias vulnerables, escapar JSON-LD y validar URLs.
6. Medir almacenamiento por tabla/fuente e índices; definir retención antes de depurar por lotes.
7. Reemplazar cifras estáticas del panel por métricas reales.

## Evidencia pendiente para cerrar el incidente

Se necesita el mensaje exacto de Convex si hubo un fallo, y el consumo de almacenamiento frente a la cuota del despliegue. Para almacenamiento, medir tamaño y antigüedad de `events`, `cronLogs` e índices. Para transacciones, comparar próximas ejecuciones de `saveEvents` con el límite de rangos leídos. Para tráfico, obtener llamadas por función, origen del llamador, cache hits y conflictos de escritura.

La corrección queda acreditada cuando la ingestión opera con un margen estable por lote, eventos sin cambios no generan escrituras y almacenamiento deja de crecer por entradas caducadas. Los controles de acceso deben rechazar llamadas anónimas administrativas. Estos criterios son una propuesta de validación posterior; no se aplicaron cambios de código en esta auditoría.
