import { Body, Controller, Post, Req, UseGuards, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '../generated/prisma/enums.js';
import { Roles } from '../auth/decorators/roles.decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { EnrollmentsService } from './enrollments.service.js';

@ApiTags('Enrollments')
@ApiBearerAuth()
@Controller('enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @ApiOperation({
    summary: 'Matricular estudiante en un grupo',
    description:
      'Uso: STUDENT autenticado y ACTIVE. Matricula al estudiante del JWT en un grupo, siempre que no exceda el máximo de créditos, el grupo tenga cupo, no esté inscrito en otro grupo de la misma materia y no exista choque horario. También bloquea la matrícula si tiene deuda vencida.',
  })
  @Post()
  @Roles(Role.STUDENT)
  create(
    @Body() dto: CreateEnrollmentDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.enrollmentsService.create(req.user.id, dto);
  }

  @ApiOperation({
    summary: 'Consultar mis matrículas',
    description:
      'Uso: STUDENT autenticado. Devuelve las matrículas del estudiante identificado por el JWT, incluyendo materia, grupo, período académico, docente y bloques horarios.',
  })
  @Get('my-enrollments')
  @ApiBearerAuth()
  @Roles(Role.STUDENT)
  getMyEnrollments(@Req() req: { user: { id: string } }) {
    return this.enrollmentsService.getMyEnrollments(req.user.id);
  }
}
