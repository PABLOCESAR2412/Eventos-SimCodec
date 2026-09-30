# Revisión integral del proyecto

Fecha: 29 de septiembre de 2026. Commit revisado: `54ed5cc28e2c7eb509d977089e6a1f14d63873d1`.

## Resultado

El proyecto compila y las rutas principales responden, pero todavía tiene defectos funcionales y de protección del consumo. No corresponde considerarlo completamente verificado.

Se revisaron las rutas Astro, componentes, middleware, estilos, configuración, contratos Convex, consultas, mutaciones, tareas, parsers, HTTP externo, mantenimiento, dependencias y documentación. La revisión de producción fue de lectura: no se ejecutaron tareas de ingestión, mutaciones ni cambios de datos. Las pruebas de mutaciones y HTTP 304 utilizaron contextos y respuestas simulados.

### Comprobaciones satisfactorias

- `bun run check`: 0 errores, 0 warnings, 4 hints existentes.
- `bun run build`: compilación SSR correcta.
- `bunx tsc -p convex/tsconfig.json --noEmit`: correcto.
- `bun audit --json`: `{}`, sin avisos devueltos por el registro consultado.
- 26 comprobaciones positivas: normalización, rechazo de URLs inválidas, destinos y redirecciones, límite de bytes, fechas, RSS con entidades, contratos del catálogo, autenticación y ausencia del secreto actual en archivos versionados.
- Vercel: despliegue de producción `dpl_CN5RRPh8A6HGPLSibBxD8NBFwJXJ`, estado Ready, correspondiente al commit revisado.
- `/`, `/?view=courses`, `/?q=hackathon` y `/en/`: HTTP 200.
- `/admin` y `/admin/`: HTTP 401 sin credenciales. `/admin` autorizado: HTTP 200 y `Cache-Control: private, no-store`.
- Las escrituras, scraping, validación y mantenimiento se declaran como funciones internas. Las consultas administrativas verifican un secreto en Convex además de la autenticación del middleware.

### Estado de los datos

Se leyeron los 142 documentos actuales de `events` mediante páginas administrativas limitadas.

- Estado: 57 `PUBLISHED`, 85 `FINISHED`.
- Tipo: 110 `EVENT`, 32 `COURSE`.
- 55 documentos publicados tienen `isLinkValid=true`: 24 eventos y 31 cursos.
- Duplicados por URL canónica: 0. Duplicados por `externalId`: 0.
- Sin tipo o sin versión de migración: 0.
- Publicados cuyo `expiresAt` ya venció: 0.
- URL canónica, `expiresAt` y presencia de `searchText`: sin inconsistencias detectadas.
- Hay dos documentos históricos con `dateEnd < dateStart`. Ambos están `FINISHED` y quedan fuera del catálogo público.
- Hay 13 documentos publicados con dominios que el validador de enlaces no admite.

Las últimas ejecuciones de API y scraping registran `SUCCESS`. RSS registra `DISABLED`, coherente con la ausencia de configuración. La última validación registra `PARTIAL`: 100 peticiones y dos enlaces retirados de la visibilidad por la política de errores. Los logs anteriores a las correcciones se conservaron; no se interpretaron como fallos del código actual.

## Hallazgos prioritarios

### F01 — P1: el presupuesto de lectura no protege las búsquedas

Ubicación: `convex/events.ts:38`, `convex/events.ts:54`, `convex/schema.ts:18`.

`maximumRowsRead=256` y `maximumBytesRead=600000` se pasan también a la consulta de texto. La versión instalada de Convex y su documentación indican que ambas opciones no se aplican a consultas de búsqueda. Además, `kind` se filtra después del índice de texto, por lo que encontrar pocos resultados de un tipo puede examinar muchos candidatos del otro tipo.

Esto es un fallo del presupuesto declarado, aunque el catálogo actual sea pequeño. Los límites generales de Convex siguen existiendo; no equivalen al presupuesto elegido por esta aplicación. No se realizaron pruebas de carga.

Corrección: incorporar los campos selectivos al índice de búsqueda y aplicar una estrategia con un límite real de candidatos examinados. Actualizar la documentación para distinguir el presupuesto de consultas ordinarias del de búsqueda.

