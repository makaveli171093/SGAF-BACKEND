import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateScheduleBlockDto) {
    return this.scheduleBlocksService.create(dto);
  }
}
