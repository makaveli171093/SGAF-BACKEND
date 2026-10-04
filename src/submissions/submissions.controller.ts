import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Param,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '../generated/prisma/enums.js';
import { Roles } from '../auth/decorators/roles.decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateSubmissionDto } from './dto/create-submission.dto.js';
import { SubmissionsService } from './submissions.service.js';
import { GradeSubmissionDto } from './dto/grade-submission.dto.js';

@ApiTags('Submissions')
@ApiBearerAuth()
@Controller('submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @ApiOperation({
    summary: 'Enviar tarea',
    description:
      'Uso: STUDENT autenticado y ACTIVE. El estudiante debe estar matriculado en el grupo de la tarea, entregar antes de la fecha límite y no tener deuda vencida. Solo se permite una entrega por tarea y estudiante.',
  })
  @Post()
  @Roles(Role.STUDENT)
  create(
    @Body() dto: CreateSubmissionDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.submissionsService.create(req.user.id, dto);
  }

  @ApiOperation({
    summary: 'Calificar entrega',
    description:
      'Uso: TEACHER. Permite calificar una entrega únicamente si el docente autenticado está asignado al grupo de la tarea. La nota debe estar entre 1 y 100 y puede incluir retroalimentación.',
  })
  @Patch(':id/grade')
  @Roles(Role.TEACHER)
  grade(
    @Param('id') submissionId: string,
    @Body() dto: GradeSubmissionDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.submissionsService.grade(req.user.id, submissionId, dto);
  }
}
