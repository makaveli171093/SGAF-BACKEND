import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '../generated/prisma/enums.js';
import { Roles } from '../auth/decorators/roles.decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateScheduleBlockDto } from './dto/create-schedule-block.dto.js';
import { ScheduleBlocksService } from './schedule-blocks.service.js';

@ApiTags('Schedule Blocks')
@ApiBearerAuth()
@Controller('schedule-blocks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduleBlocksController {
  constructor(private readonly scheduleBlocksService: ScheduleBlocksService) {}

  @ApiOperation({
    summary: 'Crear bloque horario',
    description:
      'Uso: ADMIN. Asigna un día y rango horario a un grupo. La hora de inicio debe ser anterior a la hora final y no debe existir solapamiento dentro del mismo grupo.',
  })
  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateScheduleBlockDto) {
    return this.scheduleBlocksService.create(dto);
  }
}
