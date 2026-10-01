import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CreateMockPayPaymentInput {
  amount: number;
  currency: string;
  metadata: Record<string, string>;
}

interface MockPayPaymentResponse {
  id: string;
  checkout_url: string;
  [key: string]: unknown;
}

@Injectable()
export class MockPayService {
  constructor(private readonly configService: ConfigService) {}
  async createPayment(
    input: CreateMockPayPaymentInput,
  ): Promise<MockPayPaymentResponse> {
    const apiUrl = this.configService.getOrThrow<string>('MOCKPAY_API_URL');
    const secretKey =
      this.configService.getOrThrow<string>('MOCKPAY_SECRET_KEY');

    const response = await fetch(`${apiUrl}/api/v1/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new BadGatewayException('No se pudo comunicar con MockPay');
    }
    return response.json() as Promise<MockPayPaymentResponse>;
  }
}
