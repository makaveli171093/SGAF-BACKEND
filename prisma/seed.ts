import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { Role, UserStatus } from '../src/generated/prisma/enums.js';

async function main() {
  console.log('Iniciando seed SGAF...');

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });

  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await bcrypt.hash('Clave123', 10);
    console.log('Conexión a base de datos correcta');

    const admin = await prisma.user.upsert({
      where: {
        email: 'admin@sgaf.com',
      },
      update: {},
      create: {
        email: 'admin@sgaf.com',
        ci: '9000001',
        passwordHash,
        firstName: 'Admin',
        lastName: 'SGAF',
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    const receptionist = await prisma.user.upsert({
      where: {
        email: 'recepcion@sgaf.com',
      },
      update: {},
      create: {
        email: 'recepcion@sgaf.com',
        ci: '9000002',
        passwordHash,
        firstName: 'Recepcion',
        lastName: 'SGAF',
        role: Role.RECEPCIONIST,
        status: UserStatus.ACTIVE,
      },
    });

    const teacherUser = await prisma.user.upsert({
      where: {
        email: 'docente@sgaf.com',
      },
      update: {},
      create: {
        email: 'docente@sgaf.com',
        ci: '9000003',
        passwordHash,
        firstName: 'Carlos',
        lastName: 'Docente',
        role: Role.TEACHER,
        status: UserStatus.ACTIVE,
      },
    });

    const studentUser = await prisma.user.upsert({
      where: {
        email: 'estudiante@sgaf.com',
      },
      update: {},
      create: {
        email: 'estudiante@sgaf.com',
        ci: '9000004',
        passwordHash,
        firstName: 'Ana',
        lastName: 'Estudiante',
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
      },
    });

    const applicantUser = await prisma.user.upsert({
      where: {
        email: 'postulante@sgaf.com',
      },
      update: {},
      create: {
        email: 'postulante@sgaf.com',
        ci: '9000005',
        passwordHash,
        firstName: 'Luis',
        lastName: 'Postulante',
        role: Role.STUDENT,
        status: UserStatus.PENDING_APPROVAL,
      },
    });

    const suspendedUser = await prisma.user.upsert({
      where: {
        email: 'suspendido@sgaf.com',
      },
      update: {},
      create: {
        email: 'suspendido@sgaf.com',
        ci: '9000006',
        passwordHash,
        firstName: 'Maria',
        lastName: 'Suspendida',
        role: Role.STUDENT,
        status: UserStatus.SUSPEND_FOR_DEBT,
      },
    });
    console.log('Usuarios base creados');
    const teacherProfile = await prisma.teacherProfile.upsert({
      where: {
        userId: teacherUser.id,
      },
      update: {},
      create: {
        userId: teacherUser.id,
        specialty: 'Ingeniería de Software',
        hireDate: new Date('2026-01-15'),
      },
    });

    const activeStudent = await prisma.studentProfile.upsert({
      where: {
        userId: studentUser.id,
      },
      update: {},
      create: {
        userId: studentUser.id,
        enrollmentCode: 'EST-2026-0001',
        guardianName: 'Tutor Ana',
        guardianPhone: '70000001',
        guardianCi: '8000001',
      },
    });

    const applicantStudent = await prisma.studentProfile.upsert({
      where: {
        userId: applicantUser.id,
      },
      update: {},
      create: {
        userId: applicantUser.id,
        enrollmentCode: 'EST-2026-0002',
        guardianName: 'Tutor Luis',
        guardianPhone: '70000002',
        guardianCi: '8000002',
      },
    });

    const suspendedStudent = await prisma.studentProfile.upsert({
      where: {
        userId: suspendedUser.id,
      },
      update: {},
      create: {
        userId: suspendedUser.id,
        enrollmentCode: 'EST-2026-0003',
        guardianName: 'Tutor Maria',
        guardianPhone: '70000003',
        guardianCi: '8000003',
      },
    });
    console.log('Perfiles de docente y estudiantes creados');

    let activePeriod = await prisma.academicPeriod.findFirst({
      where: {
        name: 'Gestión 2026',
      },
    });

    if (activePeriod) {
      activePeriod = await prisma.academicPeriod.update({
        where: {
          id: activePeriod.id,
        },
        data: {
          status: 'ACTIVE',
          startDate: new Date('2026-02-01'),
          endDate: new Date('2026-11-30'),
          maxCredits: 24,
        },
      });
    } else {
      activePeriod = await prisma.academicPeriod.create({
        data: {
          name: 'Gestión 2026',
          startDate: new Date('2026-02-01'),
          endDate: new Date('2026-11-30'),
          maxCredits: 24,
          status: 'ACTIVE',
        },
      });
    }

    const programmingSubject = await prisma.subject.upsert({
      where: {
        code: 'PROG-101',
      },
      update: {},
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
      where: {
        code: 'BD-101',
      },
      update: {},
      create: {
        code: 'BD-101',
        name: 'Base de Datos I',
        credits: 6,
        enrollmentFee: 200,
        monthlyFee: 350,
        active: true,
      },
    });

    let programmingGroup = await prisma.group.findFirst({
      where: {
        name: 'A',
        subjectId: programmingSubject.id,
        academicPeriodId: activePeriod.id,
      },
    });

    if (!programmingGroup) {
      programmingGroup = await prisma.group.create({
        data: {
          name: 'A',
          maxCapacity: 30,
          subjectId: programmingSubject.id,
          academicPeriodId: activePeriod.id,
          teacherId: teacherProfile.id,
        },
      });
    }

    let databaseGroup = await prisma.group.findFirst({
      where: {
        name: 'A',
        subjectId: databaseSubject.id,
        academicPeriodId: activePeriod.id,
      },
    });

    if (!databaseGroup) {
      databaseGroup = await prisma.group.create({
        data: {
          name: 'A',
          maxCapacity: 30,
          subjectId: databaseSubject.id,
          academicPeriodId: activePeriod.id,
          teacherId: teacherProfile.id,
        },
      });
    }

    const programmingSchedule = await prisma.scheduleBlock.findFirst({
      where: {
        groupId: programmingGroup.id,
        dayOfWeek: 'MONDAY',
      },
    });

    if (!programmingSchedule) {
      await prisma.scheduleBlock.create({
        data: {
          groupId: programmingGroup.id,
          dayOfWeek: 'MONDAY',
          startTime: new Date('1970-01-01T08:00:00.000Z'),
          endTime: new Date('1970-01-01T10:00:00.000Z'),
        },
      });
    }

    const databaseSchedule = await prisma.scheduleBlock.findFirst({
      where: {
        groupId: databaseGroup.id,
        dayOfWeek: 'TUESDAY',
      },
    });

    if (!databaseSchedule) {
      await prisma.scheduleBlock.create({
        data: {
          groupId: databaseGroup.id,
          dayOfWeek: 'TUESDAY',
          startTime: new Date('1970-01-01T10:00:00.000Z'),
          endTime: new Date('1970-01-01T12:00:00.000Z'),
        },
      });
    }
    console.log('Grupos y horarios creados');

    let programmingEnrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: activeStudent.id,
        groupId: programmingGroup.id,
      },
    });

    if (!programmingEnrollment) {
      programmingEnrollment = await prisma.enrollment.create({
        data: {
          studentId: activeStudent.id,
          groupId: programmingGroup.id,
          status: 'ACTIVE',
        },
      });
    }

    let databaseEnrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: activeStudent.id,
        groupId: databaseGroup.id,
      },
    });

    if (!databaseEnrollment) {
      databaseEnrollment = await prisma.enrollment.create({
        data: {
          studentId: activeStudent.id,
          groupId: databaseGroup.id,
          status: 'ACTIVE',
        },
      });
    }

    console.log('Matrículas de demostración creadas');

    let assignment = await prisma.assignment.findFirst({
      where: {
        groupId: programmingGroup.id,
        tittle: 'Proyecto Final de Programación',
      },
    });

    if (!assignment) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 15);

      assignment = await prisma.assignment.create({
        data: {
          groupId: programmingGroup.id,
          tittle: 'Proyecto Final de Programación',
          instructions:
            'Desarrollar una API REST aplicando los conceptos vistos en clase.',
          dueDate,
        },
      });
    }
    let submission = await prisma.submission.findFirst({
      where: {
        assignmentId: assignment.id,
        studentId: activeStudent.id,
      },
    });

    if (!submission) {
      submission = await prisma.submission.create({
        data: {
          assignmentId: assignment.id,
          studentId: activeStudent.id,
          textContent:
            'Entrega de demostración del proyecto final de Programación I.',
          grade: 85,
          feedback: 'Buen trabajo. Cumple con los requisitos principales.',
          gradedAt: new Date(),
        },
      });
    }
    console.log('Tarea y entrega de demostración creadas');

    const paidObligation = await prisma.financialObligation.findFirst({
      where: {
        studentId: activeStudent.id,
        type: 'ENROLLMENT',
      },
    });

    if (!paidObligation) {
      await prisma.financialObligation.create({
        data: {
          studentId: activeStudent.id,
          type: 'ENROLLMENT',
          description: 'Matrícula gestión 2026',
          amount: 200,
          dueDate: new Date('2026-02-28'),
          status: 'PAID',
        },
      });
    }
    const applicantObligation = await prisma.financialObligation.findFirst({
      where: {
        studentId: applicantStudent.id,
        type: 'ENROLLMENT',
      },
    });

    if (!applicantObligation) {
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + 1);

      await prisma.financialObligation.create({
        data: {
          studentId: applicantStudent.id,
          type: 'ENROLLMENT',
          description: 'Matrícula inicial',
          amount: 200,
          dueDate,
          status: 'PENDING',
        },
      });
    }
    const suspendedObligation = await prisma.financialObligation.findFirst({
      where: {
        studentId: suspendedStudent.id,
        status: 'PENDING',
      },
    });

    if (!suspendedObligation) {
      const overdueDate = new Date();
      overdueDate.setMonth(overdueDate.getMonth() - 1);

      await prisma.financialObligation.create({
        data: {
          studentId: suspendedStudent.id,
          type: 'MONTHLY_FEE',
          description: 'Mensualidad vencida',
          amount: 350,
          dueDate: overdueDate,
          status: 'PENDING',
        },
      });
    }
    console.log('Obligaciones financieras de demostración creadas');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Error ejecutando seed:', error);
  process.exit(1);
});
