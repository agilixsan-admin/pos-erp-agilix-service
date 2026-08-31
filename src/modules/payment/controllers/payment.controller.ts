import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { PaymentService } from '../services/payment.service';
import {
  CreatePaymentDto,
  QueryPaymentDto,
  QueryTransactionDto,
} from '../dto/payment.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';

@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('payments')
  @Permissions('payment.read')
  async findPayments(
    @CurrentUser() user: User,
    @Query() query: QueryPaymentDto,
  ) {
    const effectiveOutletId = query.outletId ?? user.outletId ?? undefined;
    const result = await this.paymentService.findPayments(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Payments retrieved successfully',
      ...result,
    };
  }

  @Post('payments')
  @Permissions('payment.create')
  async createPayment(
    @CurrentUser() user: User,
    @Body() dto: CreatePaymentDto,
  ) {
    const data = await this.paymentService.create(user.tenantId, user.id, dto);
    return {
      success: true,
      message: 'Payment processed and transaction completed successfully',
      data,
    };
  }

  @Get('transactions')
  @Permissions('transaction.read')
  async findTransactions(
    @CurrentUser() user: User,
    @Query() query: QueryTransactionDto,
  ) {
    const effectiveOutletId = query.outletId ?? user.outletId ?? undefined;
    const result = await this.paymentService.findTransactions(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Transactions retrieved successfully',
      ...result,
    };
  }

  @Get('transactions/:id')
  @Permissions('transaction.read')
  async findTransactionById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.paymentService.findTransactionById(
      user.tenantId,
      id,
    );
    return {
      success: true,
      message: 'Transaction details retrieved successfully',
      data,
    };
  }
}
