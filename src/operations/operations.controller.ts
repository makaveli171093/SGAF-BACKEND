import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorators.js';
import { Role } from '../generated/prisma/enums.js';
import { OperationsService } from './operations.service.js';
import {
  ProfileDto,
  PasswordDto,
  AvatarDto,
  EditUserDto,
  UserStatusDto,
  EditSubjectDto,
  ReopenDto,
  EditGroupDto,
  EditScheduleDto,
  ReportQueryDto,
} from './operations.dto.js';
type RequestUser = { user: { id: string } };
@ApiTags('Administración')
@ApiBearerAuth()
@Controller('management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class OperationsController {
  constructor(private readonly service: OperationsService) {}
  @Patch('users/:id') editUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: EditUserDto,
    @Req() req: RequestUser,
  ) {
    return this.service.editUser(id, dto, req.user.id);
  }
  @Patch('users/:id/status') status(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UserStatusDto,
    @Req() req: RequestUser,
  ) {
    return this.service.userStatus(id, dto.status, req.user.id);
  }
  @Patch('subjects/:id') subject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: EditSubjectDto,
    @Req() req: RequestUser,
  ) {
    return this.service.editSubject(id, dto, req.user.id);
  }
  @Patch('periods/:id/reopen') reopen(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReopenDto,
    @Req() req: RequestUser,
  ) {
    return this.service.reopen(id, dto.reason, req.user.id);
  }
  @Get('periods/:id/history') history(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.history(id);
  }
  @Patch('groups/:id') group(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: EditGroupDto,
    @Req() req: RequestUser,
  ) {
    return this.service.editGroup(id, dto, req.user.id);
  }
  @Post('schedules') addSchedule(
    @Body() dto: EditScheduleDto,
    @Req() req: RequestUser,
  ) {
    return this.service.schedule(null, dto, req.user.id);
  }
  @Patch('schedules/:id') schedule(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: EditScheduleDto,
    @Req() req: RequestUser,
  ) {
    return this.service.schedule(id, dto, req.user.id);
  }
  @Delete('schedules/:id') remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestUser,
  ) {
    return this.service.removeSchedule(id, req.user.id);
  }
  @Get('metrics') metrics(@Query() query: ReportQueryDto) {
    return this.service.metrics(query);
  }
}
@ApiTags('Mi cuenta')
@ApiBearerAuth()
@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly service: OperationsService) {}
  @Get('summary') summary(@Req() req: RequestUser) {
    return this.service.summary(req.user.id);
  }
  @Patch('profile') profile(@Req() req: RequestUser, @Body() dto: ProfileDto) {
    return this.service.profile(req.user.id, dto);
  }
  @Patch('password') password(
    @Req() req: RequestUser,
    @Body() dto: PasswordDto,
  ) {
    return this.service.password(req.user.id, dto);
  }
  @Patch('avatar') avatar(@Req() req: RequestUser, @Body() dto: AvatarDto) {
    return this.service.avatar(req.user.id, dto.avatarData);
  }
}
