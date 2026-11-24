import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/database/prisma.service.js';

const url = process.env.TEST_DATABASE_URL;
if (
  !url ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
  new URL(url).pathname !== '/sgaf_test'
)
  throw new Error('Use TEST_DATABASE_URL local, base sgaf_test');
process.env.DATABASE_URL = url;
const db = new PrismaService();
const secret = 'isolated-test-secret-32-characters';
const jwt = new JwtService({ secret });
const base = 'http://127.0.0.1:55440/api/v1';
const users = {
  a: randomUUID(),
  b: randomUUID(),
  teacher: randomUUID(),
  other: randomUUID(),
  reception: randomUUID(),
  admin: randomUUID(),
};
const userIds = Object.values(users);
let server: ChildProcess;
let groupId: string,
  subjectId: string,
  periodId: string,
  winner: string,
  obligationId: string,
  paymentId: string,
  assignmentId: string,
  submissionId: string;
let output = '';
async function http(
  method: string,
  route: string,
  user?: string,
  data?: unknown,
) {
  const r = await fetch(base + route, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(user
        ? {
            Authorization: `Bearer ${jwt.sign({ sub: user, tokenVersion: 0 })}`,
          }
        : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  return { status: r.status, body: await r.json() };
}
beforeAll(async () => {
  await db.$connect();
  for (const [key, id] of Object.entries(users)) {
    const role = ['teacher', 'other'].includes(key)
      ? 'TEACHER'
      : key === 'reception'
        ? 'RECEPCIONIST'
        : key === 'admin'
          ? 'ADMIN'
          : 'STUDENT';
    await db.user.create({
      data: {
        id,
        email: `${id}@test.invalid`,
        ci: id,
        firstName: key,
        lastName: 'Test',
        passwordHash: 'test-only',
        role,
        status: 'ACTIVE',
        ...(role === 'STUDENT'
          ? {
              stundentProfile: {
                create: {
                  enrollmentCode: id,
                  guardianName: 'Test',
                  guardianPhone: '000',
                },
              },
            }
          : role === 'TEACHER'
            ? {
                teacherProfile: {
                  create: { specialty: 'Test', hireDate: new Date() },
                },
              }
            : {}),
      },
    });
  }
  const teacher = await db.teacherProfile.findUniqueOrThrow({
    where: { userId: users.teacher },
  });
  periodId = (
    await db.academicPeriod.create({
      data: {
        name: randomUUID(),
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000 * 90),
        status: 'ACTIVE',
        maxCredits: 20,
      },
    })
  ).id;
  subjectId = (
    await db.subject.create({
      data: {
        code: randomUUID(),
        name: 'Test',
        credits: 3,
        enrollmentFee: 100,
        monthlyFee: 50,
      },
    })
  ).id;
  groupId = (
    await db.group.create({
      data: {
        name: randomUUID(),
        maxCapacity: 1,
        teacherId: teacher.id,
        subjectId,
        academicPeriodId: periodId,
      },
    })
  ).id;
  server = spawn(process.execPath, ['dist/main.js'], {
    env: {
      ...process.env,
      DATABASE_URL: url,
      NODE_ENV: 'test',
      PORT: '55440',
      JWT_SECRET: secret,
      MOCKPAY_API_URL: 'http://127.0.0.1:1',
      MOCKPAY_SECRET_KEY: 'test',
      MOCKPAY_WEBHOOK_SECRET: 'test',
      APP_BASE_URL: 'http://127.0.0.1:55440',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  server.stdout?.on('data', (c) => {
    output += String(c);
  });
  server.stderr?.on('data', (c) => {
    output += String(c);
  });
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error(output);
    try {
      await fetch(base);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(output);
}, 30000);
afterAll(async () => {
  server?.kill();
  const students = await db.studentProfile.findMany({
    where: { userId: { in: userIds } },
  });
  const ids = students.map((s) => s.id);
  const obligations = await db.financialObligation.findMany({
    where: { studentId: { in: ids } },
  });
  await db.payment.deleteMany({
    where: { obligationId: { in: obligations.map((o) => o.id) } },
  });
  await db.financialObligation.deleteMany({
    where: { studentId: { in: ids } },
  });
  await db.submission.deleteMany({ where: { studentId: { in: ids } } });
  await db.enrollment.deleteMany({ where: { studentId: { in: ids } } });
  if (groupId) {
    await db.assignment.deleteMany({ where: { groupId } });
    await db.group.delete({ where: { id: groupId } });
  }
  if (subjectId) await db.subject.delete({ where: { id: subjectId } });
  if (periodId) await db.academicPeriod.delete({ where: { id: periodId } });
  await db.auditEvent.deleteMany({ where: { actorId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});
it('rechaza acceso anónimo y roles incorrectos', async () => {
  expect((await http('GET', '/assignments/my-assignments')).status).toBe(401);
  expect(
    (
      await http('POST', '/payments/manual', users.a, {
        obligationId: randomUUID(),
        method: 'CASH',
      })
    ).status,
  ).toBe(403);
  expect((await http('GET', '/assignments/teacher', users.admin)).status).toBe(
    403,
  );
});
it('matrículas simultáneas respetan capacidad y crean una auditoría', async () => {
  const results = await Promise.all(
    [users.a, users.b].map((u) => http('POST', '/enrollments', u, { groupId })),
  );
  expect(results.filter((r) => r.status === 201)).toHaveLength(1);
  expect(
    results.every((r) => [201, 400, 409].includes(r.status)),
    JSON.stringify(results) + output,
  ).toBe(true);
  winner = [users.a, users.b][results.findIndex((r) => r.status === 201)];
  obligationId = results.find((r) => r.status === 201)!.body.obligations[0].id;
  expect(await db.enrollment.count({ where: { groupId } })).toBe(1);
  expect(
    await db.auditEvent.count({
      where: { actorId: winner, action: 'ENROLLMENT_CREATED' },
    }),
  ).toBe(1);
});
it('dos pagos simultáneos producen un único pendiente', async () => {
  const results = await Promise.all(
    [1, 2].map(() =>
      http('POST', '/payments/manual', users.reception, {
        obligationId,
        method: 'CASH',
      }),
    ),
  );
  expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
    201, 409,
  ]);
  paymentId = results.find((r) => r.status === 201)!.body.payment.id;
  expect(await db.payment.count({ where: { obligationId } })).toBe(1);
});
it('verificación concurrente liquida una sola vez', async () => {
  const results = await Promise.all(
    [1, 2].map(() =>
      http('PATCH', `/payments/${paymentId}/verify`, users.reception, {
        status: 'APPROVED',
      }),
    ),
  );
  expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
    200, 409,
  ]);
  expect(
    (
      await db.financialObligation.findUniqueOrThrow({
        where: { id: obligationId },
      })
    ).status,
  ).toBe('PAID');
  expect(
    await db.auditEvent.count({
      where: { entityId: paymentId, action: 'PAYMENT_APPROVED' },
    }),
  ).toBe(1);
});
it('valida fechas reales y propiedad antes de publicar tareas', async () => {
  const input = {
    groupId,
    title: 'Actividad',
    instructions: 'Responder',
    dueDate: '2099-02-30T12:00:00Z',
  };
  expect(
    (await http('POST', '/assignments', users.teacher, input)).status,
  ).toBe(400);
  input.dueDate = new Date(Date.now() + 86400000).toISOString();
  expect((await http('POST', '/assignments', users.other, input)).status).toBe(
    403,
  );
  const result = await http('POST', '/assignments', users.teacher, input);
  expect(result.status).toBe(201);
  assignmentId = result.body.assignment.id;
});
it('exige matrícula y evita entregas duplicadas simultáneas', async () => {
  const input = { assignmentId, textContent: 'Respuesta' };
  expect(
    (
      await http(
        'POST',
        '/submissions',
        winner === users.a ? users.b : users.a,
        input,
      )
    ).status,
  ).toBe(403);
  const results = await Promise.all(
    [1, 2].map(() => http('POST', '/submissions', winner, input)),
  );
  expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
    201, 409,
  ]);
  submissionId = results.find((r) => r.status === 201)!.body.submission.id;
});
it('solo el docente propietario califica y la nota queda auditada', async () => {
  expect(
    (
      await http('PATCH', `/submissions/${submissionId}/grade`, users.other, {
        grade: 80,
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await http('PATCH', `/submissions/${submissionId}/grade`, users.teacher, {
        grade: 101,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await http('PATCH', `/submissions/${submissionId}/grade`, users.teacher, {
        grade: 80,
      })
    ).status,
  ).toBe(200);
  expect(
    await db.auditEvent.count({
      where: { entityId: submissionId, action: 'SUBMISSION_GRADED' },
    }),
  ).toBe(1);
});
it('rechaza sesión revocada antes de su expiración', async () => {
  await db.user.update({
    where: { id: users.b },
    data: { tokenVersion: { increment: 1 } },
  });
  expect(
    (await http('GET', '/assignments/my-assignments', users.b)).status,
  ).toBe(401);
});
it('pagina y filtra en servidor sin exponer tareas de otro docente', async () => {
  await db.assignment.createMany({
    data: ['B', 'C', 'D'].map((title) => ({
      groupId,
      tittle: title,
      instructions: 'Buscar',
      dueDate: new Date(Date.now() + 86400000),
    })),
  });
  const first = await http(
    'GET',
    '/assignments/teacher?page=1&pageSize=2&order=title',
    users.teacher,
  );
  const second = await http(
    'GET',
    '/assignments/teacher?page=2&pageSize=2&order=title',
    users.teacher,
  );
  expect(first.status).toBe(200);
  expect(first.body.pagination.total).toBe(4);
  expect(first.body.assignments).toHaveLength(2);
  expect(
    new Set(
      [...first.body.assignments, ...second.body.assignments].map((a) => a.id),
    ).size,
  ).toBe(4);
  expect(
    (await http('GET', '/assignments/teacher?page=1&q=Buscar', users.other))
      .body.pagination.total,
  ).toBe(0);
  expect(
    (await http('GET', '/assignments/teacher?page=0', users.teacher)).status,
  ).toBe(400);
  expect(
    (
      await http(
        'GET',
        '/assignments/teacher?page=1&pageSize=101',
        users.teacher,
      )
    ).status,
  ).toBe(400);
  const student = await http(
    'GET',
    '/assignments/my-assignments?page=1&status=graded',
    winner,
  );
  // winner may be b, whose session was revoked by the preceding test.
  if (winner === users.b) expect(student.status).toBe(401);
  else
    expect(student.body.assignments.map((a) => a.id)).toEqual([assignmentId]);
  const submissions = await http(
    'GET',
    `/submissions/assignment/${assignmentId}?page=1&status=ungraded`,
    users.teacher,
  );
  expect(submissions.body.pagination.total).toBe(0);
  expect(submissions.body.pending).toBe(0);
});
it('conserva reserva ante fallo del proveedor y reconcilia un webhook temprano una sola vez', async () => {
  const student = await db.studentProfile.findUniqueOrThrow({
    where: { userId: users.a },
  });
  const obligation = await db.financialObligation.create({
    data: {
      studentId: student.id,
      type: 'OTHER',
      description: 'Prueba de conciliación',
      amount: 25,
      dueDate: new Date(Date.now() + 86400000),
    },
  });
  const failed = await http('POST', '/payments/online', users.a, {
    obligationId: obligation.id,
  });
  expect(failed.status).toBe(502);
  expect(
    (
      await http('POST', '/payments/online', users.a, {
        obligationId: obligation.id,
      })
    ).status,
  ).toBe(409);
  const payment = await db.payment.findFirstOrThrow({
    where: { obligationId: obligation.id },
  });
  expect(payment.externalReference).toBeNull();
  expect(
    await db.payment.count({ where: { obligationId: obligation.id } }),
  ).toBe(1);
  expect(
    await db.auditEvent.count({
      where: {
        entityId: payment.id,
        action: 'PAYMENT_RECONCILIATION_REQUIRED',
      },
    }),
  ).toBe(1);
  const webhook = {
    id: randomUUID(),
    amount: 25,
    currency: 'USD',
    status: 'SUCCEEDED',
    event: 'payment.succeeded',
    created_at: new Date().toISOString(),
    metadata: {
      payment_id: payment.id,
      student_id: student.id,
      obligation_id: obligation.id,
    },
  };
  expect(
    (
      await http(
        'POST',
        '/payments/webhook?token=incorrect',
        undefined,
        webhook,
      )
    ).status,
  ).toBe(401);
  expect(
    (
      await http('POST', '/payments/webhook?token=test', undefined, {
        ...webhook,
        currency: 'BOB',
      })
    ).status,
  ).toBe(400);
  expect(
    (await http('POST', '/payments/webhook?token=test', undefined, webhook))
      .status,
  ).toBe(201);
  expect(
    (await http('POST', '/payments/webhook?token=test', undefined, webhook))
      .status,
  ).toBe(201);
  expect(
    await db.auditEvent.count({
      where: { entityId: payment.id, action: 'PAYMENT_APPROVED' },
    }),
  ).toBe(1);
  expect(
    (
      await db.financialObligation.findUniqueOrThrow({
        where: { id: obligation.id },
      })
    ).status,
  ).toBe('PAID');
  await db.auditEvent.deleteMany({ where: { entityId: payment.id } });
});
