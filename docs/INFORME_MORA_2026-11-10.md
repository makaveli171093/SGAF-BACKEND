# SGAF: cierre de correcciones y actualización de mora

Fecha: 10 de noviembre de 2026.

## Resultado

La mora se sincroniza al iniciar sesión y consultar perfil o historial financiero.
Se reutiliza PaymentsService.syncStudentDebtStatus. No se añadieron dependencias,
migraciones, tablas, servicios externos ni tareas programadas. Frontend no iniciado.

## Versiones comparadas

- Original: 78d16c5, anterior a nuestras correcciones.
- Correcciones previas: 49553ed (pagos, estados, CORS, consultas y personal).
- Cupos: 2f945c7 en GitHub (solo matrículas activas).
- Esta revisión: login, perfil e historial actualizan mora antes de responder.

## Archivos de esta revisión

| Archivo | Código o cambio puntual |
| --- | --- |
| src/auth/auth.module.ts | Importa PaymentsModule para inyectar PaymentsService. |
| src/auth/auth.service.ts | Inyecta PaymentsService; login llama getCurrentStatus después de validar credenciales; agrega getProfile y getCurrentStatus. |
| src/auth/auth.controller.ts | GET me delega a AuthService.getProfile; tipa el identificador del usuario y actualiza Swagger. |
| src/payments/payments.service.ts | getMyFinancialHistory invoca syncStudentDebtStatus y devuelve userStatus. |
| src/payments/payments.controller.ts | Documenta userStatus y sincronización en Swagger. |
| src/auth/auth.service.spec.ts | Archivo nuevo: 12 pruebas de login/perfil, estados, roles y errores. |
| src/payments/payments.service.spec.ts | Dos pruebas nuevas del estado devuelto por historial. |
| README.md | Contrato para el frontend y límites de la actualización. |
| docs/INFORME_MORA_2026-11-10.md | Este informe técnico. |

## Comportamiento exacto

1. Login valida correo, contraseña y estados no habilitados. Para STUDENT busca
su perfil y sincroniza deuda antes de emitir token y devolver user.status.
2. Perfil sigue protegido por JwtAuthGuard. Consulta campos públicos, sincroniza
si es estudiante y devuelve { user }. Agrega phone al usar publicUserSelect.
3. Historial sigue protegido por JWT y rol STUDENT. Sincroniza primero, consulta
sus obligaciones y devuelve { message, financialHistory, userStatus }.
4. ADMIN, TEACHER y RECEPCIONIST no pasan por el cálculo de mora de AuthService.
5. INACTIVE y PENDING_APPROVAL siguen bloqueados; el pago no los habilita.
6. SUSPEND_FOR_DEBT puede iniciar sesión y consultar finanzas, pero matrícula y
entrega vuelven a comprobar autorización y deuda.

## Correcciones anteriores que se conservan

- main.ts y config/env.validation.ts: CORS por orígenes exactos configurables.
- payments.service.ts: sincronización después del pago online; protección de
estados administrativos; compatibilidad y validación de metadatos históricos;
consulta de pagos manuales pendientes.
- enrollments.service.ts y submissions.service.ts: comprueban estado sincronizado.
- assignments y submissions: consultas docentes y control de propiedad.
- users: respuesta pública correcta al crear personal; identificador del perfil
docente y consulta de postulantes pendientes para Recepción.
- groups.service.ts: los dos conteos de matrículas usan
`enrollments: { where: { status: 'ACTIVE' } }`.

## Código exacto de esta revisión

El siguiente diff compara contra la copia previa con cupos corregidos. Las líneas
con + se agregaron; las líneas con - se reemplazaron. No incluye el código de tests.

