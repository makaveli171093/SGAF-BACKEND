import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { DayOfWeek } from '../generated/prisma/enums.js';
import { publicUserSelect } from '../common/selects/user-public.select.js';
import {
  EditGroupDto,
  EditScheduleDto,
  EditSubjectDto,
  EditUserDto,
  PasswordDto,
  ProfileDto,
  ReportQueryDto,
} from './operations.dto.js';

type Tx = Prisma.TransactionClient;
const accountSelect = { ...publicUserSelect, avatarData: true };

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { stundentProfile: true, teacherProfile: true },
    });
    if (!user) throw new UnauthorizedException();
    const cards: { label: string; value: number; href: string }[] = [];
    if (user.role === 'ADMIN') {
      cards.push({
        label: 'Usuarios activos',
        value: await this.prisma.user.count({ where: { status: 'ACTIVE' } }),
        href: '/admin/usuarios',
      });
      cards.push({
        label: 'Periodos activos',
        value: await this.prisma.academicPeriod.count({
          where: { status: 'ACTIVE' },
        }),
        href: '/admin/periodos',
      });
      cards.push({
        label: 'Materias activas',
        value: await this.prisma.subject.count({ where: { active: true } }),
        href: '/admin/materias',
      });
    } else if (user.role === 'RECEPCIONIST') {
      cards.push({
        label: 'Pagos manuales por verificar',
        value: await this.prisma.payment.count({
          where: {
            status: 'PENDING',
            method: { in: ['CASH', 'BANK_TRANSFER'] },
          },
        }),
        href: '/recepcion/pagos',
      });
      cards.push({
        label: 'Postulantes pendientes',
        value: await this.prisma.user.count({
          where: { status: 'PENDING_APPROVAL' },
        }),
        href: '/recepcion/postulantes',
      });
      cards.push({
        label: 'Obligaciones pendientes',
        value: await this.prisma.financialObligation.count({
          where: { status: { in: ['PENDING', 'OVERDUE'] } },
        }),
        href: '/recepcion/obligaciones',
      });
    } else if (user.role === 'TEACHER' && user.teacherProfile) {
      const teacherId = user.teacherProfile.id;
      cards.push({
        label: 'Mis grupos',
        value: await this.prisma.group.count({ where: { teacherId } }),
        href: '/docente/grupos',
      });
      cards.push({
        label: 'Tareas publicadas',
        value: await this.prisma.assignment.count({
          where: { group: { teacherId } },
        }),
        href: '/docente/tareas',
      });
      cards.push({
        label: 'Entregas por calificar',
        value: await this.prisma.submission.count({
          where: { assignment: { group: { teacherId } }, grade: null },
        }),
        href: '/docente/tareas',
      });
    } else if (user.role === 'STUDENT' && user.stundentProfile) {
      const studentId = user.stundentProfile.id;
      cards.push({
        label: 'Inscripciones activas',
        value: await this.prisma.enrollment.count({
          where: { studentId, status: 'ACTIVE' },
        }),
        href: '/mis-inscripciones',
      });
      cards.push({
        label: 'Obligaciones pendientes',
        value: await this.prisma.financialObligation.count({
          where: { studentId, status: { in: ['PENDING', 'OVERDUE'] } },
        }),
        href: '/mis-finanzas',
      });
      cards.push({
        label: 'Tareas vigentes sin entregar',
        value: await this.prisma.assignment.count({
          where: {
            dueDate: { gte: new Date() },
            group: { enrollments: { some: { studentId, status: 'ACTIVE' } } },
            submissions: { none: { studentId } },
          },
        }),
        href: '/mis-tareas',
      });
    }
    return { cards, generatedAt: new Date().toISOString() };
  }

  private async transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(work, {
        isolationLevel: 'Serializable',
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException(
            'Ya existe un registro con esos datos únicos.',
          );
        if (error.code === 'P2034')
          throw new ConflictException(
            'Otro usuario modificó los datos. Actualiza e intenta de nuevo.',
          );
        if (error.code === 'P2025')
          throw new NotFoundException('El registro ya no existe.');
      }
      throw error;
    }
  }

  private audit(
    tx: Tx,
    actorId: string,
    entityId: string,
    action: string,
    detail: string,
  ) {
    return tx.auditEvent.create({
      data: { actorId, entityId, action, detail },
    });
  }

  private profileData(dto: ProfileDto) {
    const firstName = dto.firstName.trim(),
      lastName = dto.lastName.trim();
    if (!firstName || !lastName)
      throw new BadRequestException('Nombre y apellido son obligatorios.');
    return {
      firstName,
      lastName,
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone.trim() || null,
    };
  }

  async profile(id: string, dto: ProfileDto) {
    return this.transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: this.profileData(dto),
        select: accountSelect,
      });
      return { message: 'Datos personales actualizados.', user };
    });
  }

  async editUser(id: string, dto: EditUserDto, actorId: string) {
    return this.transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('El usuario no existe.');
      if (dto.ci.trim().length < 5)
        throw new BadRequestException('Documento inválido.');
      await tx.user.update({
        where: { id },
        data: { ...this.profileData(dto), ci: dto.ci.trim() },
      });
      if (current.role === 'TEACHER') {
        if (!dto.specialty?.trim() || !dto.hireDate)
          throw new BadRequestException(
            'Especialidad y fecha de contratación son obligatorias.',
          );
        await tx.teacherProfile.update({
          where: { userId: id },
          data: {
            specialty: dto.specialty.trim(),
            hireDate: new Date(dto.hireDate),
          },
        });
      }
      await this.audit(
        tx,
        actorId,
        id,
        'USER_EDITED',
        'Datos de usuario actualizados.',
      );
      return {
        message: 'Usuario actualizado. Su rol e historial se conservan.',
      };
    });
  }

  async userStatus(id: string, status: 'ACTIVE' | 'INACTIVE', actorId: string) {
    return this.transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        include: { stundentProfile: true },
      });
      if (!user) throw new NotFoundException('El usuario no existe.');
      if (id === actorId && status === 'INACTIVE')
        throw new BadRequestException('No puedes inactivar tu propia cuenta.');
      if (user.status === 'PENDING_APPROVAL')
        throw new BadRequestException(
          'La aprobación de postulantes se realiza desde Recepción.',
        );
      if (
        status === 'INACTIVE' &&
        user.role === 'ADMIN' &&
        user.status === 'ACTIVE'
      ) {
        const admins = await tx.user.count({
          where: { role: 'ADMIN', status: 'ACTIVE' },
        });
        if (admins <= 1)
          throw new BadRequestException(
            'Debe permanecer al menos un administrador activo.',
          );
      }
      let next: 'ACTIVE' | 'INACTIVE' | 'SUSPEND_FOR_DEBT' = status;
      if (status === 'ACTIVE' && user.stundentProfile) {
        const overdue = await tx.financialObligation.count({
          where: {
            studentId: user.stundentProfile.id,
            status: { in: ['PENDING', 'OVERDUE'] },
            dueDate: { lt: new Date() },
          },
        });
        if (overdue) next = 'SUSPEND_FOR_DEBT';
      }
      await tx.user.update({
        where: { id },
        data: { status: next, tokenVersion: { increment: 1 } },
      });
      await this.audit(
        tx,
        actorId,
        id,
        'USER_STATUS',
        `${user.status} → ${next}`,
      );
      return {
        message:
          next === 'SUSPEND_FOR_DEBT'
            ? 'Cuenta reactivada con restricción por deuda vencida.'
            : 'Estado actualizado. Las sesiones anteriores han sido revocadas.',
      };
    });
  }

  async password(id: string, dto: PasswordDto) {
    if (Buffer.byteLength(dto.newPassword, 'utf8') > 72)
      throw new BadRequestException(
        'La contraseña supera 72 bytes. Usa una más corta.',
      );
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (
      !user ||
      !(await bcrypt.compare(dto.currentPassword, user.passwordHash))
    )
      throw new BadRequestException('La contraseña actual es incorrecta.');
    if (dto.currentPassword === dto.newPassword)
      throw new BadRequestException('La nueva contraseña debe ser diferente.');
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    return this.transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id, passwordHash: user.passwordHash },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      if (!result.count)
        throw new UnauthorizedException(
          'La contraseña ya cambió. Inicia sesión nuevamente.',
        );
      await this.audit(
        tx,
        id,
        id,
        'PASSWORD_CHANGED',
        'Contraseña cambiada y sesiones revocadas.',
      );
      return {
        message:
          'Contraseña actualizada. Inicia sesión nuevamente en tus dispositivos.',
      };
    });
  }

  async avatar(id: string, avatarData: string | null) {
    if (avatarData !== null) {
      const match =
        /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
          avatarData,
        );
      if (!match || avatarData.length > 180000)
        throw new BadRequestException(
          'La foto debe ser PNG, JPEG o WebP y pesar menos de 130 KB.',
        );
      const bytes = Buffer.from(match[2], 'base64');
      const valid =
        (match[1] === 'png' &&
          bytes
            .subarray(0, 8)
            .equals(Buffer.from('89504e470d0a1a0a', 'hex'))) ||
        (match[1] === 'jpeg' &&
          bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) ||
        (match[1] === 'webp' &&
          bytes.subarray(0, 4).toString() === 'RIFF' &&
          bytes.subarray(8, 12).toString() === 'WEBP');
      if (!valid)
        throw new BadRequestException(
          'El contenido de la imagen no corresponde al formato.',
        );
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: { avatarData },
      select: accountSelect,
    });
    return { message: 'Foto de perfil actualizada.', user };
  }

  async reopen(id: string, reason: string, actorId: string) {
    if (reason.trim().length < 10)
      throw new BadRequestException(
        'Explica el motivo con al menos 10 caracteres.',
      );
    return this.transaction(async (tx) => {
      const period = await tx.academicPeriod.findUnique({ where: { id } });
      if (!period) throw new NotFoundException('El periodo no existe.');
      if (period.status !== 'CLOSED')
        throw new BadRequestException(
          'Solo se puede reabrir un periodo cerrado.',
        );
      const now = new Date();
      if (period.endDate < now)
        throw new BadRequestException(
          'El periodo ya terminó. No se pueden reabrir periodos vencidos.',
        );
      const status = period.startDate > now ? 'PLANNED' : 'ACTIVE';
      const updated = await tx.academicPeriod.update({
        where: { id },
        data: { status },
      });
      await this.audit(
        tx,
        actorId,
        id,
        'PERIOD_REOPENED',
        `${status}: ${reason.trim()}`,
      );
      return {
        message: 'Periodo reabierto. Motivo y administrador registrados.',
        period: updated,
      };
    });
  }

  async history(entityId: string) {
    const events = await this.prisma.auditEvent.findMany({
      where: { entityId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const actors = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(events.map((e) => e.actorId))] } },
      select: { id: true, firstName: true, lastName: true },
    });
    return {
      events: events.map((e) => ({
        ...e,
        actor: actors.find((a) => a.id === e.actorId) ?? null,
      })),
    };
  }

  async editSubject(id: string, dto: EditSubjectDto, actorId: string) {
    return this.transaction(async (tx) => {
      const subject = await tx.subject.findUnique({ where: { id } });
      if (!subject) throw new NotFoundException('La materia no existe.');
      if (!dto.name.trim() || !dto.code.trim())
        throw new BadRequestException('Nombre y código son obligatorios.');
      // Los créditos forman parte del historial académico: no recalcular inscripciones antiguas.
      if (
        subject.credits !== dto.credits &&
        (await tx.enrollment.count({ where: { group: { subjectId: id } } }))
      ) {
        throw new BadRequestException(
          'Esta materia ya tiene inscripciones. Conserva sus créditos y crea otra materia para una nueva carga académica.',
        );
      }
      await tx.subject.update({
        where: { id },
        data: {
          code: dto.code.trim(),
          name: dto.name.trim(),
          credits: dto.credits,
          enrollmentFee: dto.enrollmentFee,
          monthlyFee: dto.monthlyFee,
          active: dto.active,
        },
      });
      await this.audit(
        tx,
        actorId,
        id,
        'SUBJECT_EDITED',
        'Datos actualizados; tarifas aplicables solo a futuras inscripciones.',
      );
      return {
        message:
          'Materia actualizada. Las obligaciones existentes conservan sus importes.',
      };
    });
  }

  private async editableGroup(tx: Tx, id: string) {
    const group = await tx.group.findUnique({
      where: { id },
      include: { academicPeriod: true, scheduleBlocks: true },
    });
    if (!group) throw new NotFoundException('El grupo no existe.');
    if (group.academicPeriod.status === 'CLOSED')
      throw new BadRequestException(
        'Reabre el periodo antes de modificar sus grupos u horarios.',
      );
    return group;
  }

  private async checkSchedule(
    tx: Tx,
    groupId: string,
    teacherId: string,
    period: { startDate: Date; endDate: Date },
    blocks: {
      id?: string;
      dayOfWeek: DayOfWeek;
      startTime: Date;
      endTime: Date;
    }[],
  ) {
    const students = await tx.enrollment.findMany({
      where: { groupId, status: 'ACTIVE' },
      select: { studentId: true },
    });
    for (const block of blocks) {
      const conflict = await tx.scheduleBlock.findFirst({
        where: {
          id: block.id ? { not: block.id } : undefined,
          dayOfWeek: block.dayOfWeek,
          startTime: { lt: block.endTime },
          endTime: { gt: block.startTime },
          OR: [
            { groupId },
            {
              group: {
                academicPeriod: {
                  status: { not: 'CLOSED' },
                  startDate: { lte: period.endDate },
                  endDate: { gte: period.startDate },
                },
                OR: [
                  { teacherId },
                  {
                    enrollments: {
                      some: {
                        status: 'ACTIVE',
                        studentId: { in: students.map((s) => s.studentId) },
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
        select: { groupId: true },
      });
      if (conflict)
        throw new ConflictException(
          'El horario se cruza con otro bloque del grupo, del docente o de un estudiante inscrito.',
        );
    }
  }

  async editGroup(id: string, dto: EditGroupDto, actorId: string) {
    return this.transaction(async (tx) => {
      const current = await this.editableGroup(tx, id);
      const period = await tx.academicPeriod.findUnique({
        where: { id: dto.academicPeriodId },
      });
      const subject = await tx.subject.findUnique({
        where: { id: dto.subjectId },
      });
      const teacher = await tx.teacherProfile.findUnique({
        where: { id: dto.teacherId },
        include: { user: true },
      });
      if (
        !period ||
        period.status === 'CLOSED' ||
        !subject ||
        (!subject.active && dto.subjectId !== current.subjectId) ||
        teacher?.user.status !== 'ACTIVE'
      )
        throw new BadRequestException(
          'Selecciona un periodo abierto, una materia válida y un docente activo.',
        );
      if (!dto.name.trim())
        throw new BadRequestException('El nombre es obligatorio.');
      const active = await tx.enrollment.count({
        where: { groupId: id, status: 'ACTIVE' },
      });
      if (dto.maxCapacity < active)
        throw new BadRequestException(
          `La capacidad no puede ser menor a los ${active} inscritos activos.`,
        );
      if (
        dto.subjectId !== current.subjectId ||
        dto.academicPeriodId !== current.academicPeriodId
      ) {
        const history =
          (await tx.enrollment.count({ where: { groupId: id } })) +
          (await tx.assignment.count({ where: { groupId: id } }));
        if (history)
          throw new BadRequestException(
            'Un grupo con inscripciones o tareas debe conservar su materia y periodo.',
          );
      }
      await this.checkSchedule(
        tx,
        id,
        dto.teacherId,
        period,
        current.scheduleBlocks,
      );
      await tx.group.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          maxCapacity: dto.maxCapacity,
          subjectId: dto.subjectId,
          academicPeriodId: dto.academicPeriodId,
          teacherId: dto.teacherId,
        },
      });
      await this.audit(
        tx,
        actorId,
        id,
        'GROUP_EDITED',
        'Grupo actualizado con revisión de cupos y horarios.',
      );
      return { message: 'Grupo actualizado.' };
    });
  }

  async schedule(id: string | null, dto: EditScheduleDto, actorId: string) {
    return this.transaction(async (tx) => {
      const group = await this.editableGroup(tx, dto.groupId);
      if (id) {
        const old = await tx.scheduleBlock.findUnique({ where: { id } });
        if (!old || old.groupId !== dto.groupId)
          throw new BadRequestException('El horario no pertenece al grupo.');
      }
      const startTime = new Date(`1970-01-01T${dto.startTime}:00.000Z`),
        endTime = new Date(`1970-01-01T${dto.endTime}:00.000Z`);
      if (
        !Number.isFinite(startTime.getTime()) ||
        !Number.isFinite(endTime.getTime()) ||
        startTime >= endTime
      )
        throw new BadRequestException(
          'La hora de inicio debe ser anterior a la de fin.',
        );
      await this.checkSchedule(
        tx,
        dto.groupId,
        group.teacherId,
        group.academicPeriod,
        [{ id: id ?? undefined, dayOfWeek: dto.dayOfWeek, startTime, endTime }],
      );
      const data = {
        groupId: dto.groupId,
        dayOfWeek: dto.dayOfWeek,
        startTime,
        endTime,
      };
      const scheduleBlock = id
        ? await tx.scheduleBlock.update({ where: { id }, data })
        : await tx.scheduleBlock.create({ data });
      await this.audit(
        tx,
        actorId,
        dto.groupId,
        'SCHEDULE_SAVED',
        `${dto.dayOfWeek} ${dto.startTime}–${dto.endTime}`,
      );
      return { message: 'Horario guardado.', scheduleBlock };
    });
  }

  async removeSchedule(id: string, actorId: string) {
    return this.transaction(async (tx) => {
      const block = await tx.scheduleBlock.findUnique({ where: { id } });
      if (!block) throw new NotFoundException('El horario no existe.');
      await this.editableGroup(tx, block.groupId);
      await tx.scheduleBlock.delete({ where: { id } });
      await this.audit(
        tx,
        actorId,
        block.groupId,
        'SCHEDULE_REMOVED',
        `${block.dayOfWeek} ${block.startTime.toISOString().slice(11, 16)}–${block.endTime.toISOString().slice(11, 16)}`,
      );
      return { message: 'Horario eliminado.' };
    });
  }

  async metrics(query: ReportQueryDto) {
    const now = new Date();
    const localDate = new Date(now.getTime() - 4 * 3600000)
      .toISOString()
      .slice(0, 10);
    const from = query.from ?? `${localDate.slice(0, 4)}-01-01`,
      to = query.to ?? localDate;
    const start = new Date(`${from}T00:00:00-04:00`),
      end = new Date(`${to}T23:59:59.999-04:00`);
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      start > end ||
      end.getTime() - start.getTime() > 366 * 86400000 ||
      new Date(`${from}T00:00:00Z`).toISOString().slice(0, 10) !== from ||
      new Date(`${to}T00:00:00Z`).toISOString().slice(0, 10) !== to
    )
      throw new BadRequestException(
        'Selecciona fechas válidas y un rango máximo de un año.',
      );
    return this.prisma.$transaction(
      async (tx) => {
        const payments = await tx.payment.findMany({
          where: { status: 'APPROVED', verfiedAt: { gte: start, lte: end } },
          select: { amount: true, method: true, verfiedAt: true },
        });
        const monthly = new Map<string, number>();
        for (
          let date = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
          date.toISOString().slice(0, 7) <= to.slice(0, 7);
          date.setUTCMonth(date.getUTCMonth() + 1)
        )
          monthly.set(date.toISOString().slice(0, 7), 0);
        let cents = 0;
        for (const payment of payments) {
          const amount = Math.round(Number(payment.amount) * 100);
          const month = new Date(payment.verfiedAt!.getTime() - 4 * 3600000)
            .toISOString()
            .slice(0, 7);
          cents += amount;
          monthly.set(month, (monthly.get(month) ?? 0) + amount);
        }
        const outstanding = await tx.financialObligation.findMany({
          where: { status: { in: ['PENDING', 'OVERDUE'] } },
          select: { amount: true, dueDate: true },
        });
        const activeUsers = await tx.user.count({
          where: { status: 'ACTIVE' },
        });
        const applicants = await tx.user.count({
          where: { status: 'PENDING_APPROVAL' },
        });
        const pendingPayments = await tx.payment.count({
          where: { status: 'PENDING' },
        });
        const undatedApproved = await tx.payment.count({
          where: { status: 'APPROVED', verfiedAt: null },
        });
        const groups = await tx.group.findMany({
          select: {
            id: true,
            name: true,
            maxCapacity: true,
            subject: { select: { name: true } },
            academicPeriod: { select: { name: true, status: true } },
            _count: {
              select: { enrollments: { where: { status: 'ACTIVE' } } },
            },
          },
        });
        return {
          generatedAt: now.toISOString(),
          filters: { from, to, timezone: 'America/La_Paz' },
          revenue: cents / 100,
          approvedPayments: payments.length,
          undatedApproved,
          monthlyRevenue: [...monthly].map(([month, value]) => ({
            month,
            amount: value / 100,
          })),
          snapshot: {
            activeUsers,
            applicants,
            pendingPayments,
            outstandingAmount:
              outstanding.reduce(
                (sum, o) => sum + Math.round(Number(o.amount) * 100),
                0,
              ) / 100,
            overdueAmount:
              outstanding
                .filter((o) => o.dueDate < now)
                .reduce(
                  (sum, o) => sum + Math.round(Number(o.amount) * 100),
                  0,
                ) / 100,
          },
          groups: groups.map((g) => ({
            id: g.id,
            name: g.name,
            subject: g.subject.name,
            period: g.academicPeriod.name,
            status: g.academicPeriod.status,
            capacity: g.maxCapacity,
            enrolled: g._count.enrollments,
          })),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
