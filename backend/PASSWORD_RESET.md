# Recuperación de contraseña

## Instalación

1. Hacer backup de PostgreSQL según el procedimiento del entorno.
2. Sobre una base con el esquema existente, ejecutar desde la raíz `npm run migrate --prefix backend`.
   Migración aditiva, transaccional, registrada en `schema_migrations`, protegida contra ejecuciones simultáneas.
   No ejecutar `schema.sql` sobre producción: contiene cambios de constraints preexistentes.
3. Configurar `FRONTEND_URL` como origen exacto (sin barra final, ruta ni parámetros), HTTPS en producción.
   Configurar `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` y `JWT_SECRET` en el entorno.
   SMTP requiere TLS. Nunca usar secretos de ejemplo.
4. Desplegar backend y frontend. Verificar con una cuenta de prueba verificada y un buzón controlado.

La migración debe preceder al nuevo backend. No se ejecuta automáticamente al iniciar.

## Comportamiento y seguridad

- Login enlaza a `/olvide-password`; el correo enlaza a `/restablecer-password#email=...&token=...`.
  Fragmento evita exponer token/email en logs HTTP y Referer. No registrar cuerpos de estas rutas ni capturar URL completa con analítica.
- Token aleatorio de 256 bits, SHA-256 persistido, 30 minutos, uso único persistido. Un pedido nuevo reemplaza el anterior.
- Solo cuentas verificadas. Coinciden email normalizado del enlace, email del token y email actual de la cuenta.
- Respuesta genérica antes de consultar la cuenta/enviar correo. Envío SMTP ocurre en el proceso, después de responder;
  un reinicio puede perder un envío pendiente: solicitar otro enlace. Fallo SMTP invalida ese token y registra auditoría.
- Límites compartidos en PostgreSQL, ventanas de 15 minutos: solicitud 10/IP y 3/email; cambio 20/IP y 5/token.
  IP/email se guardan como HMAC. No se confía en `X-Forwarded-For`. Detrás de proxy, configurar solo proxies conocidos
  antes de habilitar `trust proxy`; por defecto los clientes comparten el límite de la IP del proxy.
- Cambio y consumo del token son una transacción, con bloqueo por usuario. Incrementar `session_version`
  invalida sesiones anteriores, incluso emisiones simultáneas con datos previos. No cambia rol, museo ni verificación.
- Auditoría persistida: solicitud, cambio exitoso y fallo de correo; nunca passwords ni tokens.
- Tablas de límites/auditoría necesitan política de retención operativa; no hay borrado automático agregado.

## Límites de login y registro

Misma tabla `auth_rate_limits` y servicio compartido; no hay migración adicional.
Requiere haber aplicado `001_password_reset.sql` con `npm run migrate --prefix backend`.

| Ruta | Intentos por IP | Intentos por email | Ventana |
| --- | --- | --- | --- |
| `/api/auth/login` | 20 | 5 | 15 minutos |
| `/api/auth/register` | 5 | 3 | 15 minutos |

Se cuentan solicitudes exitosas, fallidas y datos inválidos por IP. Email válido se normaliza con trim/minúsculas,
sin consultar si existe la cuenta. Email comparte límite entre IPs; cada ruta tiene contadores independientes.
El bloqueo es temporal y no cambia usuarios, roles ni museos. Solicitudes bloqueadas no alargan la ventana.
Los límites actúan antes de bcrypt, creación de sesiones/cuentas y envío SMTP.
Respuesta `429` genérica con `Retry-After: 900`; si falla el almacenamiento, `503` sin continuar autenticación.
Un atacante puede agotar temporalmente el cupo de un email conocido; no hay bloqueo permanente de cuenta.
Mantener la configuración restrictiva de proxies descrita arriba.

Rollback de este agregado: revertir solo el middleware conectado a login/registro. Conservar servicio compartido,
tabla y controles de recuperación; sin cambios ni borrado de datos.

## Rollback

Si falla la migración, PostgreSQL revierte toda la transacción. Conservar copia de la versión anterior para rollback de código.
Para retirar la funcionalidad, revertir rutas/pantallas de recuperación manteniendo las comprobaciones `session_version`
en login, refresh y middleware. Conservar tablas/columnas: no necesitan borrarse.
**No volver al middleware antiguo sin invalidar previamente todas las sesiones**: ignoraría la revocación por versión.
Un rollback completo requiere mantenimiento y autorización explícita para invalidación global; no hay script destructivo.

## Verificación

`npm test --prefix backend`: validadores; integración omitida si no se define `PG_BIN`.
Para integración completa en PowerShell:

```powershell
$env:PG_BIN = 'C:\Program Files\PostgreSQL\18\bin'
npm test --prefix backend
```

El test inicia y detiene su propia instancia PostgreSQL en un puerto local libre, dentro de una carpeta temporal.
No usa la base de la aplicación ni envía correos reales; SMTP está simulado. Conserva archivos temporales, sin borrarlos.
Verifica migración dos veces, email/token incorrectos, token vencido/reemplazado/reutilizado, cuentas de otro museo,
dos cambios simultáneos (solo uno exitoso), rollback por fallo de auditoría, revocación de sesiones, login y renovación,
SMTP fallido y límites concurrentes. Son pruebas con el motor real, no mocks de SQL.

`npm run build --prefix frontend`: TypeScript y build de producción.
Antes de producción, verificar recepción SMTP real y recorrido visual en navegador, además de configurar cabeceras
CSP/HSTS/frame-ancestors en el servidor que publica el frontend. El backend Express solo sirve la API.
