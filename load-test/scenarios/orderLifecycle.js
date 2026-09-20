import http from 'k6/http';
import { group, sleep } from 'k6';
import { BASE_URL, HEAVY_PROFILE } from '../config.js';
import { authHeaders, unwrap, expect, randInt } from '../lib/http.js';

// The core money-making flow: open an order, optionally touch it (extra
// item, discount, void, print/dispatch), then settle it with cash or QRIS.
export function orderLifecycleFlow(data) {
  const h = authHeaders(data);
  const { outletId, variantId, printerId } = data;
  const orderType = Math.random() < 0.5 ? 'DINE_IN' : 'TAKE_AWAY';

  // Fixtures share a single table across all concurrent VUs; assigning a
  // real tableId would just race everyone for the same table (TABLE_NOT_
  // AVAILABLE). Use a free-text tableNumber for DINE_IN instead, which
  // still exercises the field without a shared-resource lock.
  const createRes = http.post(
    `${BASE_URL}/orders`,
    JSON.stringify({
      outletId,
      orderType,
      tableNumber: orderType === 'DINE_IN' ? `LT-${__VU}` : undefined,
      items: [
        { variantId, quantity: randInt(1, 3) },
      ],
    }),
    h,
  );
  if (!expect(createRes, 201, 'POST /orders')) return;
  const order = unwrap(createRes);
  const orderId = order.id;

  // Occasionally add an extra item, then void it, to exercise both endpoints
  // without leaving the order unpayable (the original item stays intact).
  if (Math.random() < 0.3) {
    group('order: add + void item', () => {
      const addRes = http.post(
        `${BASE_URL}/orders/${orderId}/items`,
        JSON.stringify({ items: [{ variantId, quantity: 1 }] }),
        h,
      );
      if (expect(addRes, 201, 'POST /orders/:id/items')) {
        const updated = unwrap(addRes);
        const extraItem = updated.items?.[updated.items.length - 1];
        if (extraItem?.id) {
          const voidRes = http.post(
            `${BASE_URL}/orders/${orderId}/void`,
            JSON.stringify({
              orderItemId: extraItem.id,
              reason: 'Load test void',
            }),
            h,
          );
          expect(voidRes, 201, 'POST /orders/:id/void');
        }
      }
    });
  }

  // Occasionally apply a manual discount amount.
  if (Math.random() < 0.2) {
    const discountRes = http.put(
      `${BASE_URL}/orders/${orderId}/discount`,
      JSON.stringify({ discountAmount: 1000 }),
      h,
    );
    expect(discountRes, 200, 'PUT /orders/:id/discount');
  }

  // Kitchen/bar ticket dispatch happens while the order is still open —
  // unlike the bill, it doesn't require the order to be COMPLETED yet.
  if (Math.random() < 0.3) {
    const dispatchRes = http.post(
      `${BASE_URL}/orders/${orderId}/dispatch`,
      JSON.stringify({ mode: 'AUTO' }),
      h,
    );
    expect(dispatchRes, [200, 201], 'POST /orders/:id/dispatch');
  }

  // Re-fetch to get the authoritative total after any discount/void above.
  const detailRes = http.get(`${BASE_URL}/orders/${orderId}`, h);
  if (!expect(detailRes, 200, 'GET /orders/:id')) return;
  const freshOrder = unwrap(detailRes);
  const amount = Number(freshOrder.totalAmount) || 0;
  if (amount <= 0) return;

  sleep(0.2);

  let paid = false;
  if (Math.random() < 0.2) {
    group('order: pay with QRIS', () => {
      const genRes = http.post(
        `${BASE_URL}/payments/qris/generate`,
        JSON.stringify({ orderId }),
        h,
      );
      if (!expect(genRes, 201, 'POST /payments/qris/generate')) return;
      const qris = unwrap(genRes);

      expect(
        http.get(`${BASE_URL}/payments/qris/status/${orderId}`, h),
        200,
        'GET /payments/qris/status/:orderId',
      );
      expect(
        http.post(`${BASE_URL}/payments/qris/check/${orderId}`, null, h),
        [200, 201],
        'POST /payments/qris/check/:orderId',
      );
      if (qris?.paymentId) {
        paid = expect(
          http.post(
            `${BASE_URL}/payments/qris/simulate-pay/${qris.paymentId}`,
            null,
            h,
          ),
          [200, 201],
          'POST /payments/qris/simulate-pay/:paymentId',
        );
      }
    });
  } else {
    const payRes = http.post(
      `${BASE_URL}/payments`,
      JSON.stringify({
        orderId,
        paymentMethod: 'CASH',
        amount,
        cashGiven: amount,
      }),
      h,
    );
    paid = expect(payRes, 201, 'POST /payments (CASH)');
  }

  // The bill can only be printed once the order is COMPLETED. Skipped in
  // heavy profiles — see HEAVY_PROFILE note in config.js.
  if (!HEAVY_PROFILE && paid && Math.random() < 0.5) {
    const printRes = http.post(
      `${BASE_URL}/orders/${orderId}/print`,
      JSON.stringify({ printerId, type: 'RECEIPT' }),
      h,
    );
    expect(printRes, [200, 201], 'POST /orders/:id/print');
  }
}