Referencias: [PaginationOptions](https://docs.convex.dev/api/interfaces/server.PaginationOptions), [búsqueda de texto y filtros](https://docs.convex.dev/search/text-search).

### F02 — P1: las horas visibles usan UTC y los filtros usan Ecuador

Ubicación: `src/components/EventCard.astro:28`, `src/components/EventCard.astro:61`, `src/lib/catalog.ts:7`.

Los componentes especifican `es-EC`, pero omiten `timeZone`. El locale define formato e idioma, no la zona horaria. En producción se comprobó un evento con `startDate=2026-07-11T12:00:00.000Z`: la página muestra 12:00 p. m.; en Ecuador corresponde a 07:00 a. m. No se indica que la hora mostrada sea UTC. Los filtros mensuales, en cambio, usan UTC−5.

Corrección: centralizar el formato de fechas con `America/Guayaquil`, indicar la zona horaria y utilizar el mismo contrato en tarjetas, modal y administración. Si se decide mostrar la zona del organizador, debe almacenarse e indicarse explícitamente.

Referencia: [opciones de fecha y zona horaria](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleString).

### F03 — P2: los filtros pueden producir una página vacía con resultados existentes

Ubicación: `convex/events.ts:31`, `convex/events.ts:54`, `convex/events.ts:64`.

`topics` se aplica después de `paginate`. En búsqueda, los filtros distintos de `kind` también se aplican después. El cursor avanza por candidatos que el usuario no ve.

Reproducción en producción: eventos con tema `Workshops` devuelven 0 elementos en la primera página aunque existe 1 coincidencia; cursos con `Networking` devuelven 0 aunque existen 2. El tamaño elegido tampoco representa el tamaño de una página de coincidencias.

Corrección: normalizar la taxonomía y filtrar antes de consumir la página, usando campos e índices adecuados. Conservar un presupuesto de lectura real y comunicar cuando se alcanza ese presupuesto. Unificar `matches` y `databaseFilters`: actualmente `source` usa inclusión parcial en uno e igualdad exacta en el otro.

### F04 — P2: «Página anterior» queda atrapada en la segunda página

Ubicación: `src/components/Sidebar.astro:278`, `src/components/Sidebar.astro:284`.

Solo se guarda una URL en `catalogPrevious`. Después de navegar de la página 2 a la 3, volver devuelve la 2; volver otra vez devuelve nuevamente la 2. Se reprodujo ejecutando el handler actual con un almacenamiento simulado. El estado tampoco distingue filtros o vistas, y una excepción de `sessionStorage` interrumpe la navegación siguiente.

Corrección: mantener una pila de cursores por conjunto de filtros y vista, o utilizar enlaces/historial coherentes. Manejar almacenamiento bloqueado con una alternativa de navegación.

### F05 — P2: un único 404 puede ocultar un evento después de un error transitorio

Ubicación: `convex/events.ts:121`, `convex/events.ts:124`.

`linkFailures` cuenta todos los errores. Una respuesta 503 seguida de una primera respuesta 404 ya cumple `failures >= 2` y marca el enlace como inválido. Se reprodujo contra el handler real con un contexto simulado. Esto no cumple la política documentada de repetir 404/410 antes de ocultar.

Corrección: contar por separado errores definitivos consecutivos, reiniciar ese contador con respuestas de otro tipo y conservar los fallos transitorios para el backoff.

### F06 — P2: 13 enlaces publicados no pueden validarse

Ubicación: `convex/lib/http.ts:3`, `convex/lib/http.ts:7`, `convex/actions.ts:101`.

La BD contiene enlaces publicados de `www.eventbrite.ca`, `www.eventbrite.co.uk`, `www.eventbrite.com.ar`, `www.eventbrite.cl` y `www.eventbrite.fr`. Ninguno pertenece a los hosts permitidos. El validador los rechaza localmente, registra HTTP 0 y los reintenta; no puede comprobar si siguen disponibles. Dos ya registran HTTP 0; los restantes todavía no se comprobaron.

Corrección: verificar e incorporar únicamente los dominios regionales oficiales necesarios. Distinguir un destino rechazado por política de una caída de red y evitar reintentos sin posibilidad de éxito. Mantener la verificación de redirecciones.

### F07 — P2: el coste desconocido se confunde con gratuito o de pago

Ubicación: `convex/lib/parsers.ts:18`, `convex/lib/parsers.ts:98`, `convex/events.ts:33`, `src/components/EventCard.astro:27`.

En Eventbrite, `Number('') === 0`: una oferta con precio vacío se clasifica como gratuita. Se reprodujo con una entrada sintética. En Coursera y otros proveedores, `isFree=false` se usa también cuando no se conoce el coste; el filtro «De Pago» incluye esos registros. En producción hay 45 documentos publicados con precio ausente o texto «Consultar», usando esta clasificación binaria.

Corrección: representar `FREE`, `PAID` y `UNKNOWN`; exigir un precio numérico válido antes de deducir gratuidad. Conservar importe y moneda separados del texto descriptivo, y propagar el mismo contrato a filtros, etiquetas y JSON-LD.

### F08 — P2: el fallback de WordPress cambia la fecha según el servidor

Ubicación: `convex/lib/parsers.ts:60`, `convex/lib/parsers.ts:63`.

Cuando no hay `utc_start_date`, se utiliza `Date.parse(start_date)` ignorando `timezone`. La entrada `2027-01-01 10:00:00`, con `America/Guayaquil`, produce 10:00Z bajo `TZ=UTC`, cuando corresponde a 15:00Z. La misma entrada parece correcta en la máquina local configurada en Ecuador. El caso se reprodujo en ambos contextos.

Corrección: exigir fechas UTC o con offset; convertir explícitamente la zona del proveedor cuando haya un formato local. Rechazar entradas ambiguas. Las fuentes WordPress están desactivadas actualmente, por lo que este defecto afecta su futura activación.

### F09 — P2: HTTP 304 no reinicia los fallos de una fuente recuperada

Ubicación: `convex/actions.ts:26`, `convex/sources.ts:11`.

La respuesta 304 hace `continue` antes de registrar éxito. Una fuente que se recupera conserva el número de fallos anterior; el siguiente error activa un backoff excesivo. Se ejecutó el handler de API con dos respuestas 304 simuladas: hubo cero actualizaciones de recuperación donde correspondían dos.

Corrección: registrar recuperación también con 304, conservar los validadores HTTP y evitar reescribir datos del catálogo sin cambios.

### F10 — P2: parámetros inválidos generan errores de servicio y variantes de caché

Ubicación: `src/pages/index.astro:25`, `src/lib/catalog.ts:30`, `src/pages/admin.astro:9`.

`/?cursor=invalid` devuelve 503 y presenta el catálogo como no disponible, aunque el resto funciona. La administración tampoco tiene recuperación de errores de consulta. Además, `size=banana&date=whatever` y `size=another&date=different` conservan URLs diferentes aunque ambos usen los valores predeterminados; se verificó con el normalizador actual.

Corrección: separar errores de entrada de fallos del servicio, ofrecer reinicio del cursor y responder 400 cuando corresponda. Canonizar tamaños y fechas según sus valores admitidos. Las variantes desperdician caché SSR; no se atribuye una lectura nueva de BD a cada variante porque Convex también cachea consultas idénticas.

### F11 — P2, riesgo de seguridad: consultas públicas eluden el único control de caché SSR

Ubicación: `convex/events.ts:18`, `convex/events.ts:68`, `src/middleware.ts:5`.

`getCatalogPage` y la consulta de compatibilidad `getActiveEvents` son públicas. Un cliente puede llamarlas directamente, usando argumentos distintos para evitar reutilizar respuestas, sin pasar por Vercel. No hay limitador de frecuencia en la aplicación. Vercel informa que no existen reglas personalizadas; su protección automática puede seguir activa y no protege el dominio separado de Convex.

El límite por consulta reduce trabajo individual, pero no controla frecuencia agregada. No se detectó una intrusión ni se ejecutó tráfico de carga. Este riesgo es especialmente relevante mientras el equipo conserva alertas de cuota.

Corrección: controlar acceso del catálogo a través del servidor SSR con un mecanismo apropiado, retirar la consulta de compatibilidad cuando no tenga consumidores y limitar frecuencia/coste en los puntos de entrada expuestos. Medir consumo real y conservar alertas de cuota.

Referencia: [OWASP API4: consumo de recursos sin restricciones](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/).

### F12 — P2: la ruta inglesa devuelve contenido español

Ubicación: `src/pages/en/index.astro:2`, `src/layouts/Layout.astro:13`.

`/en/` importa directamente la página española. La respuesta HTTP 200 conserva textos españoles y `lang="es"`. No constituye una versión inglesa funcional.

Corrección: extraer textos por locale, traducir la interfaz y pasar idioma al layout; utilizar formatos coherentes con la zona horaria definida.

### F13 — P3: dos registros históricos conservan fechas invertidas

Ubicación: `convex/maintenance.ts:16`, `convex/maintenance.ts:24`.

La migración histórica no valida `dateEnd >= dateStart`, a diferencia de `normalizeEvent`. Los documentos `j577kb581ehvpm2chedkxqg27x8awcne` y `j579rahmt3td9my34j0j2z48s58a32sr`, de Devpost, mantienen esta inconsistencia. Ambos están terminados y no se publican.

Corrección: registrar motivo de cuarentena y preservar los originales; unificar invariantes entre ingestión y migración. No inventar fechas para corregir los registros.

### F14 — P3: falta una base permanente de comprobaciones y contratos compartidos

Ubicación: `package.json:18`, `src/pages/index.astro:193`, `src/types/index.ts:1`, `convex/lib/model.ts:2`.

No hay suite ni workflow de CI versionados. La página concentra renderizado, estado de modal y texto de participación. El tipo frontend, el contrato Convex y el mapeo DTO se mantienen manualmente; `kind` continúa opcional y categoría/estado admiten strings arbitrarios. También permanecen un listener `filters:changed` sin emisor, un componente Welcome sin consumidor y la dependencia `motion` sin uso detectado.

Corrección: convertir las reproducciones de esta revisión en pruebas mantenidas; establecer CI con tipos, build y pruebas. Compartir tipos de dominio y DTO, y extraer modal y reglas de presentación en componentes/módulos con una responsabilidad. Endurecer enums mediante una transición compatible, conservando fuentes existentes. Retirar elementos sin consumidores después de confirmar su alcance.

## Clean code y patrones

La separación entre `http`, `parsers`, `model`, acciones y persistencia es una base útil. El objeto `Source` con función `parse` ya permite adaptadores de fuente intercambiables. Las mutaciones acotadas y el archivo previo a la retirada de documentos son decisiones correctas.

Prioridad de diseño: consolidar contratos y políticas compartidas de filtros, precios, fechas y validación. Mantener funciones Convex como capa de persistencia y componentes Astro para presentación. Evitar que nuevas fuentes deban modificar múltiples reglas inconsistentes. La reducción de duplicación debe preservar presupuestos de lectura, identidad de registros y compatibilidad de datos.

## Evidencia y límites

- [26 comprobaciones positivas y lectura de producción](../.backups/project-review-evidence-2026-09-29.json).
- [Seis comprobaciones que reproducen defectos y zona horaria publicada](../.backups/project-review-regressions-2026-09-29.json).
- [Script de comprobaciones generales](../.backups/project-review-2026-09-29.mts).
- [Script de reproducciones](../.backups/project-review-regressions-2026-09-29.mts).

Los archivos de evidencia quedan locales, excluidos de Git y del despliegue. Los scripts leen credenciales locales para consultas administrativas; no imprimen ni almacenan el secreto en la evidencia.

No hubo navegador disponible: inventario de apps y navegadores vacío. El funcionamiento visual, Tab/Escape en un navegador real, lectores de pantalla y tamaños de móvil/escritorio quedan sin validación interactiva. No se realizaron pruebas de carga ni se verificó la cuota exacta del equipo. La lectura paginada de producción no constituye un snapshot atómico entre páginas; estas conclusiones describen el estado observado durante la revisión.

Orden recomendado: protección del consumo y fechas visibles; después filtros/paginación, política de enlaces, precios y recuperación HTTP; finalmente i18n, contratos y CI.
