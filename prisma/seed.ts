import 'dotenv/config';

import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  AcademicPeriodStatus,
  DayOfWeek,
  EnrollmentStatus,
  ObligationStatus,
  ObligationType,
  PaymentMethod,
  PaymentStatus,
  Role,
  UserStatus,
} from '../src/generated/prisma/enums.js';

async function main() {
  console.log('Iniciando seed SGAF robusto...');

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });

  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await bcrypt.hash('Clave123', 10);
    console.log('Conexión a base de datos correcta');

    // =========================================================
    // 1. USUARIOS
    // =========================================================

    const admin = await prisma.user.upsert({
      where: { email: 'admin@sgaf.com' },
      update: {
        firstName: 'Admin',
        lastName: 'SGAF',
        phone: '70000001',
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
      create: {
        email: 'admin@sgaf.com',
        ci: '9000001',
        passwordHash,
        firstName: 'Admin',
        lastName: 'SGAF',
        phone: '70000001',
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    const receptionist = await prisma.user.upsert({
      where: { email: 'recepcion@sgaf.com' },
      update: {
        firstName: 'Recepción',
        lastName: 'SGAF',
        phone: '70000002',
        role: Role.RECEPCIONIST,
        status: UserStatus.ACTIVE,
      },
      create: {
        email: 'recepcion@sgaf.com',
        ci: '9000002',
        passwordHash,
        firstName: 'Recepción',
        lastName: 'SGAF',
        phone: '70000002',
        role: Role.RECEPCIONIST,
        status: UserStatus.ACTIVE,
      },
    });

    const teacherUsers = [];

    const teacherData = [
      {
        email: 'docente@sgaf.com',
        ci: '9000003',
        firstName: 'Carlos',
        lastName: 'Mendoza',
        phone: '71000001',
        specialty: 'Ingeniería de Software',
        hireDate: new Date('2024-02-01'),
      },
      {
        email: 'docente2@sgaf.com',
        ci: '9000007',
        firstName: 'Patricia',
        lastName: 'Rojas',
        phone: '71000002',
        specialty: 'Bases de Datos',
        hireDate: new Date('2023-03-15'),
      },
      {
        email: 'docente3@sgaf.com',
        ci: '9000008',
        firstName: 'Miguel',
        lastName: 'Quispe',
        phone: '71000003',
        specialty: 'Redes y Sistemas',
        hireDate: new Date('2025-01-10'),
      },
    ];

    for (const data of teacherData) {
      const user = await prisma.user.upsert({
        where: { email: data.email },
        update: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: Role.TEACHER,
          status: UserStatus.ACTIVE,
        },
        create: {
          email: data.email,
          ci: data.ci,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: Role.TEACHER,
          status: UserStatus.ACTIVE,
        },
      });

      const profile = await prisma.teacherProfile.upsert({
        where: { userId: user.id },
        update: {
          specialty: data.specialty,
          hireDate: data.hireDate,
        },
        create: {
          userId: user.id,
          specialty: data.specialty,
          hireDate: data.hireDate,
        },
      });

      teacherUsers.push({ user, profile });
    }

    const studentData = [
      {
        email: 'estudiante@sgaf.com',
        ci: '9000004',
        firstName: 'Ana',
        lastName: 'Flores',
        phone: '72000001',
        enrollmentCode: 'EST-2026-0001',
        guardianName: 'María Flores',
        guardianPhone: '73000001',
        guardianCi: '8000001',
      },
      {
        email: 'estudiante2@sgaf.com',
        ci: '9000009',
        firstName: 'Diego',
        lastName: 'Vargas',
        phone: '72000002',
        enrollmentCode: 'EST-2026-0004',
        guardianName: 'José Vargas',
        guardianPhone: '73000002',
        guardianCi: '8000004',
      },
      {
        email: 'estudiante3@sgaf.com',
        ci: '9000010',
        firstName: 'Lucía',
        lastName: 'Paredes',
        phone: '72000003',
        enrollmentCode: 'EST-2026-0005',
        guardianName: 'Elena Paredes',
        guardianPhone: '73000003',
        guardianCi: '8000005',
      },
      {
        email: 'estudiante4@sgaf.com',
        ci: '9000011',
        firstName: 'Mateo',
        lastName: 'Choque',
        phone: '72000004',
        enrollmentCode: 'EST-2026-0006',
        guardianName: 'Rosa Choque',
        guardianPhone: '73000004',
        guardianCi: '8000006',
      },
    ];

    const activeStudents = [];

    for (const data of studentData) {
      const user = await prisma.user.upsert({
        where: { email: data.email },
        update: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: Role.STUDENT,
          status: UserStatus.ACTIVE,
        },
        create: {
          email: data.email,
          ci: data.ci,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: Role.STUDENT,
          status: UserStatus.ACTIVE,
        },
      });

      const profile = await prisma.studentProfile.upsert({
        where: { userId: user.id },
        update: {
          enrollmentCode: data.enrollmentCode,
          guardianName: data.guardianName,
          guardianPhone: data.guardianPhone,
          guardianCi: data.guardianCi,
        },
        create: {
          userId: user.id,
          enrollmentCode: data.enrollmentCode,
          guardianName: data.guardianName,
          guardianPhone: data.guardianPhone,
          guardianCi: data.guardianCi,
        },
      });

      activeStudents.push({ user, profile });
    }

    const applicantUser = await prisma.user.upsert({
      where: { email: 'postulante@sgaf.com' },
      update: {
        firstName: 'Luis',
        lastName: 'Postulante',
        phone: '72000005',
        role: Role.STUDENT,
        status: UserStatus.PENDING_APPROVAL,
      },
      create: {
        email: 'postulante@sgaf.com',
        ci: '9000005',
        passwordHash,
        firstName: 'Luis',
        lastName: 'Postulante',
        phone: '72000005',
        role: Role.STUDENT,
        status: UserStatus.PENDING_APPROVAL,
      },
    });

    const applicantStudent = await prisma.studentProfile.upsert({
      where: { userId: applicantUser.id },
      update: {
        enrollmentCode: 'EST-2026-0002',
        guardianName: 'Tutor Luis',
        guardianPhone: '73000005',
        guardianCi: '8000002',
      },
      create: {
        userId: applicantUser.id,
        enrollmentCode: 'EST-2026-0002',
        guardianName: 'Tutor Luis',
        guardianPhone: '73000005',
        guardianCi: '8000002',
      },
    });

    const suspendedUser = await prisma.user.upsert({
      where: { email: 'suspendido@sgaf.com' },
      update: {
        firstName: 'María',
        lastName: 'Suspendida',
        phone: '72000006',
        role: Role.STUDENT,
        status: UserStatus.SUSPEND_FOR_DEBT,
      },
      create: {
        email: 'suspendido@sgaf.com',
        ci: '9000006',
        passwordHash,
        firstName: 'María',
        lastName: 'Suspendida',
        phone: '72000006',
        role: Role.STUDENT,
        status: UserStatus.SUSPEND_FOR_DEBT,
      },
    });

    const suspendedStudent = await prisma.studentProfile.upsert({
      where: { userId: suspendedUser.id },
      update: {
        enrollmentCode: 'EST-2026-0003',
        guardianName: 'Tutor María',
        guardianPhone: '73000006',
        guardianCi: '8000003',
      },
      create: {
        userId: suspendedUser.id,
        enrollmentCode: 'EST-2026-0003',
        guardianName: 'Tutor María',
        guardianPhone: '73000006',
        guardianCi: '8000003',
      },
    });

    console.log('Usuarios y perfiles creados');

    // =========================================================
    // 2. PERIODOS ACADÉMICOS
    // =========================================================

    async function ensurePeriod(
      name: string,
      startDate: Date,
      endDate: Date,
      maxCredits: number,
      status: AcademicPeriodStatus,
    ) {
      const existing = await prisma.academicPeriod.findFirst({
        where: { name },
      });

      if (existing) {
        return prisma.academicPeriod.update({
          where: { id: existing.id },
          data: { startDate, endDate, maxCredits, status },
        });
      }

      return prisma.academicPeriod.create({
        data: { name, startDate, endDate, maxCredits, status },
      });
    }

    const closedPeriod = await ensurePeriod(
      'Gestión 2025',
      new Date('2025-02-01'),
      new Date('2025-11-30'),
      24,
      AcademicPeriodStatus.CLOSED,
    );

    const activePeriod = await ensurePeriod(
      'Gestión 2026',
      new Date('2026-02-01'),
      new Date('2026-11-30'),
      24,
      AcademicPeriodStatus.ACTIVE,
    );

    const plannedPeriod = await ensurePeriod(
      'Gestión 2027',
      new Date('2027-02-01'),
      new Date('2027-11-30'),
      24,
      AcademicPeriodStatus.PLANNED,
    );

    console.log('Periodos académicos creados');

    // =========================================================
    // 3. MATERIAS
    // =========================================================

    const programmingSubject = await prisma.subject.upsert({
      where: { code: 'PROG-101' },
      update: {
        name: 'Programación I',
        credits: 6,
        enrollmentFee: 200,
        monthlyFee: 350,
        active: true,
      },
      create: {
        code: 'PROG-101',
        name: 'Programación I',
        credits: 6,
        enrollmentFee: 200,
        monthlyFee: 350,
        active: true,
      },
    });

    const databaseSubject = await prisma.subject.upsert({
      where: { code: 'BD-101' },
      update: {
        name: 'Base de Datos I',
        credits: 6,
        enrollmentFee: 200,
        monthlyFee: 350,
        active: true,
      },
      create: {
        code: 'BD-101',
        name: 'Base de Datos I',
        credits: 6,
        enrollmentFee: 200,
        monthlyFee: 350,
        active: true,
      },
    });

    const networksSubject = await prisma.subject.upsert({
      where: { code: 'RED-101' },
      update: {
        name: 'Redes I',
        credits: 5,
        enrollmentFee: 180,
        monthlyFee: 320,
        active: true,
      },
      create: {
        code: 'RED-101',
        name: 'Redes I',
        credits: 5,
        enrollmentFee: 180,
        monthlyFee: 320,
        active: true,
      },
    });

    const webSubject = await prisma.subject.upsert({
      where: { code: 'WEB-201' },
      update: {
        name: 'Desarrollo Web',
        credits: 5,
        enrollmentFee: 220,
        monthlyFee: 380,
        active: true,
      },
      create: {
        code: 'WEB-201',
        name: 'Desarrollo Web',
        credits: 5,
        enrollmentFee: 220,
        monthlyFee: 380,
        active: true,
      },
    });

    console.log('Materias creadas');

    // =========================================================
    // 4. GRUPOS
    // =========================================================

    async function ensureGroup(
      name: string,
      subjectId: string,
      academicPeriodId: string,
      teacherId: string,
      maxCapacity = 30,
    ) {
      const existing = await prisma.group.findFirst({
        where: { name, subjectId, academicPeriodId },
      });

      if (existing) {
        return prisma.group.update({
          where: { id: existing.id },
          data: { teacherId, maxCapacity },
        });
      }

      return prisma.group.create({
        data: {
          name,
          subjectId,
          academicPeriodId,
          teacherId,
          maxCapacity,
        },
      });
    }

    const progA = await ensureGroup(
      'A',
      programmingSubject.id,
      activePeriod.id,
      teacherUsers[0].profile.id,
    );

    const progB = await ensureGroup(
      'B',
      programmingSubject.id,
      activePeriod.id,
      teacherUsers[0].profile.id,
      25,
    );

    const dbA = await ensureGroup(
      'A',
      databaseSubject.id,
      activePeriod.id,
      teacherUsers[1].profile.id,
    );

    const redA = await ensureGroup(
      'A',
      networksSubject.id,
      activePeriod.id,
      teacherUsers[2].profile.id,
    );

    const webA = await ensureGroup(
      'A',
      webSubject.id,
      activePeriod.id,
      teacherUsers[0].profile.id,
    );

    const webB = await ensureGroup(
      'B',
      webSubject.id,
      activePeriod.id,
      teacherUsers[1].profile.id,
      20,
    );

    // Un grupo histórico y uno planificado para enriquecer GET /groups.
    await ensureGroup(
      'A',
      programmingSubject.id,
      closedPeriod.id,
      teacherUsers[0].profile.id,
    );

    await ensureGroup(
      'A',
      databaseSubject.id,
      plannedPeriod.id,
      teacherUsers[1].profile.id,
    );

    // =========================================================
    // 5. HORARIOS
    // =========================================================

    async function ensureSchedule(
      groupId: string,
      dayOfWeek: DayOfWeek,
      start: string,
      end: string,
    ) {
      const startTime = new Date(`1970-01-01T${start}:00.000Z`);
      const endTime = new Date(`1970-01-01T${end}:00.000Z`);

      const existing = await prisma.scheduleBlock.findFirst({
        where: {
          groupId,
          dayOfWeek,
          startTime,
        },
      });

      if (existing) {
        return prisma.scheduleBlock.update({
          where: { id: existing.id },
          data: { endTime },
        });
      }

      return prisma.scheduleBlock.create({
        data: {
          groupId,
          dayOfWeek,
          startTime,
          endTime,
        },
      });
    }

    await ensureSchedule(progA.id, DayOfWeek.MONDAY, '08:00', '10:00');
    await ensureSchedule(progA.id, DayOfWeek.WEDNESDAY, '08:00', '10:00');

    await ensureSchedule(progB.id, DayOfWeek.TUESDAY, '14:00', '16:00');
    await ensureSchedule(progB.id, DayOfWeek.THURSDAY, '14:00', '16:00');

    await ensureSchedule(dbA.id, DayOfWeek.TUESDAY, '08:00', '10:00');
    await ensureSchedule(dbA.id, DayOfWeek.THURSDAY, '08:00', '10:00');

    await ensureSchedule(redA.id, DayOfWeek.MONDAY, '10:00', '12:00');
    await ensureSchedule(redA.id, DayOfWeek.WEDNESDAY, '10:00', '12:00');

    await ensureSchedule(webA.id, DayOfWeek.FRIDAY, '08:00', '10:00');
    await ensureSchedule(webB.id, DayOfWeek.FRIDAY, '10:00', '12:00');

    console.log('Grupos y horarios creados');

    // =========================================================
    // 6. MATRÍCULAS
    // =========================================================

    async function ensureEnrollment(studentId: string, groupId: string) {
      const existing = await prisma.enrollment.findFirst({
        where: { studentId, groupId },
      });

      if (existing) {
        return prisma.enrollment.update({
          where: { id: existing.id },
          data: { status: EnrollmentStatus.ACTIVE },
        });
      }

      return prisma.enrollment.create({
        data: {
          studentId,
          groupId,
          status: EnrollmentStatus.ACTIVE,
        },
      });
    }

    // Ana: 3 materias
    await ensureEnrollment(activeStudents[0].profile.id, progA.id);
    await ensureEnrollment(activeStudents[0].profile.id, dbA.id);
    await ensureEnrollment(activeStudents[0].profile.id, redA.id);

    // Diego: 3 materias
    await ensureEnrollment(activeStudents[1].profile.id, progB.id);
    await ensureEnrollment(activeStudents[1].profile.id, dbA.id);
    await ensureEnrollment(activeStudents[1].profile.id, webA.id);

    // Lucía: 2 materias
    await ensureEnrollment(activeStudents[2].profile.id, progA.id);
    await ensureEnrollment(activeStudents[2].profile.id, webA.id);

    // Mateo: 2 materias
    await ensureEnrollment(activeStudents[3].profile.id, redA.id);
    await ensureEnrollment(activeStudents[3].profile.id, webB.id);

    console.log('Matrículas de demostración creadas');

    // =========================================================
    // 7. TAREAS
    // =========================================================

    async function ensureAssignment(
      groupId: string,
      tittle: string,
      instructions: string,
      dueDate: Date,
    ) {
      const existing = await prisma.assignment.findFirst({
        where: { groupId, tittle },
      });

      if (existing) {
        return prisma.assignment.update({
          where: { id: existing.id },
          data: { instructions, dueDate },
        });
      }

      return prisma.assignment.create({
        data: { groupId, tittle, instructions, dueDate },
      });
    }

    const now = new Date();

    const datePlusDays = (days: number) => {
      const date = new Date(now);
      date.setDate(date.getDate() + days);
      return date;
    };

    const progAssignment1 = await ensureAssignment(
      progA.id,
      'API REST con NestJS',
      'Construir una API REST con módulos, DTOs y validaciones.',
      datePlusDays(10),
    );

    const progAssignment2 = await ensureAssignment(
      progA.id,
      'Autenticación JWT',
      'Implementar autenticación y autorización basada en roles.',
      datePlusDays(20),
    );

    const dbAssignment = await ensureAssignment(
      dbA.id,
      'Modelo relacional',
      'Diseñar un modelo relacional normalizado con claves primarias y foráneas.',
      datePlusDays(12),
    );

    const redAssignment = await ensureAssignment(
      redA.id,
      'Diseño de red',
      'Proponer una topología de red y justificar los equipos utilizados.',
      datePlusDays(14),
    );

    const webAssignment = await ensureAssignment(
      webA.id,
      'Frontend de consumo API',
      'Crear una interfaz que consuma una API REST.',
      datePlusDays(18),
    );

    // =========================================================
    // 8. ENTREGAS
    // =========================================================

    async function ensureSubmission(
      assignmentId: string,
      studentId: string,
      textContent: string,
      grade?: number,
      feedback?: string,
    ) {
      const existing = await prisma.submission.findFirst({
        where: { assignmentId, studentId },
      });

      const data = {
        textContent,
        grade: grade ?? null,
        feedback: feedback ?? null,
        gradedAt: grade !== undefined ? new Date() : null,
      };

      if (existing) {
        return prisma.submission.update({
          where: { id: existing.id },
          data,
        });
      }

      return prisma.submission.create({
        data: {
          assignmentId,
          studentId,
          ...data,
        },
      });
    }

    // Ana: una calificada y una pendiente de calificación
    await ensureSubmission(
      progAssignment1.id,
      activeStudents[0].profile.id,
      'Entrega de la API REST desarrollada con NestJS y Prisma.',
      88,
      'Buen trabajo. La estructura modular está bien aplicada.',
    );

    await ensureSubmission(
      progAssignment2.id,
      activeStudents[0].profile.id,
      'Entrega de autenticación JWT con guards y roles.',
    );

    await ensureSubmission(
      dbAssignment.id,
      activeStudents[0].profile.id,
      'DER normalizado y explicación de relaciones.',
      92,
      'Excelente normalización y relaciones claras.',
    );

    // Diego
    await ensureSubmission(
      dbAssignment.id,
      activeStudents[1].profile.id,
      'Modelo relacional de biblioteca académica.',
      78,
      'Correcto, revisar algunas cardinalidades.',
    );

    await ensureSubmission(
      webAssignment.id,
      activeStudents[1].profile.id,
      'Frontend conectado a API REST.',
    );

    // Lucía
    await ensureSubmission(
      progAssignment1.id,
      activeStudents[2].profile.id,
      'Proyecto REST con autenticación y validaciones.',
      95,
      'Muy buen trabajo.',
    );

    // Mateo
    await ensureSubmission(
      redAssignment.id,
      activeStudents[3].profile.id,
      'Topología propuesta con switches administrables.',
      84,
      'Diseño correcto y bien fundamentado.',
    );

    console.log('Tareas y entregas de demostración creadas');

    // =========================================================
    // 9. OBLIGACIONES FINANCIERAS
    // =========================================================

    async function ensureObligation(
      studentId: string,
      type: ObligationType,
      description: string,
      amount: number,
      dueDate: Date,
      status: ObligationStatus,
    ) {
      const existing = await prisma.financialObligation.findFirst({
        where: { studentId, description },
      });

      if (existing) {
        return prisma.financialObligation.update({
          where: { id: existing.id },
          data: { type, amount, dueDate, status },
        });
      }

      return prisma.financialObligation.create({
        data: {
          studentId,
          type,
          description,
          amount,
          dueDate,
          status,
        },
      });
    }

    const anaEnrollmentObligation = await ensureObligation(
      activeStudents[0].profile.id,
      ObligationType.ENROLLMENT,
      'Inscripción - Programación I',
      200,
      new Date('2026-02-10'),
      ObligationStatus.PAID,
    );

    const anaMonthlyPaid = await ensureObligation(
      activeStudents[0].profile.id,
      ObligationType.MONTHLY_FEE,
      'Mensualidad marzo - Programación I',
      350,
      new Date('2026-03-10'),
      ObligationStatus.PAID,
    );

    await ensureObligation(
      activeStudents[0].profile.id,
      ObligationType.MONTHLY_FEE,
      'Mensualidad noviembre - Programación I',
      350,
      new Date('2026-11-10'),
      ObligationStatus.PENDING,
    );

    const diegoEnrollmentObligation = await ensureObligation(
      activeStudents[1].profile.id,
      ObligationType.ENROLLMENT,
      'Inscripción - Base de Datos I',
      200,
      new Date('2026-02-10'),
      ObligationStatus.PAID,
    );

    await ensureObligation(
      activeStudents[1].profile.id,
      ObligationType.MONTHLY_FEE,
      'Mensualidad noviembre - Base de Datos I',
      350,
      new Date('2026-11-10'),
      ObligationStatus.PENDING,
    );

    await ensureObligation(
      activeStudents[2].profile.id,
      ObligationType.ENROLLMENT,
      'Inscripción - Desarrollo Web',
      220,
      new Date('2026-02-10'),
      ObligationStatus.PAID,
    );

    await ensureObligation(
      activeStudents[3].profile.id,
      ObligationType.MONTHLY_FEE,
      'Mensualidad noviembre - Redes I',
      320,
      new Date('2026-11-10'),
      ObligationStatus.PENDING,
    );

    await ensureObligation(
      applicantStudent.id,
      ObligationType.ENROLLMENT,
      'Matrícula inicial',
      200,
      datePlusDays(30),
      ObligationStatus.PENDING,
    );

    const overdueDate = new Date();
    overdueDate.setMonth(overdueDate.getMonth() - 1);

    await ensureObligation(
      suspendedStudent.id,
      ObligationType.MONTHLY_FEE,
      'Mensualidad vencida',
      350,
      overdueDate,
      ObligationStatus.OVERDUE,
    );

    console.log('Obligaciones financieras creadas');

    // =========================================================
    // 10. PAGOS DE DEMOSTRACIÓN
    // =========================================================

    const cashPayment = await prisma.payment.findFirst({
      where: { receiptNumber: 'CASH-SEED-0001' },
    });

    if (!cashPayment) {
      await prisma.payment.create({
        data: {
          obligationId: anaEnrollmentObligation.id,
          amount: anaEnrollmentObligation.amount,
          method: PaymentMethod.CASH,
          status: PaymentStatus.APPROVED,
          receiptNumber: 'CASH-SEED-0001',
          verifiedById: receptionist.id,
          verfiedAt: new Date('2026-02-05'),
        },
      });
    }

    const transferPayment = await prisma.payment.findFirst({
      where: { receiptNumber: 'TRX-SEED-0001' },
    });

    if (!transferPayment) {
      await prisma.payment.create({
        data: {
          obligationId: anaMonthlyPaid.id,
          amount: anaMonthlyPaid.amount,
          method: PaymentMethod.BANK_TRANSFER,
          status: PaymentStatus.APPROVED,
          receiptNumber: 'TRX-SEED-0001',
          verifiedById: receptionist.id,
          verfiedAt: new Date('2026-03-08'),
        },
      });
    }

    const onlinePayment = await prisma.payment.findFirst({
      where: { externalReference: 'MOCKPAY-SEED-0001' },
    });

    if (!onlinePayment) {
      await prisma.payment.create({
        data: {
          obligationId: diegoEnrollmentObligation.id,
          amount: diegoEnrollmentObligation.amount,
          method: PaymentMethod.ONLINE,
          status: PaymentStatus.APPROVED,
          externalReference: 'MOCKPAY-SEED-0001',
          gatewayResponse: {
            source: 'seed',
            status: 'SUCCEEDED',
          },
        },
      });
    }

    console.log('Pagos de demostración creados');

    console.log('');
    console.log('==========================================');
    console.log('SEED SGAF COMPLETADO');
    console.log('==========================================');
    console.log('Contraseña demo para todos: Clave123');
    console.log('');
    console.log('ADMIN:        admin@sgaf.com');
    console.log('RECEPCIÓN:    recepcion@sgaf.com');
    console.log('DOCENTE 1:    docente@sgaf.com');
    console.log('DOCENTE 2:    docente2@sgaf.com');
    console.log('DOCENTE 3:    docente3@sgaf.com');
    console.log('ESTUDIANTE 1: estudiante@sgaf.com');
    console.log('ESTUDIANTE 2: estudiante2@sgaf.com');
    console.log('ESTUDIANTE 3: estudiante3@sgaf.com');
    console.log('ESTUDIANTE 4: estudiante4@sgaf.com');
    console.log('POSTULANTE:   postulante@sgaf.com');
    console.log('SUSPENDIDO:   suspendido@sgaf.com');
    console.log('==========================================');
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Error ejecutando seed:', error);
  process.exit(1);
});
