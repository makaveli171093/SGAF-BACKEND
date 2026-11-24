import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class ListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
  @IsOptional() @IsString() @MaxLength(150) q?: string;
  @IsOptional() @IsString() @MaxLength(100) group?: string;
  @IsOptional() @IsString() @MaxLength(150) period?: string;
  @IsOptional()
  @IsIn(['all', 'pending', 'overdue', 'submitted', 'graded', 'ungraded'])
  status?: string;
  @IsOptional() @IsIn(['dueAsc', 'dueDesc', 'title']) order?: string;
}
export function pageMeta(total: number, query: ListQueryDto) {
  const pageSize = query.pageSize ?? 10;
  const page = Math.min(
    query.page ?? 1,
    Math.max(1, Math.ceil(total / pageSize)),
  );
  return { total, page, pageSize };
}
