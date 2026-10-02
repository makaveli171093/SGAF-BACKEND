import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class MockPayWebhookDto {
  @ApiProperty({
    example: 'payment.succeeded',
  })
  @IsString()
  event: string;

  @ApiProperty({
    example: '55122d11-01d6-49d3-a15e-e68a28433767',
  })
  @IsString()
  id: string;

  @ApiProperty({
    example: 200,
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    example: 'USD',
  })
  @IsString()
  currency: string;

  @ApiProperty({
    example: 'SUCCEEDED',
  })
  @IsIn(['SUCCEEDED', 'FAILED'])
  status: 'SUCCEEDED' | 'FAILED';

  @ApiPropertyOptional({
    example: 'insufficient_funds',
  })
  @IsOptional()
  @IsString()
  failure_reason?: string | null;

  @ApiProperty({
    example: {
      obligation_id: 'uuid-obligacion',
      student_id: 'uuid-estudiante',
    },
  })
  @IsObject()
  metadata: Record<string, string>;

  @ApiProperty({
    example: '2026-10-01T20:00:00Z',
  })
  @IsString()
  created_at: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  card_brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  last4?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customer_phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customer_address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customer_zip?: string;
}
