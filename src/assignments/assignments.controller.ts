import { Body, Controller, Post, Req, UseGuards, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '../generated/prisma/enums.js';
import { Roles } from '../auth/decorators/roles.decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateAssignmentDto } from './dto/create-assignment.dto.js';
import { AssignmentsService } from './assignments.service.js';

@ApiTags('Assignments')
@ApiBearerAuth()
@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @ApiOperation({
    summary: 'Crear tarea para un grupo',
    description:
      'Uso: TEACHER. Permite crear una tarea únicamente en un grupo asignado al docente autenticado. El período no debe estar cerrado y la fecha límite debe ser futura.',
  })
  @Post()
  @Roles(Role.TEACHER)
  create(
    @Body() dto: CreateAssignmentDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.assignmentsService.create(req.user.id, dto);
  }

  @ApiOperation({
    summary: 'Consultar mis tareas',
    description:
      'Uso: STUDENT autenticado. Devuelve las tareas de los grupos en los que está matriculado, incluyendo materia, grupo, docente, fecha límite y la entrega propia si ya existe.',
  })
  @Get('my-assignments')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  getMyAssignments(@Req() req: { user: { id: string } }) {
    return this.assignmentsService.getMyAssignments(req.user.id);
  }
}
