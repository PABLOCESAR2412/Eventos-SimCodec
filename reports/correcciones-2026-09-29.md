# Correcciones aplicadas — 29 de septiembre de 2026

## Cambios

1. Ingestión tipada en lotes de hasta 100 registros. Se deduplican URLs canónicas y se omiten escrituras cuando el contenido no cambia.
2. Noticias RSS con fechas inventadas, Meetup basado en fecha de publicación y Luma simulado se excluyen del catálogo. RSS requiere configuración explícita y fecha real.
3. Coursera se representa como curso a tu ritmo, con fecha estable y sin asumir acceso gratuito.
4. Se reemplazan consultas completas por índices compuestos, búsqueda de texto y cursores. El catálogo devuelve hasta 48 resultados y examina como máximo 256 filas / 600 KB por consulta.
5. La caducidad se mantiene mediante tarea interna; ninguna consulta pública depende de Date.now().
6. Acciones cron, validación, ingestión y mantenimiento son internos. Se retiraron clean, clear, addEkos y fixnan.
7. Admin tiene HTTP Basic en Astro y comprobación independiente del secreto en Convex. Consultas de hasta 50 registros; Cache-Control privado/no-store.
8. JSON-LD escapa caracteres '<'. Los enlaces de ingestión admiten únicamente HTTPS público sin credenciales.
9. Fetch utiliza hosts permitidos, redirecciones verificadas, timeout, tamaño máximo y backoff. Preserva rutas con slash para evitar bucles de redirección.
10. Validación de enlaces procesa solo pendientes: 100 por ejecución, 100 segundos, una petición simultánea por host. Fallos de red no ocultan eventos; dos 404/410 consecutivos invalidan enlaces. La ingestión conserva esa decisión.
11. La telemetría registra peticiones HTTP reales, incluso redirecciones, duración y eventos añadidos/actualizados/omitidos/rechazados. Los fallos parciales y trabajos desactivados se muestran explícitamente.
12. Logs tienen retención de 90 días. Eventos en cuarentena y terminados hace más de 90 días se guardan completos en File Storage antes de retirarse de events.
13. Se eliminaron cinco índices antiguos sin consumidores y servicios locales sin uso. Cheerio se retiró.
14. Astro, adaptador Vercel, Convex y dependencias transitivas se actualizaron con lockfile. Overrides mantienen versiones corregidas de dependencias transitivas.
15. Catálogo y /en usan caché CDN de cinco minutos. Parámetros se normalizan; búsqueda se envía al backend al aplicar filtros o pulsar Enter.

## Evidencia de producción

Snapshot inicial: 5.145 documentos en events; 7.888.253 bytes de JSONL exportado. Había 654 logs.

La migración recorrió datos por lotes. **5.004 registros quedaron preservados en 101 archivos** de Convex File Storage. Tras el archivo había 141 documentos en events: 56 publicados y 85 terminados recientes. Eventbrite añadió posteriormente un evento, dejando 142 documentos.

El JSONL de events bajó inicialmente a 241.155 bytes: **96,94 % menos datos serializados en esa tabla**. No equivale al consumo total de almacenamiento facturado: los archivos preservados consumen File Storage, y las tablas/índices tienen almacenamiento adicional.

Ingestión inicial de APIs: 39 eventos actualizados para corregir contratos/fechas; cero añadidos y cero rechazados. Las siguientes ejecuciones de APIs devolvieron cero actualizados y diez omisiones, incluyendo un HTTP 304. Tras actualizar Eventbrite y limpiar campos antiguos, otra ejecución devolvió nueve omisiones y cero escrituras de eventos.

Consultas de comprobación devolvieron nueve competencias y nueve resultados para 'hackathon'. Las consultas administrativas con secreto válido funcionan; con secreto inválido fallan. El function-spec de producción confirma que las cuatro acciones y la consulta de validación son internas, y las mutaciones antiguas ya no existen.

Las comprobaciones locales pasaron:

- bun run check: cero errores y cero warnings; cinco hints de código/deprecaciones.
- bun run build: compilación SSR completada.
- Convex deploy --typecheck enable: compilación y validación de esquema completadas.
- bun audit --json: objeto vacío.
- git diff --check: sin errores de whitespace tras normalización.

La configuración de Vercel se establece explícitamente en el mismo despliegue Convex de producción. ADMIN_TOKEN se provisiona como secreto en ambos servicios y se guarda localmente fuera del repositorio.

Ver [evidencia de corrección](convex-remediation-evidence-2026-09-29.json) y [auditoría original](auditoria-seguridad-convex-2026-09-29.md).

## Fuentes externas y cuotas

Los antiguos endpoints WordPress de CITEC, ESPOL y UCE devolvieron 404 y quedaron deshabilitados por defecto. Sus calendarios actuales requieren adaptadores o endpoints compatibles comprobados. EPN sigue deshabilitado por cadena TLS inválida. No se desactiva la verificación de certificados.

El calendario actual de ESPOL utiliza una página de eventos institucionales; no se presupone soporte de The Events Calendar. Referencias: [CITEC](https://citec.com.ec/eventos/), [ESPOL](https://www.espol.edu.ec/es/eventos).

Convex advierte que la cuenta supera límites del plan Free. Esta advertencia agrupa proyectos y no identifica por sí sola almacenamiento ni transacciones. Los cambios reducen trabajo futuro y datos indexados; el consumo acumulado y la cuota restante deben comprobarse en Usage del equipo. Una alerta mensual no desaparece necesariamente después de reducir carga.

## Recuperación

Existen snapshots locales, excluidos de Git:

- .backups/production-before-fixes-2026-09-29.zip
- .backups/production-after-fixes-2026-09-29.zip
- .backups/production-final-with-archives-2026-09-29.zip (incluye File Storage)

El archivo guarda documentos originales con identificadores y metadatos antes de cualquier retirada. La operación comprueba estado y updatedAt antes de retirar cada documento. Los archivos no tienen borrado automático. Revisar restauraciones en un despliegue aislado y conservar otro snapshot actual antes de sustituir producción.
