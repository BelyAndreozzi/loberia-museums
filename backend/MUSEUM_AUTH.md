# Acceso por museo

- Ciencias Naturales: `/login/ciencias-naturales` y `/registro/ciencias-naturales`.
- Museo Histórico: `/login/historia` y `/registro/historia`.
- `/login` permite elegir museo. `/registro` exige elegirlo explícitamente, sin selección predeterminada.
- Inicio enlaza al login específico. Cada formulario identifica museo con nombre y logo.
- Login API exige `museo_id` (1 o 2, número o string). Museo omitido o inválido: 400.
  Email, contraseña y museo deben corresponder a la misma cuenta; error genérico 401, incluso para admin/encargado.
- Una sesión activa en otro museo da 409 y conserva su pertenencia. Para ingresar a otra cuenta, cerrar sesión primero.
- Dashboard verifica contexto antes de montar inventario y cargar datos; cambiar la URL no cambia museo de la sesión.
  Backend continúa tomando museo de la cuenta en DB, nunca de IDs arbitrarios del cliente.
- Se mantienen emails únicos y una pertenencia por cuenta. Registro no asigna roles privilegiados.
- Gestión de usuarios solo lista cuentas del museo de la sesión; encargado solo puede cambiar roles dentro de ese museo.
  Un ID de otro museo da 404. Enviar `museo_id` en query/body no altera el alcance.
- Rate limit conserva contadores por IP/email compartidos entre museos: cambiar museo no renueva el cupo.

No hay migración ni modificación de cuentas existentes. Desplegar backend y frontend juntos:
clientes antiguos deben enviar `museo_id` para iniciar sesión. Rollback de código posible sin tocar datos;
restaurar la versión anterior del login también quitaría la nueva restricción, por lo que requiere decisión explícita.

Pruebas PostgreSQL aisladas: ambos museos, credenciales válidas en museo incorrecto, roles privilegiados,
sesión previa de otro museo, museo faltante/manipulado y pertenencia persistida en registro.
