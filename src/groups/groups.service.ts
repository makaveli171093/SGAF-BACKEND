import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { CreateGroupDto } from './dto/create-group.dto.js';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGroupDto) {
    const academicPeriod = await this.prisma.academicPeriod.findUnique({
      where: {
        id: dto.academicPeriodId,
      },
    });

    if (!academicPeriod) {
      throw new NotFoundException('El periodo academico no existe');
    }

    if (academicPeriod.status === 'CLOSED') {
      throw new BadRequestException(
        'No se puede crear grupos en un periodo cerrado',
      );
    }

    const subject = await this.prisma.subject.findUnique({
      where: {
        id: dto.subjectId,
      },
    });

    if (!subject) {
      throw new NotFoundException('La materia no existe');
    }

    if (!subject.active) {
      throw new BadRequestException('La materia se encuentra inactiva');
    }

    const teacher = await this.prisma.teacherProfile.findUnique({
      where: {
        id: dto.teacherId,
      },
      include: {
        user: true,
      },
    });

    if (!teacher) {
      throw new NotFoundException('El docente no existe');
    }

    if (teacher.user.status !== 'ACTIVE') {
      throw new BadRequestException('El docente se encuentra inactivo');
    }

    const existingGroup = await this.prisma.group.findFirst({
      where: {
        academicPeriodId: dto.academicPeriodId,
        subjectId: dto.subjectId,
        name: dto.name,
      },
    });

    if (existingGroup) {
      throw new ConflictException(
        'Ya existe un grupo con ese nombre para la materia y periodo',
      );
    }

    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        maxCapacity: dto.maxCapacity,
        subjectId: dto.subjectId,
        academicPeriodId: dto.academicPeriodId,
        teacherId: dto.teacherId,
      },
      include: {
        subject: true,
        academicPeriod: true,
        teacher: {
          include: {
            user: true,
          },
        },
      },
    });

    return {
      message: 'Grupo creado exitosamente',
      group,
    };
  }

  async getMyGroups(userId: string) {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: {
        userId,
      },
    });

    if (!teacher) {
      throw new NotFoundException(
        'No existe un perfil docente asociado al usuario',
      );
    }

    const groups = await this.prisma.group.findMany({
      where: {
        teacherId: teacher.id,
      },
      select: {
        id: true,
        name: true,
        maxCapacity: true,

        subject: {
          select: {
            code: true,
            name: true,
            credits: true,
          },
        },

        academicPeriod: {
          select: {
            name: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },

        scheduleBlocks: {
          select: {
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          },
        },

        _count: {
          select: {
            enrollments: true,
            assignments: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return {
      message: 'Grupos del docente obtenidos correctamente',
      groups,
    };
  }

  async findAll() {
    const groups = await this.prisma.group.findMany({
      select: {
        id: true,
        name: true,
        maxCapacity: true,

        subject: {
          select: {
            code: true,
            name: true,
            credits: true,
          },
        },

        academicPeriod: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },

        teacher: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },

        scheduleBlocks: {
          select: {
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          },
        },

        _count: {
          select: {
            enrollments: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return {
      message: 'Grupos obtenidos correctamente',
      groups,
    };
  }
}
