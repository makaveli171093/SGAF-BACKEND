import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

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

    return {
      message: 'Validaciones iniciales superadas; matrícula aún no creada',
      studentId: student.id,
      groupId: group.id,
    };
  }
}
