import { Test, TestingModule } from '@nestjs/testing';
import { OrderPrintController } from './order-print.controller';
import { PrinterService } from '../services/printer.service';
import { User } from '../../user/user.entity';

describe('OrderPrintController', () => {
  let controller: OrderPrintController;
  let printerService: jest.Mocked<Partial<PrinterService>>;

  const mockUser = {
    id: 'user-uuid-1',
    tenantId: 'tenant-uuid-1',
    name: 'Kasir Jamal',
    email: 'jamal@agilix.id',
  } as User;

  beforeEach(async () => {
    printerService = {
      printOrder: jest.fn().mockResolvedValue({
        orderId: 'order-uuid-1',
        status: 'READY_TO_PRINT',
      } as any),
      dispatchOrder: jest.fn().mockResolvedValue({
        orderId: 'order-uuid-1',
        printJobs: [],
      } as any),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderPrintController],
      providers: [
        {
          provide: PrinterService,
          useValue: printerService,
        },
      ],
    }).compile();

    controller = module.get<OrderPrintController>(OrderPrintController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('printOrder', () => {
    it('calls printerService.printOrder and returns standard response', async () => {
      const dto = { type: 'RECEIPT' as const };
      const res = await controller.printOrder(mockUser, 'order-uuid-1', dto);

      expect(printerService.printOrder).toHaveBeenCalledWith(
        mockUser.tenantId,
        'order-uuid-1',
        dto,
        mockUser.id,
        'Kasir Jamal',
      );
      expect(res.success).toBe(true);
      expect(res.message).toBe('Bill print job processed successfully');
    });
  });

  describe('dispatchOrder', () => {
    it('calls printerService.dispatchOrder and returns standard response', async () => {
      const dto = { mode: 'AUTO' as const };
      const res = await controller.dispatchOrder(mockUser, 'order-uuid-1', dto);

      expect(printerService.dispatchOrder).toHaveBeenCalledWith(
        mockUser.tenantId,
        'order-uuid-1',
        dto,
        mockUser.id,
        'Kasir Jamal',
      );
      expect(res.success).toBe(true);
      expect(res.message).toBe('Order tickets dispatched successfully');
    });
  });
});

