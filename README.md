# Museos Lobería

Inventario de piezas de los museos de Ciencias Naturales e Historia de Lobería.

## Cómo levantarlo

```powershell
npm run install:all
npm run migrate --prefix backend
npm run dev
```

El backend necesita un `backend/.env` con la base de datos (`DB_*`), `JWT_SECRET`, `FRONTEND_URL` y el SMTP (`SMTP_*`).

## Cómo funciona

- **Cuentas por museo:** cada cuenta pertenece a un solo museo y solo ve ese inventario.
- **Registro:** la cuenta nueva queda pendiente. Para entrar, el usuario tiene que verificar su email y el encargado del museo tiene que aprobarla.
- **Aprobación por consola (temporal):** los encargados todavía no tienen un email real (`administrador+...@gmail.com`),
  así que con `APROBACIONES_POR_CONSOLA=true` en `backend/.env` el enlace de aprobación sale en la consola del backend en vez de mandarse por email.
  Se abre ese enlace con la sesión iniciada como encargado del museo. Cuando los encargados tengan un email verdadero, poner `false`.
- **Encargados iniciales:** `$env:ADMIN_PASSWORD='...'; npm run crear-cuentas-base --prefix backend` crea un encargado por museo.
- **Auditoría:** cada alta, edición o eliminación de una pieza queda guardada en la tabla `auditoria_piezas` (quién, qué y cuándo).
  Encargados y admins la ven en el menú **Historial de cambios**.

## Tests

```powershell
$env:PG_BIN = 'C:\Program Files\PostgreSQL\18\bin'
npm test --prefix backend
```
