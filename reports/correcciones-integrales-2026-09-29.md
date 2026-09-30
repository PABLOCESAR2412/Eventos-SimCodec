# Correcciones integrales

## Catálogo y consumo

Las búsquedas ya no usan el índice de texto de Convex. El servidor obtiene candidatos mediante índices ordinarios, con un máximo de 256 filas y 600 KB por tipo. Búsquedas, temas, fuentes, precios y fechas se filtran antes de construir la página visible.

El cliente SSR comparte dos argumentos de consulta: eventos y cursos. Los parámetros de búsqueda no crean variantes de consultas a la base de datos. Hay una caché de datos de 60 segundos por instancia y se conserva la caché pública de Vercel de 300 segundos.

Si el conjunto supera el presupuesto, la consulta falla de forma explícita: nunca comunica resultados parciales como un catálogo completo. Antes de superar esa capacidad debe añadirse un catálogo materializado, sin incrementar el presupuesto de búsqueda por visitante. El catálogo comprobado después de restaurar dos enlaces afectados por la política anterior contiene 25 eventos (22.773 bytes) y 32 cursos (79.443 bytes).

Las consultas de catálogo requieren un secreto exclusivo del servidor. Las consultas anteriores `getCatalogPage` y `getActiveEvents`, y los índices sin consumidores, fueron retirados después de publicar el cliente nuevo. Tipo y estado del precio son obligatorios tras verificar la migración; el estado del evento admite únicamente publicado, terminado o en cuarentena. Las categorías históricas se conservan.

La limitación de frecuencia usa contadores atómicos en Convex: 60 peticiones por dirección y minuto, 300 globales por minuto; login, 5 intentos por dirección cada 15 minutos, 100 globales en ese período. Los identificadores son HMAC de la dirección, sin almacenar IP en claro. Los contadores caducados se eliminan mediante mantenimiento acotado. El limitador hace lecturas/escrituras pequeñas e indexadas; las solicitudes denegadas no consultan eventos. Vercel sobrescribe el [header de dirección](https://vercel.com/docs/headers/request-headers#x-forwarded-for) para evitar falsificaciones.

## Funcionalidad y contratos

- Paginación con enlaces generados en el servidor; anterior funciona en todas las páginas y no requiere `sessionStorage`.
- Cursor inválido: HTTP 400, explicación y enlace para reiniciar. Tamaños, fechas y filtros admitidos se canonizan.
- Fechas de tarjetas, modal y administración: `America/Guayaquil`, con indicación visible de Ecuador (UTC−5).
- Precios: `FREE`, `PAID`, `UNKNOWN`, con importe y moneda separados cuando la fuente los aporta. Un valor vacío no se convierte en cero. Lo desconocido queda fuera del filtro de pago.
- WordPress: UTC y offsets explícitos; conversión de Ecuador cuando el proveedor declara esa zona. Fechas locales de zonas no admitidas se rechazan sin inventar una hora.
- 404/410: contador separado de errores definitivos consecutivos. Un error transitorio reinicia ese contador. Los enlaces ocultados por contadores históricos ambiguos se restauran para una nueva comprobación.
- HTTP 304: registra recuperación y conserva validadores, sin reescribir eventos.
- Eventbrite: se admiten los cinco dominios regionales presentes en los datos. Esos dominios aparecen en el contenido oficial de [Eventbrite](https://www.eventbrite.com/). Se conserva la comprobación de cada redirección. Un destino rechazado por política se identifica mediante estado -1 y detiene reintentos hasta revisión.
- Interfaz `/en/` traducida, incluido `lang`, controles, modal y formato de fechas. Los textos originales de cada organizador conservan su idioma.
- Modal separado en componente y controlador. El controlador usa `textContent`, maneja cancelación, limita Tab y devuelve foco al botón original.
- Retirados el componente de bienvenida de Astro, sus recursos y la dependencia `motion`, sin consumidores.

## Administración

`/admin/login` reemplaza HTTP Basic con un formulario del sistema visual actual. Incluye validación HTML y servidor, errores accesibles, mostrar/ocultar contraseña y estado de envío. La contraseña se verifica mediante scrypt; el secreto de Convex permanece solo en el servidor.

La cookie de sesión está firmada, dura 8 horas y utiliza `HttpOnly`, `Secure` en producción y `SameSite=Strict`. Formularios de login/logout exigen el mismo origen. El cuerpo del login está limitado a 4 KB. Administración usa `private, no-store`, `noindex` y protección contra frames.

Los enlaces de paginación administrativa llevan cursores firmados con un propósito distinto al de la sesión. Una entrada alterada devuelve HTTP 400 con recuperación antes de consultar Convex; los fallos del servicio conservan HTTP 503.

Las credenciales se entregan en un archivo privado fuera del repositorio, con permisos exclusivos del usuario y SYSTEM. Para revocar todas las sesiones, rota `ADMIN_SESSION_SECRET` y vuelve a desplegar. Al cambiar la contraseña, rota también ese secreto. No se incluyeron secretos en commits ni en este informe.

## Datos y pruebas

Backup de producción, incluidos archivos, antes de migrar. Migración idempotente de contratos: 142 registros con versión 2; cero fechas invertidas activas; dos pares de fechas originales preservados y registros en cuarentena. Cero contratos de precio ausentes y cero dominios publicados rechazados por la lista de destinos.

Las reproducciones quedan convertidas en 54 pruebas permanentes, todas positivas. CI ejecuta pruebas, Astro/TypeScript, tipos Convex, build y auditoría de dependencias. El [workflow de contratos y retirada de consultas antiguas](https://github.com/PABLOCESAR2412/Eventos-SimCodec/actions/runs/36649509495) completó satisfactoriamente. Las pruebas del modal simulan el evento nativo `cancel`: no equivalen a comprobar el teclado en un navegador real.

No hay navegador habilitado en este entorno, por lo que no se ha comprobado visualmente la interfaz ni con lector de pantalla. Convex sigue informando que el equipo supera límites del plan Free; estos cambios reducen consumo del proyecto, pero no acreditan que la cuota global del equipo se haya recuperado.

Referencia del presupuesto: [PaginationOptions de Convex](https://docs.convex.dev/api/interfaces/server.PaginationOptions).
