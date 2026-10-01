import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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

  @Post()
  @Roles(Role.TEACHER)
  create(
    @Body() dto: CreateAssignmentDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.assignmentsService.create(req.user.id, dto);
  }
}
