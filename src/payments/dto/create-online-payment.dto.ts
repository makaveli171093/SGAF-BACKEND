import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateOnlinePaymentDto {
  @ApiProperty({
    description: 'ID de la obligacion financiera que quiere pagar',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  obligationId: string;
}