```diff
diff --git a/src/auth/auth.controller.ts b/src/auth/auth.controller.ts
index b062cb2..3fb99ac 100644
--- a/src/auth/auth.controller.ts
+++ b/src/auth/auth.controller.ts
@@ -16,15 +16,13 @@ export class AuthController {
   @ApiOperation({
     summary: 'Consultar usuario autenticado',
     description:
-      'Uso: usuario autenticado. Devuelve los datos del usuario identificado por el JWT. Sirve para comprobar sesión, rol y estado actual.',
+      'Uso: usuario autenticado. Devuelve los datos del usuario identificado por el JWT. Actualiza la mora del estudiante antes de devolver su estado; el suspendido conserva acceso al perfil y a finanzas.',
   })
   @Get('me')
   @UseGuards(JwtAuthGuard)
   @ApiBearerAuth()
-  getProfile(@Req() req: any) {
-    return {
-      user: req.user,
-    };
+  getProfile(@Req() req: { user: { id: string } }) {
+    return this.authService.getProfile(req.user.id);
   }
 
   @ApiOperation({
diff --git a/src/auth/auth.module.ts b/src/auth/auth.module.ts
index f5cc48a..3ed1ca0 100644
--- a/src/auth/auth.module.ts
+++ b/src/auth/auth.module.ts
@@ -2,10 +2,11 @@ import { Module } from '@nestjs/common';
 import { JwtModule } from '@nestjs/jwt';
 import { AuthController } from './auth.controller.js';
 import { AuthService } from './auth.service.js';
+import { PaymentsModule } from '../payments/payments.module.js';
 import { JwtStrategy } from './strategies/jwt.strategy.js';
 
 @Module({
-  imports: [JwtModule.register({})],
+  imports: [JwtModule.register({}), PaymentsModule],
   controllers: [AuthController],
   providers: [AuthService, JwtStrategy],
 })
diff --git a/src/auth/auth.service.ts b/src/auth/auth.service.ts
index 0511eba..4f77b4d 100644
--- a/src/auth/auth.service.ts
+++ b/src/auth/auth.service.ts
@@ -10,6 +10,9 @@ import bcrypt from 'bcrypt';
 import crypto from 'node:crypto';
 import { ConfigService } from '@nestjs/config';
 import { JwtService } from '@nestjs/jwt';
+import { PaymentsService } from '../payments/payments.service.js';
+import { publicUserSelect } from '../common/selects/user-public.select.js';
+import { Role, UserStatus } from '../generated/prisma/enums.js';
 import { LoginDto } from './dto/login.dto.js';
 import {
   ObligationStatus,
@@ -22,6 +25,7 @@ export class AuthService {
     private readonly prisma: PrismaService,
     private readonly jwtService: JwtService,
     private readonly configService: ConfigService,
+    private readonly paymentsService: PaymentsService,
   ) {}
 
   async registerStudent(dto: RegisterStudentDto) {
@@ -132,6 +136,8 @@ export class AuthService {
     if (user.status === 'INACTIVE') {
       throw new ForbiddenException('La cuenta esta inactiva');
     }
+    user.status = await this.getCurrentStatus(user);
+
     const payload = {
       sub: user.id,
       role: user.role,
@@ -157,6 +163,48 @@ export class AuthService {
     };
   }
 
+  async getProfile(userId: string) {
+    const user = await this.prisma.user.findUnique({
+      where: { id: userId },
+      select: publicUserSelect,
+    });
+    if (!user) throw new UnauthorizedException('Usuario no encontrado');
+    user.status = await this.getCurrentStatus(user);
+    return { user };
+  }
+
+  private async getCurrentStatus(user: {
+    id: string;
+    role: Role;
+    status: UserStatus;
+  }) {
+    if (
+      user.status === UserStatus.PENDING_APPROVAL ||
+      user.status === UserStatus.INACTIVE
+    ) {
+      throw new ForbiddenException('Usuario sin acceso al sistema');
+    }
+    if (user.role !== Role.STUDENT) return user.status;
+
+    const student = await this.prisma.studentProfile.findUnique({
+      where: { userId: user.id },
+      select: { id: true },
+    });
+    if (!student)
+      throw new ForbiddenException('El usuario no tiene perfil de estudiante');
+
+    const { status } = await this.paymentsService.syncStudentDebtStatus(
+      student.id,
+    );
+    if (
+      status === UserStatus.PENDING_APPROVAL ||
+      status === UserStatus.INACTIVE
+    ) {
+      throw new ForbiddenException('Usuario sin acceso al sistema');
+    }
+    return status;
+  }
+
   private generateEnrollmentCode(): string {
     const year = new Date().getFullYear();
     const random = crypto.randomUUID().split('-')[0].toUpperCase();
diff --git a/src/payments/payments.controller.ts b/src/payments/payments.controller.ts
index b5f2ef9..9e5fc07 100644
--- a/src/payments/payments.controller.ts
+++ b/src/payments/payments.controller.ts
@@ -31,7 +31,7 @@ export class PaymentsController {
   @ApiOperation({
     summary: 'Consultar historial financiero propio',
     description:
-      'Uso: STUDENT autenticado. Devuelve todas sus obligaciones financieras y los pagos asociados a cada una, incluyendo intentos aprobados, rechazados o pendientes.',
+      'Uso: STUDENT autenticado. Devuelve todas sus obligaciones financieras y los pagos asociados a cada una, incluyendo intentos aprobados, rechazados o pendientes. Sincroniza la mora y devuelve userStatus actualizado.',
   })
   @Get('my-history')
   @ApiBearerAuth()
diff --git a/src/payments/payments.service.ts b/src/payments/payments.service.ts
index d190fba..311ede6 100644
--- a/src/payments/payments.service.ts
+++ b/src/payments/payments.service.ts
@@ -594,6 +594,8 @@ export class PaymentsService {
       );
     }
 
+    const { status: userStatus } = await this.syncStudentDebtStatus(student.id);
+
     const obligations = await this.prisma.financialObligation.findMany({
       where: {
         studentId: student.id,
@@ -613,6 +615,7 @@ export class PaymentsService {
     return {
       message: 'Historial financiero obtenido correctamente',
       financialHistory: obligations,
+      userStatus,
     };
   }
 
```

## Validación

- npm run build: correcto.
- npm test: 46 pruebas aprobadas en 7 archivos (32 anteriores + 14 nuevas).
- npm run lint: correcto.
- git diff --check: correcto.
- Pruebas unitarias con servicios y datos simulados. No se ejecutó una prueba
integrada contra PostgreSQL, Render o MockPay en esta revisión.

## Límites y siguiente paso

No es actualización por reloj: si nadie accede, el estado guardado no cambia en
el instante del vencimiento. El bloqueo sí se comprueba antes de operar.
Se actualiza User.status, no cada FinancialObligation.status a OVERDUE.
La regla de fecha conserva dueDate < ahora; no se cambia la política de vencimiento.
Los conteos de cupos no constituyen una garantía nueva ante inscripciones simultáneas.

Antes del frontend: integrar la rama revisada, desplegar y probar login/perfil/
historial con estudiante al día, con mora y regularizado; probar pago real simulado
en MockPay con URL pública. Configurar CORS_ORIGINS con el dominio del frontend.
El frontend se limitará a la malla: Vite, React, TypeScript, Tailwind, Axios,
Zustand, React Hook Form, Zod, rutas protegidas y los temas ya revisados.
