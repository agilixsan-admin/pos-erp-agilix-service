import http from 'k6/http';
import { check, group } from 'k6';
import { BASE_URL } from '../config.js';
import { authHeaders, unwrap, expect, randInt } from '../lib/http.js';

// Purchasing (supplier -> purchase -> receive) and stock-opname flows.
export function purchasingFlow(data) {
  const h = authHeaders(data);
  const { outletId, supplierId, inventoryItemId } = data;

  group('purchasing: reads', () => {
    expect(http.get(`${BASE_URL}/suppliers`, h), 200, 'GET /suppliers');
    expect(http.get(`${BASE_URL}/suppliers/${supplierId}`, h), 200, 'GET /suppliers/:id');
    expect(http.get(`${BASE_URL}/purchases`, h), 200, 'GET /purchases');
    expect(http.get(`${BASE_URL}/stock-opnames`, h), 200, 'GET /stock-opnames');
  });

  if (Math.random() < 0.5) {
    group('purchasing: create + receive purchase', () => {
      const qty = randInt(5, 20);
      const createRes = http.post(
        `${BASE_URL}/purchases`,
        JSON.stringify({
          outletId,
          supplierId,
          items: [
            {
              inventoryItemId,
              quantityOrdered: qty,
              unitCost: 80000,
            },
          ],
        }),
        h,
      );
      if (!expect(createRes, 201, 'POST /purchases')) return;
      const purchase = unwrap(createRes);

      expect(
        http.get(`${BASE_URL}/purchases/${purchase.id}`, h),
        200,
        'GET /purchases/:id',
      );

      const receiveRes = http.post(
        `${BASE_URL}/purchases/${purchase.id}/receive`,
        JSON.stringify({}),
        h,
      );
      expect(receiveRes, [200, 201], 'POST /purchases/:id/receive');
    });
  } else {
    group('stock-opname: create, count, finalize/cancel', () => {
      const createRes = http.post(
        `${BASE_URL}/stock-opnames`,
        JSON.stringify({ outletId, scope: 'ALL' }),
        h,
      );
      // The API allows only one stock-opname per outlet per day; since every
      // VU shares one fixture outlet, only the first call each day can
      // succeed. A same-day duplicate rejection is the correct, expected
      // response here, not a failure.
      const isDuplicateDateRejection =
        createRes.status === 400 &&
        createRes.json()?.code === 'STOCK_OPNAME_DUPLICATE_DATE';
      check(createRes, {
        'POST /stock-opnames -> 201 or expected same-day duplicate reject': (
          r,
        ) => r.status === 201 || isDuplicateDateRejection,
      });
      if (createRes.status !== 201) return;
      const opname = unwrap(createRes);

      const countsRes = http.put(
        `${BASE_URL}/stock-opnames/${opname.id}/counts`,
        JSON.stringify({
          items: [{ inventoryItemId, actualStock: randInt(0, 50) }],
        }),
        h,
      );
      expect(countsRes, 200, 'PUT /stock-opnames/:id/counts');

      if (Math.random() < 0.7) {
        expect(
          http.post(
            `${BASE_URL}/stock-opnames/${opname.id}/finalize`,
            JSON.stringify({}),
            h,
          ),
          [200, 201],
          'POST /stock-opnames/:id/finalize',
        );
      } else {
        expect(
          http.post(
            `${BASE_URL}/stock-opnames/${opname.id}/cancel`,
            JSON.stringify({}),
            h,
          ),
          [200, 201],
          'POST /stock-opnames/:id/cancel',
        );
      }
    });
  }
}
