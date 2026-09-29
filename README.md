# Eventos SimCodec

Catálogo de eventos tecnológicos y cursos. Astro sirve HTML mediante SSR en Vercel; Convex almacena el catálogo y ejecuta tareas internas.

## Desarrollo

```sh
bun install --frozen-lockfile
npx convex dev
npx astro dev --background
```

Gestiona Astro con `astro dev status`, `astro dev logs` y `astro dev stop`.

```sh
bun run check
bun run build
bun audit
```

## Configuración

- `CONVEX_URL`: URL del despliegue que consulta el servidor Astro.
- `PUBLIC_CONVEX_URL`: URL pública de compatibilidad; no contiene credenciales.
- `CONVEX_DEPLOYMENT`: selección local del proyecto Convex.
- `ADMIN_TOKEN`: secreto de 32 bytes aleatorios, configurado en **Convex y Vercel**. Nunca usar prefijo `PUBLIC_`, incluirlo en URLs ni versionarlo.
- `WORDPRESS_EVENT_SOURCES`: JSON opcional en Convex con hasta ocho objetos `{ "name": "...", "url": "..." }` para endpoints The Events Calendar comprobados. Sin configuración no se hacen esas peticiones.
- `RSS_EVENT_FEEDS`: JSON opcional en Convex con hasta diez objetos `{ "name": "...", "url": "..." }`. Solo hosts permitidos en `convex/lib/http.ts` y feeds con fecha explícita de evento. La fecha de publicación RSS no es una fecha de evento.

La ruta `/admin` usa HTTP Basic sobre HTTPS: usuario `admin`, contraseña `ADMIN_TOKEN`. El middleware rechaza solicitudes antes de consultar la BD. Las consultas administrativas verifican el mismo secreto en Convex y devuelven páginas de hasta 50 documentos. Sus respuestas no se almacenan en caché.

## Ingestión y presupuestos

| Trabajo | Frecuencia | Presupuesto |
| --- | --- | --- |
| Devpost y Coursera | 6 horas | Dos fuentes, hasta 100 candidatos por fuente |
| RSS con fechas explícitas | 12 horas | Hasta diez feeds; desactivado sin configuración |
| Eventbrite | 24 horas | Dos endpoints; WordPress opcional |
| Validación de enlaces | Una hora | Hasta 100 enlaces pendientes; 100 segundos por ejecución |
| Caducidad y retención | Una hora | Lotes de 100 eventos/logs |
| Archivo | Una hora | Lotes de 50; hasta 250 registros por estado |

Las peticiones usan HTTPS, hosts permitidos, hasta tres redirecciones verificadas, timeout de diez segundos y respuestas de hasta 2 MB. La validación usa cuatro segundos y una petición simultánea por host. Un fallo activa backoff de la fuente; `Retry-After` puede ampliarlo. ETag y Last-Modified evitan procesar respuestas sin cambios.

Cada mutación de ingestión admite **100 eventos** con un contrato tipado. La URL canónica elimina tracking, permite deduplicación y conserva identidad y procedencia existentes. El contenido idéntico no se escribe; el estado de validación de enlaces no se reinicia por scraping. Los logs distinguen añadidos, actualizados, omitidos, rechazados, peticiones, duración y fallos parciales.

Coursera se representa como curso a tu ritmo, sin fechas ficticias ni gratuidad asumida. Luma simulado, noticias genéricas y Meetup basado en `pubDate` se retiraron del flujo. EPN permanece deshabilitado hasta corregir su cadena TLS. Los endpoints WordPress antiguos de CITEC, ESPOL y UCE devolvieron 404: se deshabilitaron. Los calendarios actuales de esas organizaciones necesitan adaptadores compatibles; no se presupone que usan The Events Calendar.

El catálogo utiliza índices y cursores: 12, 24 o 48 resultados por página, con un máximo de 256 filas y 600 KB examinados. Búsqueda usa el índice de texto. Los filtros se aplican al pulsar **Aplicar filtros y búsqueda**; Enter ejecuta búsqueda. No se envían peticiones por cada tecla. Las páginas públicas tienen caché CDN de cinco minutos.

## Archivo y recuperación

La migración `maintenance:migrate` procesa 100 registros por transacción y se reanuda mediante scheduler. Identifica noticias con fechas inventadas, mocks, duplicados y fechas inválidas; los pone en cuarentena. Los eventos terminados dejan de aparecer en el catálogo.

El archivo guarda documentos completos en **Convex File Storage antes de retirarlos de events**. La tabla `eventArchives` conserva identificadores de archivos, cantidades y fechas. Solo se retiran documentos cuyo estado y versión siguen coincidiendo. Los archivos no se eliminan automáticamente; consumen la cuota de File Storage, que debe medirse por separado.

Se archivan registros en cuarentena y eventos terminados hace más de 90 días. Los logs operativos tienen retención de 90 días. El resto del catálogo conserva datos completos.

Antes del despliegue de septiembre se exportó un snapshot completo a `.backups/production-before-fixes-2026-09-29.zip`, excluido de Git. También queda disponible en Settings / Snapshots de Convex.

Para recuperación, descargar archivos desde el dashboard y revisar documentos en un despliegue aislado. Restaurar un snapshot completo sustituye datos: conservar primero otro snapshot actual y revisar cambios posteriores. La reversión de código se hace desplegando el commit anterior; también requiere restaurar el estado de datos que corresponda. No ejecutar reemplazos de producción sin revisar ese alcance.

## Despliegue

Desplegar primero Convex, ejecutar migración, verificar ingestión y después publicar Astro:

```sh
npx convex deploy --typecheck enable
npx convex run --prod maintenance:migrate '{}'
vercel --prod
```

Comprobar que Vercel apunta al mismo `CONVEX_URL` de producción. Las credenciales administrativas se provisionan por canales secretos, no mediante argumentos visibles ni archivos versionados.

Ver [auditoría](reports/auditoria-seguridad-convex-2026-09-29.md) y [correcciones](reports/correcciones-2026-09-29.md).
