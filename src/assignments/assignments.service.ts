import { ListQueryDto, pageMeta } from '../common/list-query.dto.js';
import { assignmentWhere, assignmentOrder } from './assignment-query.js';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { CreateAssignmentDto } from './dto/create-assignment.dto.js';
import { publicUserSelect } from '../common/selects/user-public.select.js';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAssignmentDto) {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: {
        userId,
      },
      include: {
        user: { select: publicUserSelect },
      },
    });

    if (!teacherProfile) {
      throw new NotFoundException(
        'No existe un perfil docente asociado al usuario',
      );
    }

    if (teacherProfile.user.status !== 'ACTIVE') {
      throw new ForbiddenException('El docente no se encuentra habilitado');
    }

    const group = await this.prisma.group.findUnique({
      where: {
        id: dto.groupId,
      },
      include: {
        subject: true,
        academicPeriod: true,
      },
    });

    if (!group) {
      throw new NotFoundException('El grupo no existe');
    }

    if (group.teacherId !== teacherProfile.id) {
      throw new ForbiddenException('El docente no está asignado a este grupo');
    }

    if (group.academicPeriod.status === 'CLOSED') {
      throw new BadRequestException(
        'No se pueden crear tareas en un período cerrado',
      );
    }

    const dueDate = new Date(dto.dueDate);

    if (dueDate <= new Date()) {
      throw new BadRequestException(
        'La fecha límite debe ser posterior a la fecha actual',
      );
    }

    const assignment = await this.prisma.assignment.create({
      data: {
        groupId: group.id,
        tittle: dto.title,
        instructions: dto.instructions,
        dueDate,
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

    return {
      message: 'Tarea creada correctamente',
      assignment,
    };
  }

  async getTeacherAssignments(userId: string, query: ListQueryDto = {}) {
    const where = assignmentWhere({ group: { teacher: { userId } } }, query);
    const meta = query.page
      ? pageMeta(await this.prisma.assignment.count({ where }), query)
      : undefined;
    const groups = query.page
      ? await this.prisma.group.findMany({
          where: { teacher: { userId } },
          select: {
            id: true,
            name: true,
            subject: { select: { name: true } },
            academicPeriod: { select: { name: true } },
          },
        })
      : [];
    const assignments = await this.prisma.assignment.findMany({
      where,
      ...(meta
        ? { skip: (meta.page - 1) * meta.pageSize, take: meta.pageSize }
        : {}),
      include: {
        group: { include: { subject: true, academicPeriod: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: assignmentOrder(query),
    });
    return {
      message: 'Tareas del docente obtenidas correctamente',
      pagination: meta,
      filters: {
        groups: groups.map((g) => ({
          id: g.id,
          label: g.subject.name + ' · ' + g.name,
        })),
        periods: [...new Set(groups.map((g) => g.academicPeriod.name))],
      },
      assignments,
    };
  }

  async getMyAssignments(userId: string, query: ListQueryDto = {}) {
    const student = await this.prisma.studentProfile.findUnique({
      where: {
        userId,
      },
    });

    if (!student) {
      throw new NotFoundException(
        'No existe un perfil estudiantil asociado al usuario',
      );
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId: student.id,
        status: 'ACTIVE',
      },
      select: {
        groupId: true,
      },
    });

    const groupIds = enrollments.map((enrollment) => enrollment.groupId);
    const where = assignmentWhere(
      { groupId: { in: groupIds } },
      query,
      student.id,
    );
    const meta = query.page
      ? pageMeta(await this.prisma.assignment.count({ where }), query)
      : undefined;
    const groups = query.page
      ? await this.prisma.group.findMany({
          where: { id: { in: groupIds } },
          select: { id: true, name: true, subject: { select: { name: true } } },
        })
      : [];

    const assignments = await this.prisma.assignment.findMany({
      where,
      ...(meta
        ? { skip: (meta.page - 1) * meta.pageSize, take: meta.pageSize }
        : {}),
      select: {
        id: true,
        tittle: true,
        instructions: true,
        dueDate: true,
        createdAt: true,

        group: {
          select: {
            id: true,
            name: true,

            subject: {
              select: {
                code: true,
                name: true,
              },
            },

            teacher: {
              select: {
                user: {
                  select: publicUserSelect,
                },
              },
            },
          },
        },

        submissions: {
          where: {
            studentId: student.id,
          },
          select: {
            id: true,
            textContent: true,
            fileUrl: true,
            grade: true,
            feedback: true,
            gradedAt: true,
            submittedAt: true,
          },
        },
      },
      orderBy: assignmentOrder(query),
    });

    return {
      message: 'Tareas obtenidas correctamente',
      pagination: meta,
      filters: {
        groups: groups.map((g) => ({
          id: g.id,
          label: g.subject.name + ' · ' + g.name,
        })),
      },
      assignments,
    };
  }
}
