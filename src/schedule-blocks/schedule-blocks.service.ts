import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { CreateScheduleBlockDto } from './dto/create-schedule-block.dto.js';

@Injectable()
export class ScheduleBlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateScheduleBlockDto) {
    const group = await this.prisma.group.findUnique({
      where: {
        id: dto.groupId,
      },
    });

    if (!group) {
      throw new NotFoundException('El grupo no existe');
    }

    const startTime = this.timeStringToDate(dto.startTime);
    const endTime = this.timeStringToDate(dto.endTime);

    if (startTime >= endTime) {
      throw new BadRequestException(
        'La hora de inicio no puede ser posterior a la hora de finalizacion',
      );
    }

    const overlappingBlock = await this.prisma.scheduleBlock.findFirst({
      where: {
        groupId: dto.groupId,
        dayOfWeek: dto.dayOfWeek,
        startTime: {
          lt: endTime,
        },
        endTime: {
          gt: startTime,
        },
      },
    });

    if (overlappingBlock) {
      throw new BadRequestException(
        'El nuevo bloque horario se solapa con otro bloque del mismo grupo',
      );
    }

    const scheduleBlock = await this.prisma.scheduleBlock.create({
      data: {
        groupId: dto.groupId,
        dayOfWeek: dto.dayOfWeek,
        startTime,
        endTime,
      },
    });

    return {
      message: 'Bloque horario creado correctamente',
      scheduleBlock,
    };
  }
  private timeStringToDate(time: string): Date {
    return new Date(`1970-01-01T${time}:00.000Z`);
  }
}
