import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateEnrollmentDto) {
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
        'El estudiante no está habilitado para matricularse',
      );
    }

    const group = await this.prisma.group.findUnique({
      where: {
        id: dto.groupId,
      },
      include: {
        subject: true,
        academicPeriod: true,
        scheduleBlocks: true,
      },
    });
    if (!group) {
      throw new NotFoundException('El grupo solicitado no existe');
    }

    const now = new Date();
    if (
      group.academicPeriod.status !== 'ACTIVE' ||
      now < group.academicPeriod.startDate ||
      now > group.academicPeriod.endDate
    ) {
      throw new BadRequestException(
        'El grupo no pertenece a un período académico vigente',
      );
    }

    const currrentEnrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId: student.id,
        status: 'ACTIVE',
        group: {
          academicPeriodId: group.academicPeriodId,
        },
      },
      include: {
        group: {
          include: {
            subject: true,
          },
        },
      },
    });
    const currentCredits = currrentEnrollments.reduce(
      (total, enrollment) => total + enrollment.group.subject.credits,
      0,
    );
    const newTotalCredits = currentCredits + group.subject.credits;
    if (newTotalCredits > group.academicPeriod.maxCredits) {
      throw new BadRequestException(
        `La matricula supera el maximo de ${group.academicPeriod.maxCredits} creditos permitidos para el periodo`,
      );
    }

    const enrolledCount = await this.prisma.enrollment.count({
      where: {
        groupId: group.id,
        status: 'ACTIVE',
      },
    });
    if (enrolledCount >= group.maxCapacity) {
      throw new BadRequestException('El grupo a alcanzado su capacidad maxima');
    }

    const existingSubjectEnrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId: student.id,
        status: 'ACTIVE',
        group: {
          subjectId: group.subjectId,
          academicPeriodId: group.academicPeriodId,
        },
      },
      include: {
        group: {
          include: {
            subject: true,
          },
        },
      },
    });
    if (existingSubjectEnrollment) {
      throw new BadRequestException(
        `El estudiante ya esta matriculado en la materia ${group.subject.name} en este periodo`,
      );
    }

    const enrolledGroups = await this.prisma.enrollment.findMany({
      where: {
        studentId: student.id,
        status: 'ACTIVE',
        group: {
          academicPeriodId: group.academicPeriodId,
        },
      },
      include: {
        group: {
          include: {
            scheduleBlocks: true,
          },
        },
      },
    });

    for (const enrollment of enrolledGroups) {
      for (const exisitingBlock of enrollment.group.scheduleBlocks) {
        for (const newBlock of group.scheduleBlocks) {
          const sameDay = exisitingBlock.dayOfWeek === newBlock.dayOfWeek;

          const overlap =
            exisitingBlock.startTime < newBlock.endTime &&
            exisitingBlock.endTime > newBlock.startTime;

          if (sameDay && overlap) {
            throw new BadRequestException(
              'El grupo presenta un choque de horario con otra materia ya matriculada',
            );
          }
        }
      }
    }

    const enrollment = await this.prisma.$transaction(async (tx) => {
      const enrollmentCount = await tx.enrollment.count({
        where: {
          groupId: group.id,
          status: 'ACTIVE',
        },
      });
      if (enrolledCount >= group.maxCapacity) {
        throw new BadRequestException(
          'El grupo ya alcanzo su capacidad maxima',
        );
      }
      const duplicateEnrollment = await tx.enrollment.findFirst({
        where: {
          studentId: student.id,
          status: 'ACTIVE',
          group: {
            subjectId: group.subjectId,
            academicPeriodId: group.academicPeriodId,
          },
        },
      });

      if (duplicateEnrollment) {
        throw new BadRequestException(
          `El estudiante ya esta matriculado en la materia ${group.subject.name} en este periodo`,
        );
      }

      return tx.enrollment.create({
        data: {
          studentId: student.id,
          groupId: group.id,
          status: 'ACTIVE',
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
    });

    return {
      message: 'Matrícula registrada correctamente',
      enrollment,
    };
  }
}
