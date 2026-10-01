import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { CreateAssignmentDto } from './dto/create-assignment.dto.js';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAssignmentDto) {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: {
        userId,
      },
      include: {
        user: true,
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
}
