# SGAF — Sistema de Gestión Académica y Financiera

API RESTful desarrollada con NestJS, Prisma y PostgreSQL para centralizar la gestión académica, financiera y de usuarios de una institución educativa.

## 1. Objetivo

SGAF reemplaza procesos manuales basados en papel por una API centralizada que permite gestionar usuarios y roles, postulantes, periodos académicos, materias, grupos, horarios, matrículas, tareas, entregas, obligaciones financieras, pagos y suspensión por mora.

## 2. Tecnologías

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- Passport JWT
- Swagger / OpenAPI
- Joi
- bcrypt
- MockPay
- Render
- Supabase

## 3. Arquitectura

Módulos principales:

- `auth`
- `users`
- `academic-periods`
- `subjects`
- `groups`
- `schedule-blocks`
- `enrollments`
- `assignments`
- `submissions`
- `payments`

La capa de datos utiliza Prisma mediante un `PrismaService` centralizado.

## 4. Roles

### ADMIN
Puede crear usuarios internos, consultar usuarios y gestionar la estructura académica.

### RECEPCIONIST
Puede registrar y verificar pagos manuales, consultar obligaciones pendientes y aprobar postulantes cuando su matrícula está pagada.

### TEACHER
Puede consultar sus grupos, crear tareas en grupos asignados y calificar entregas.

### STUDENT
Puede consultar matrículas, tareas e historial financiero, entregar trabajos y matricularse si cumple las reglas.

## 5. Estados de usuario

- `PENDING_APPROVAL`
- `ACTIVE`
- `SUSPEND_FOR_DEBT`
- `INACTIVE`

Un postulante nace en `PENDING_APPROVAL` y no puede iniciar sesión hasta que Recepción verifique el pago y lo apruebe.

## 6. Reglas de matriculación

Antes de matricular:

1. el periodo debe estar activo;
2. no se puede exceder el máximo de créditos;
3. el grupo debe tener cupo;
4. no se puede cursar la misma materia dos veces en el mismo periodo;
5. no puede existir traslape de horarios;
6. el estudiante no puede tener deuda vencida.

La matrícula se ejecuta en transacción y vuelve a validar condiciones críticas de concurrencia.

Al matricularse se generan obligaciones financieras de inscripción y mensualidad asociadas a la materia.

## 7. Aula virtual

Flujo LMS:

1. el docente crea una tarea;
2. el estudiante matriculado realiza una entrega;
3. el docente registra nota y feedback.

## 8. Finanzas

### Obligaciones
- `ENROLLMENT`
- `MONTHLY_FEE`
- `OTHER`

Estados:
- `PENDING`
- `PAID`
- `OVERDUE`
- `CACELLED`

### Métodos de pago
- `CASH`
- `BANK_TRANSFER`
- `ONLINE`

### Estados de pago
- `PENDING`
- `APPROVED`
- `REJECTED`

Los pagos manuales quedan pendientes hasta ser verificados por Recepción.

- `CASH`: genera recibo interno.
- `BANK_TRANSFER`: requiere comprobante.
- La verificación registra usuario y fecha.

Los pagos online crean una intención en MockPay y guardan la referencia externa.

El webhook:
- valida un token secreto;
- valida referencia externa;
- valida obligación;
- valida monto;
- procesa de forma idempotente;
- actualiza pago y obligación.

## 9. Suspensión por mora

La mora se maneja de forma reactiva.

Antes de operaciones sensibles se ejecuta una sincronización del estado financiero.

Si existe una obligación vencida no pagada:
- el usuario pasa a `SUSPEND_FOR_DEBT`;
- no puede crear matrículas;
- no puede entregar tareas.

Cuando ya no existen deudas vencidas, puede volver a `ACTIVE`.

Mejora futura: scheduler diario.

## 10. GET útiles

### ADMIN
- `GET /api/v1/users`

### Catálogos
- `GET /api/v1/subjects`
- `GET /api/v1/academic-periods`
- `GET /api/v1/groups`

