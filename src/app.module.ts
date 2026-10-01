import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { envValidationSchema } from './config/env.validation.js';
import { PrismaModule } from './database/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { AcademicPeriodsModule } from './academic-periods/academic-periods.module.js';
import { SubjectsModule } from './subjects/subjects.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { ScheduleBlocksModule } from './schedule-blocks/schedule-blocks.module.js';
import { EnrollmentsModule } from './enrollments/enrollments.module.js';
import { AssignmentsModule } from './assignments/assignments.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    AcademicPeriodsModule,
    SubjectsModule,
    GroupsModule,
    ScheduleBlocksModule,
    EnrollmentsModule,
    AssignmentsModule,
    SubmissionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
