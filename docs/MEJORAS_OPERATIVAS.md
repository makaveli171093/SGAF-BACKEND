# Mejoras operativas para NEXORA

Rama: `feat/mejoras-operativas`. Frontend compatible: la rama del mismo nombre de `SGAF_frontend`.

## Cambios de base de datos

Migración aditiva `20261115090000_operational_improvements`:

- `users.avatarData`: imagen pequeña opcional; no aparece en listados de usuarios ni relaciones anidadas.
- `users.tokenVersion`, inicialmente 0: revoca sesiones al cambiar contraseña o estado. Los JWT anteriores sin versión equivalen a 0.
- `audit_events`: administrador/actor, entidad, acción, detalle y fecha. Se registra reapertura, edición administrativa, estado, horarios y cambio de contraseña. No se guardan contraseñas ni fotos en la auditoría.

La migración no borra usuarios, pagos, tareas ni inscripciones. No se ha ejecutado sobre producción.

### Arranque en Render

Render debe conservar `npm run start:prod` como Start Command. Su hook `prestart:prod` ejecuta `npm run migrate:deploy` contra la misma `DATABASE_URL` antes de iniciar Nest. Esto evita servir una versión que consulte columnas todavía inexistentes (P2022). Prisma CLI está en dependencias de producción para que el paso también funcione si se omiten dependencias de desarrollo.

Si la migración falla, el proceso no inicia la API: revisar el error concreto en Render. No se ejecutan `db push`, `migrate reset`, seed ni resoluciones automáticas de historial. Si el historial previo de Prisma no está registrado o la conexión no permite migrar, se debe corregir ese caso antes de volver a desplegar. No hay que crear otra base ni cambiar de proveedor.

## Preparar una base de prueba

Usar un PostgreSQL de prueba separado y las variables requeridas por `src/config/env.validation.ts`. No ejecutar `migrate reset` ni apuntar una prueba destructiva a producción.

```powershell
git fetch origin
git worktree add ..\SGAF-BACKEND-mejoras --track origin/feat/mejoras-operativas
Set-Location ..\SGAF-BACKEND-mejoras
npm ci
# Configurar .env con DATABASE_URL de la base de prueba y las demás variables.
npx prisma generate --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
npm run lint
npm test
npm run build
npm run start:dev
```

Conservar la política de CORS de orígenes exactos, por ejemplo `http://localhost:5173`, sin ruta ni barra final. Si Vite utiliza otro puerto, autorizarlo explícitamente.

## API nueva

Todas las rutas usan el prefijo `/api/v1` y JWT.

| Ruta | Método | Acceso |
|---|---|---|
| `/account/summary` | GET | Cuenta autenticada; resumen según rol |
| `/account/profile` | PATCH | Datos propios: firstName, lastName, email, phone |
| `/account/password` | PATCH | currentPassword, newPassword |
| `/account/avatar` | PATCH | avatarData como data URI PNG/JPEG/WebP, o null |
| `/management/users/:id` | PATCH | ADMIN |
| `/management/users/:id/status` | PATCH | ADMIN; ACTIVE/INACTIVE |
| `/management/subjects/:id` | PATCH | ADMIN |
| `/management/periods/:id/reopen` | PATCH | ADMIN; reason de 10–500 caracteres |
| `/management/periods/:id/history` | GET | ADMIN |
| `/management/groups/:id` | PATCH | ADMIN |
| `/management/schedules` | POST | ADMIN |
| `/management/schedules/:id` | PATCH / DELETE | ADMIN |
| `/management/metrics?from=YYYY-MM-DD&to=YYYY-MM-DD` | GET | ADMIN; rango máximo de 366 días |

El POST existente `/schedule-blocks` utiliza las mismas comprobaciones que el nuevo endpoint. `/groups` devuelve IDs de materia, periodo, docente y bloques para poder editarlos. `/payments/pending-obligations` agrega intentos de pago con campos públicos, sin gatewayResponse.

## Reglas

- Inactivación lógica, sin eliminación de historial. Prohibido auto-inactivarse, dejar al sistema sin administrador activo o saltar el proceso de aprobación de postulantes. Reactivación de estudiantes consulta deuda vencida.
- Mi cuenta no admite rol, estado ni ID de otro usuario. La contraseña actual se verifica; la nueva se cifra y revoca sesiones. Se controla el límite de 72 bytes de bcrypt.
- Avatar limitado a 180.000 caracteres base64, con comprobación de cabecera/MIME. El frontend redimensiona a 256 × 256. Límite JSON: 250 KB. No se admiten SVG ni URLs externas.
- Reapertura: solo CLOSED; rechaza vencidos; futuro → PLANNED, vigente → ACTIVE. Auditoría dentro de la misma transacción.
- Cambiar tarifas no recalcula obligaciones. Créditos con inscripciones se conservan. Grupos con inscripciones o tareas conservan materia y periodo. Capacidad mínima: inscritos activos.
- Cruces: grupo, docente y estudiantes inscritos; días y horas coincidentes en periodos cuyas fechas se solapan. Permite clases contiguas. Los periodos cerrados no se editan.
- Las modificaciones administrativas usan transacciones serializables y devuelven 409 en conflicto concurrente. El cliente debe actualizar antes de repetir.
- Métricas: solo APPROVED y fecha `verfiedAt` (nombre histórico del campo). Hora de Bolivia. Pagos aprobados antiguos sin fecha se excluyen y se reporta su cantidad. Los webhooks de éxito nuevos guardan la fecha de verificación. Deudas y grupos son una fotografía actual y no dependen del filtro financiero.

## Validación y publicación

Pruebas unitarias de reglas, DTO, permisos y revocación con Prisma simulado; más las pruebas existentes. Compilación y lint. Estas pruebas no sustituyen la comprobación con PostgreSQL real ni demuestran el comportamiento concurrente de una base desplegada.

Antes de publicar, aplicar en una base de prueba, comprobar los siete recorridos documentados en el frontend y respaldar la base de producción. Para liberar: migración aditiva → backend → frontend. El frontend anterior sigue usando las rutas existentes. No fusionar ni desplegar la propuesta visual sin revisión del usuario.