### TEACHER
- `GET /api/v1/groups/my-groups`

### STUDENT
- `GET /api/v1/enrollments/my-enrollments`
- `GET /api/v1/assignments/my-assignments`
- `GET /api/v1/payments/my-history`

### RECEPCIONIST
- `GET /api/v1/payments/pending-obligations`

## 11. Seguridad

- JWT
- guards de roles
- ValidationPipe global
- DTOs con `class-validator`
- bcrypt
- variables sensibles fuera del repositorio
- `select` de Prisma para mínima exposición de datos
- webhook protegido con secreto adicional

## 12. Swagger

Ruta:

`/api/docs`

Swagger documenta roles, finalidad, DTOs, requisitos y autenticación Bearer.

## 13. Base de datos

El modelo cubre:

- usuarios;
- perfiles de estudiantes;
- perfiles de docentes;
- periodos;
- materias;
- grupos;
- horarios;
- matrículas;
- tareas;
- entregas;
- obligaciones financieras;
- pagos.

## 14. Seed de demostración

Incluye:

- ADMIN;
- RECEPCIONIST;
- varios TEACHER;
- varios STUDENT;
- postulante pendiente;
- estudiante suspendido;
- periodos cerrado, activo y planificado;
- materias;
- grupos;
- horarios;
- matrículas;
- tareas;
- entregas calificadas y pendientes;
- obligaciones financieras;
- pagos manuales y online.

## 15. Variables de entorno

```env
DATABASE_URL=
JWT_SECRET=
PORT=
NODE_ENV=
MOCKPAY_API_URL=
MOCKPAY_SECRET_KEY=
MOCKPAY_CURRENCY=
APP_BASE_URL=
MOCKPAY_WEBHOOK_SECRET=
```

Nunca subir secretos reales al repositorio.

## 16. Ejecución local

```bash
npm install
npx prisma generate
npm run build
npm run start:dev
```

Seed:

```bash
npm run seed
```

## 17. Despliegue

- API: Render
- PostgreSQL: Supabase
- Documentación: Swagger

## 18. Limitación externa actual

La nueva pasarela MockPay proporcionada externamente actualmente puede responder `502`.

La integración está desacoplada mediante variables de entorno, por lo que el cambio de endpoint no requiere modificar la lógica de SGAF.

## 19. Mejoras futuras

- scheduler de mora;
- refresh tokens;
- auditoría ampliada;
- soft delete selectivo;
- mensualidades recurrentes automáticas;
- frontend completo;
- reportes académicos y financieros.


## Preparación para el frontend — 9 de noviembre de 2026

El frontend será un repositorio independiente: Vite, React, TypeScript, Tailwind,
Axios, Zustand, React Hook Form y Zod, con rutas protegidas, Custom Hooks y
estados de UI de la malla. Esta revisión no agrega dependencias ni migraciones.

### Conexión

Backend: configurar `CORS_ORIGINS` con orígenes exactos separados por coma,
sin barra final: `http://localhost:5173,https://TU-FRONTEND.vercel.app`.
Sustituir el dominio de ejemplo por el real. Por defecto solo se permite
`http://localhost:5173`.
Frontend: `VITE_API_URL=https://sgaf-backend.onrender.com/api/v1`.
Enviar `Authorization: Bearer <accessToken>`. Los secretos de JWT, base de datos
y MockPay se configuran exclusivamente en el backend.

### Consultas para completar los flujos existentes

| Ruta GET (prefijo /api/v1) | Rol | Respuesta |
| --- | --- | --- |
| /assignments/teacher | TEACHER | `{ message, assignments }` de sus grupos |
| /submissions/assignment/:assignmentId | TEACHER propietario | `{ message, submissions }` |
| /users/applicants/pending | RECEPCIONIST | `{ message, applicants }` con matrícula |
| /payments/manual/pending | RECEPCIONIST | `{ message, payments }` |

