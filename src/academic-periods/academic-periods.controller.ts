import {
  Body,
  Controller,
  Post,
  UseGuards,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '../generated/prisma/enums.js';
import { Roles } from '../auth/decorators/roles.decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateAcademicPeriodDto } from './dto/create-academic-period.dto.js';
import { AcademicPeriodsService } from './academic-periods.service.js';
import { UpdateAcademicPeriodStatusDto } from './dto/update-academic-period-status.dto.js';

@ApiTags('Academic Periods')
@ApiBearerAuth()
@Controller('academic-periods')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicPeriodsController {
  constructor(private readonly academicPeriodService: AcademicPeriodsService) {}

  @ApiOperation({
    summary: 'Crear período académico',
    description:
      'Uso: ADMIN. Crea un período académico en estado PLANNED. La fecha de inicio debe ser anterior a la finalización y el máximo de créditos debe ser un entero positivo.',
  })
  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateAcademicPeriodDto) {
    return this.academicPeriodService.create(dto);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Activar o cerrar un período académico',
    description:
      'Uso: ADMIN. Permite PLANNED a ACTIVE dentro de las fechas de vigencia, y PLANNED o ACTIVE a CLOSED. CLOSED es definitivo. Repetir el estado actual no modifica datos. No hay cambios automáticos de estado por fecha.',
  })
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAcademicPeriodStatusDto,
  ) {
    return this.academicPeriodService.updateStatus(id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar periodos academicos',
    description:
      'Uso: Usuario autenticado. Devuelve los periodos academicos registrados, incluyendo fechas, limite de creditos y estado.',
  })
  findAll() {
    return this.academicPeriodService.findAll();
  }
}
