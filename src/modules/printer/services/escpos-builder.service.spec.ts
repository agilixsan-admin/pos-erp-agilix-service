import { EscPosBuilderService } from './escpos-builder.service';
import { Order } from '../../order/entities/order.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { OrderItem } from '../../order/entities/order-item.entity';

describe('EscPosBuilderService', () => {
  let service: EscPosBuilderService;

  beforeEach(() => {
    service = new EscPosBuilderService();
  });

  describe('getColumnWidth', () => {
    it('returns 32 for 58mm', () => {
      expect(service.getColumnWidth('58mm')).toBe(32);
    });

    it('returns 48 for 80mm', () => {
      expect(service.getColumnWidth('80mm')).toBe(48);
    });
  });

  describe('buildReceipt', () => {
    it('builds valid ESC/POS receipt for completed order with cash payment', () => {
      const order = {
        id: 'order-1',
        orderNumber: 'ORD-2026-001',
        orderType: 'DINE_IN',
        tableNumber: 'Table 5',
        totalAmount: 55000,
        createdAt: new Date('2026-09-06T10:00:00Z'),
        tenant: { businessName: 'Agilix Cafe' },
        outlet: {
          name: 'Outlet Menteng',
          address: 'Jl. Menteng No. 1',
          phone: '08123456789',
        },
        items: [
          {
            id: 'item-1',
            quantity: 2,
            unitPrice: 20000,
            subtotal: 40000,
            notes: 'Less sugar',
            productName: 'Ice Coffee',
            variantName: 'Ice Coffee Regular',
          } as unknown as OrderItem,
          {
            id: 'item-2',
            quantity: 1,
            unitPrice: 15000,
            subtotal: 15000,
            productName: 'Croissant',
            variantName: '',
          } as unknown as OrderItem,
        ],
      } as unknown as Order;

      const payments = [
        {
          id: 'pay-1',
          paymentMethod: 'CASH',
          amount: 55000,
          cashTendered: 100000,
          changeAmount: 45000,
        } as unknown as Payment,
      ];

      const result = service.buildReceipt({
        order,
        payments,
        cashierName: 'Budi Kasir',
        paperSize: '58mm',
      });

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.base64).toBeDefined();
      expect(result.rawText).toContain('Agilix Cafe');
      expect(result.rawText).toContain('Outlet Menteng');
      expect(result.rawText).toContain('ORD-2026-001');
      expect(result.rawText).toContain('Kasir: Budi Kasir');
      expect(result.rawText).toContain('Ice Coffee');
      expect(result.rawText).toContain('Croissant');
      expect(result.rawText).toContain('TOTAL');
      expect(result.rawText).toContain('Tunai');
      expect(result.rawText).toContain('Kembalian');

      // Verify ESC/POS command sequences: init (0x1b, 0x40), cut (0x1d, 0x56)
      expect(result.buffer[0]).toBe(0x1b);
      expect(result.buffer[1]).toBe(0x40);
    });

    it('builds receipt for 80mm paper size', () => {
      const order = {
        id: 'order-2',
        orderNumber: 'ORD-2026-002',
        orderType: 'TAKE_AWAY',
        totalAmount: 30000,
        createdAt: new Date(),
        items: [],
      } as unknown as Order;

      const result = service.buildReceipt({
        order,
        paperSize: '80mm',
      });

      expect(result.rawText).toContain('TAKE AWAY');
      expect(result.buffer.length).toBeGreaterThan(0);
    });
  });

  describe('buildKitchenTicket', () => {
    it('builds kitchen ticket with item notes and quantities', () => {
      const order = {
        id: 'order-3',
        orderNumber: 'ORD-KITCHEN-1',
        orderType: 'DINE_IN',
        tableNumber: 'Meja 3',
        createdAt: new Date(),
        items: [
          {
            id: 'item-1',
            quantity: 3,
            notes: 'Pedas level 5',
            productName: 'Ayam Geprek',
            variantName: '',
          } as unknown as OrderItem,
        ],
      } as unknown as Order;

      const result = service.buildKitchenTicket({
        order,
        paperSize: '58mm',
      });

      expect(result.rawText).toContain('TIKET DAPUR');
      expect(result.rawText).toContain('ORD-KITCHEN-1');
      expect(result.rawText).toContain('3x Ayam Geprek');
      expect(result.rawText).toContain('Pedas level 5');
    });
  });

  describe('buildBarTicket', () => {
    it('builds bar ticket format', () => {
      const order = {
        id: 'order-4',
        orderNumber: 'ORD-BAR-1',
        orderType: 'TAKE_AWAY',
        createdAt: new Date(),
        items: [
          {
            id: 'item-1',
            quantity: 2,
            notes: 'Extra ice',
            productName: 'Matcha Latte',
            variantName: '',
          } as unknown as OrderItem,
        ],
      } as unknown as Order;

      const result = service.buildBarTicket({
        order,
        paperSize: '58mm',
      });

      expect(result.rawText).toContain('TIKET BAR');
      expect(result.rawText).toContain('ORD-BAR-1');
      expect(result.rawText).toContain('2x Matcha Latte');
      expect(result.rawText).toContain('Extra ice');
    });
  });
});