Las listas vacías devuelven `[]`. Una tarea ajena produce 403; una inexistente,
404. `GET /users` incluye `teacherProfile.id` para seleccionar al docente.
`POST /users/staff` devuelve identidad pública y perfil. Se conservan los nombres
históricos `tittle`, `stundentProfile` y `RECEPCIONIST`.

### Estados y pagos

La mora solo cambia `ACTIVE` y `SUSPEND_FOR_DEBT`. `PENDING_APPROVAL` requiere
aprobación de Recepción e `INACTIVE` permanece inactivo. El pago online aprobado
sincroniza la mora; repetir su webhook reintenta esa sincronización sin otro pago.
Matrículas y entregas consultan el estado sincronizado antes de continuar.
La mora se evalúa al operar; no hay una tarea programada diaria.
Los nuevos pagos usan `obligation_id` y `student_id`; se aceptan los nombres
históricos en intenciones anteriores y se comprueba cada identificador recibido.

### Validación antes del despliegue

Ejecutar `npm ci`, `npm run build`, `npm test` y `npm run lint`.
Las pruebas unitarias usan datos simulados; no certifican Render, Supabase ni
MockPay. Probar con las variables reales: registro, pago, aprobación, login,
matrícula, tarea, entrega y calificación. Comprobar mora y recuperación tras pago,
permisos entre docentes y CORS desde el dominio publicado del frontend.


## Actualización de mora al acceder — 10 de noviembre de 2026

`POST /api/v1/auth/login` recalcula la mora después de validar credenciales,
solo para estudiantes habilitados. `GET /api/v1/auth/me` devuelve el usuario
público con el estado sincronizado. `GET /api/v1/payments/my-history` conserva
`message` y `financialHistory` y agrega `userStatus` actualizado.

El frontend debe actualizar su usuario en Zustand con `user.status` de login/perfil
y con `userStatus` del historial. Tras un pago confirmado, debe volver a consultar
perfil o historial. El JWT no contiene el estado de mora; no debe inferirse de él.
El suspendido conserva acceso a perfil y pagos; las operaciones académicas siguen
validando en backend. No se agrega una tarea programada: sin consultas u operaciones,
el estado persistido puede permanecer desactualizado hasta el siguiente acceso.

La regla sigue siendo obligación vencida no pagada ni cancelada. El estado
`OVERDUE` de cada obligación no se actualiza en esta revisión; la mora del usuario
se calcula usando fecha de vencimiento y estado. Fechas enviadas con zona horaria
explícita; el corte es el instante `dueDate`, no necesariamente el final del día.

## Activar y cerrar períodos académicos

`PATCH /api/v1/academic-periods/:id/status` requiere JWT y rol `ADMIN`.
El identificador debe ser UUID. El cuerpo admite únicamente:

```json
{ "status": "ACTIVE" }
```

o `{ "status": "CLOSED" }`. Devuelve `{ message, academicPeriod }`;
`academicPeriod` incluye id, name, startDate, endDate, maxCredits y status.

- La creación sigue produciendo `PLANNED`.
- `PLANNED → ACTIVE`: solamente entre startDate y endDate, ambos inclusive.
- `PLANNED → CLOSED` y `ACTIVE → CLOSED`: cierre manual permitido.
- Un período cerrado no se reabre ni se devuelve a planificado.
- Repetir el estado actual devuelve éxito sin modificar datos.
- Un cambio concurrente devuelve 409 y exige consultar de nuevo.
- Cuerpo/UUID inválidos o activación fuera de fechas: 400; sin permisos: 403;
  período inexistente: 404; reapertura de período cerrado: 409.

El frontend debe enviar fechas con zona horaria explícita, solicitar confirmación
antes del cierre y refrescar el listado tras la respuesta. No necesita migración
de base de datos ni variables de entorno nuevas. No hay cierre automático al
vencer las fechas: las inscripciones conservan su validación de estado y vigencia.
Cerrar no borra grupos, inscripciones, entregas ni obligaciones existentes.
Las entregas existentes conservan las reglas actuales (inscripción activa, mora
y plazo de tarea); este endpoint no añade un bloqueo de entregas por período.
