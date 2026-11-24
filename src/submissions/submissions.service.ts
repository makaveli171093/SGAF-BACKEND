import { ListQueryDto, pageMeta } from '../common/list-query.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import { serializable } from '../common/serializable.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { CreateSubmissionDto } from './dto/create-submission.dto.js';
import { GradeSubmissionDto } from './dto/grade-submission.dto.js';
import { PaymentsService } from '../payments/payments.service.js';
import { publicUserSelect } from '../common/selects/user-public.select.js';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async create(userId: string, dto: CreateSubmissionDto) {
    const student = await this.prisma.studentProfile.findUnique({
      where: {
        userId,
      },
      include: {
        user: {
          select: publicUserSelect,
        },
      },
    });

    if (!student) {
      throw new NotFoundException(
        'No existe un perfil estudiantil asociado al usuario',
      );
    }

    const debtStatus = await this.paymentsService.syncStudentDebtStatus(
      student.id,
    );
    if (debtStatus.status !== 'ACTIVE' && !debtStatus.SUSPEND) {
      throw new ForbiddenException(
        'El estudiante no está habilitado para entregar tareas',
      );
    }

    if (debtStatus.SUSPEND) {
      throw new ForbiddenException(
        'No puede enviar tareas porque tiene obligaciones financieras vencidas',
      );
    }

    if (!dto.textContent && !dto.fileUrl) {
      throw new BadRequestException(
        'La entrega debe contener texto o un archivo',
      );
    }

    return serializable(this.prisma, async (tx) => {
      const currentStudent = await tx.studentProfile.findUnique({
        where: { id: student.id },
        include: { user: { select: { status: true } } },
      });
      const overdue = await tx.financialObligation.count({
        where: {
          studentId: student.id,
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: { lt: new Date() },
        },
      });
      if (
        !currentStudent ||
        currentStudent.user.status !== 'ACTIVE' ||
        overdue > 0
      )
        throw new ForbiddenException(
          'El estudiante no está habilitado para entregar tareas',
        );
      const assignment = await tx.assignment.findUnique({
        where: {
          id: dto.assignmentId,
        },
        include: {
          group: {
            include: {
              subject: true,
              academicPeriod: true,
            },
          },
        },
      });

      if (!assignment) {
        throw new NotFoundException('La tarea no existe');
      }

      const enrollment = await tx.enrollment.findFirst({
        where: {
          studentId: student.id,
          groupId: assignment.groupId,
          status: 'ACTIVE',
        },
      });

      if (!enrollment) {
        throw new ForbiddenException(
          'El estudiante no está matriculado en el grupo de esta tarea',
        );
      }

      if (assignment.dueDate < new Date()) {
        throw new BadRequestException('La fecha límite de la tarea ya venció');
      }

      const existingSubmission = await tx.submission.findUnique({
        where: {
          assignmentId_studentId: {
            assignmentId: assignment.id,
            studentId: student.id,
          },
        },
      });

      if (existingSubmission) {
        throw new ConflictException(
          'El estudiante ya realizó una entrega para esta tarea',
        );
      }

      const created = await tx.submission.create({
        data: {
          assignmentId: assignment.id,
          studentId: student.id,
          textContent: dto.textContent,
          fileUrl: dto.fileUrl,
        },
        include: {
          assignment: {
            include: {
              group: {
                include: {
                  subject: true,
                },
              },
            },
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId: userId,
          action: 'SUBMISSION_CREATED',
          entityId: created.id,
          detail: 'Entrega registrada',
        },
      });

      return {
        message: 'Entrega registrada correctamente',
        submission: created,
      };
    });
  }

  async findByAssignment(
    userId: string,
    assignmentId: string,
    query: ListQueryDto = {},
  ) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { group: { include: { teacher: true } } },
    });
    if (!assignment) throw new NotFoundException('La tarea no existe');
    if (assignment.group.teacher.userId !== userId) {
      throw new ForbiddenException(
        'El docente no está autorizado para consultar estas entregas',
      );
    }
    const contains = {
      contains: query.q?.trim() ?? '',
      mode: 'insensitive' as const,
    };
    const where: Prisma.SubmissionWhereInput = {
      assignmentId,
      ...(query.status === 'graded'
        ? { grade: { not: null } }
        : query.status === 'ungraded'
          ? { grade: null }
          : {}),
      ...(query.q?.trim()
        ? {
            OR: [
              { student: { enrollmentCode: contains } },
              { student: { user: { firstName: contains } } },
              { student: { user: { lastName: contains } } },
            ],
          }
        : {}),
    };
    const meta = query.page
      ? pageMeta(await this.prisma.submission.count({ where }), query)
      : undefined;
    const pending = query.page
      ? await this.prisma.submission.count({
          where: { assignmentId, grade: null },
        })
      : undefined;
    const submissions = await this.prisma.submission.findMany({
      where,
      ...(meta
        ? { skip: (meta.page - 1) * meta.pageSize, take: meta.pageSize }
        : {}),
      include: {
        student: {
          select: {
            id: true,
            enrollmentCode: true,
            user: { select: publicUserSelect },
          },
        },
      },
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
    });
    return {
      message: 'Entregas obtenidas correctamente',
      submissions,
      pagination: meta,
      pending,
    };
  }

  async grade(userId: string, submissionId: string, dto: GradeSubmissionDto) {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: {
        userId,
      },
      include: {
        user: {
          select: publicUserSelect,
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException(
        'No existe un perfil docente asociado al usuario',
      );
    }

    if (teacher.user.status !== 'ACTIVE') {
      throw new ForbiddenException('El docente no se encuentra habilitado');
    }

    const submission = await this.prisma.submission.findUnique({
      where: {
        id: submissionId,
      },
      include: {
        assignment: {
          include: {
            group: {
              include: {
                subject: true,
              },
            },
          },
        },
        student: {
          include: {
            user: {
              select: publicUserSelect,
            },
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('La entrega no existe');
    }

    if (submission.assignment.group.teacherId !== teacher.id) {
      throw new ForbiddenException(
        'El docente no está autorizado para calificar esta entrega',
      );
    }

    const gradedSubmission = await serializable(this.prisma, async (tx) => {
      const current = await tx.submission.findUnique({
        where: { id: submission.id },
        include: { assignment: { include: { group: true } } },
      });
      if (!current || current.assignment.group.teacherId !== teacher.id)
        throw new ForbiddenException(
          'El docente no está autorizado para calificar esta entrega',
        );
      const updated = await tx.submission.update({
        where: {
          id: submission.id,
        },
        data: {
          grade: dto.grade,
          feedback: dto.feedback,
          gradedAt: new Date(),
        },
        include: {
          assignment: {
            include: {
              group: {
                include: {
                  subject: true,
                },
              },
            },
          },
          student: {
            include: {
              user: {
                select: publicUserSelect,
              },
            },
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId: userId,
          action: 'SUBMISSION_GRADED',
          entityId: submission.id,
          detail: JSON.stringify({
            previousGrade: current.grade?.toString() ?? null,
            grade: dto.grade,
          }),
        },
      });
      return updated;
    });

    return {
      message: 'Entrega calificada correctamente',
      submission: gradedSubmission,
    };
  }
}
