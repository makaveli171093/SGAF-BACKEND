import {
  IsString,
  IsNotEmpty,
  IsEmail,
  Length,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsIn,
  IsInt,
  Min,
  Max,
  IsNumber,
  IsDateString,
  Matches,
  ValidateIf,
} from 'class-validator';
import { CreateGroupDto } from '../groups/dto/create-group.dto.js';
import { CreateScheduleBlockDto } from '../schedule-blocks/dto/create-schedule-block.dto.js';
export class ProfileDto {
  @IsString() @IsNotEmpty() @MaxLength(100) firstName: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lastName: string;
  @IsEmail() email: string;
  @IsString() @MaxLength(30) phone: string;
}
export class EditUserDto extends ProfileDto {
  @IsString() @Length(5, 20) ci: string;
  @IsOptional() @IsString() @MaxLength(150) specialty?: string;
  @IsOptional() @IsDateString() hireDate?: string;
}
export class UserStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE']) status: 'ACTIVE' | 'INACTIVE';
}
export class PasswordDto {
  @IsString() @MinLength(1) currentPassword: string;
  @IsString() @MinLength(8) @MaxLength(72) newPassword: string;
}
export class AvatarDto {
  @ValidateIf((_o, value) => value !== null)
  @IsString()
  @MaxLength(180000)
  @Matches(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
  avatarData: string | null;
}
export class EditSubjectDto {
  @IsString() @IsNotEmpty() code: string;
  @IsString() @IsNotEmpty() name: string;
  @IsInt() @Min(1) credits: number;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  enrollmentFee: number;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  monthlyFee: number;
  @IsBoolean() active: boolean;
}
export class ReopenDto {
  @IsString() @MinLength(10) @MaxLength(500) reason: string;
}
export class EditGroupDto extends CreateGroupDto {}
export class EditScheduleDto extends CreateScheduleBlockDto {}
export class ReportQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
}
