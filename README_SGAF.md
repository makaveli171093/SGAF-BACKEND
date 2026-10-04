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
