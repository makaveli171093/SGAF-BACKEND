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

@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSubmissionDto) {
    const student = await this.prisma.studentProfile.findUnique({
      where: {
        userId,
      },
      include: {
        user: true,
      },
    });

    if (!student) {
      throw new NotFoundException(
        'No existe un perfil estudiantil asociado al usuario',
      );
    }

    if (student.user.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'El estudiante no está habilitado para entregar tareas',
      );
    }

    if (!dto.textContent && !dto.fileUrl) {
      throw new BadRequestException(
        'La entrega debe contener texto o un archivo',
      );
    }

    const assignment = await this.prisma.assignment.findUnique({
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

    const enrollment = await this.prisma.enrollment.findFirst({
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

    const existingSubmission = await this.prisma.submission.findUnique({
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

    const submission = await this.prisma.submission.create({
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

    return {
      message: 'Entrega registrada correctamente',
      submission,
    };
  }

  async grade(userId: string, submissionId: string, dto: GradeSubmissionDto) {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: {
        userId,
      },
      include: {
        user: true,
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
            user: true,
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

    const gradedSubmission = await this.prisma.submission.update({
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
            user: true,
          },
        },
      },
    });

    return {
      message: 'Entrega calificada correctamente',
      submission: gradedSubmission,
    };
  }
}
