import http from 'k6/http';
import { group } from 'k6';
import { BASE_URL } from '../config.js';
import { authHeaders, unwrap, expect, uniq, randInt } from '../lib/http.js';

// Inventory reads plus a stock adjustment against the shared item, and an
// isolated create/update/delete cycle for categories so we don't disturb
// fixtures other scenarios depend on.
export function inventoryOpsFlow(data) {
  const h = authHeaders(data);
  const { inventoryItemId, reasonCategoryId, outletId } = data;

  group('inventory: reads', () => {
    expect(http.get(`${BASE_URL}/inventory`, h), 200, 'GET /inventory');
    expect(
      http.get(`${BASE_URL}/inventory/categories`, h),
      200,
      'GET /inventory/categories',
    );
    expect(
      http.get(`${BASE_URL}/inventory/${inventoryItemId}`, h),
      200,
      'GET /inventory/:id',
    );
    expect(
      http.get(`${BASE_URL}/inventory/movements`, h),
      200,
      'GET /inventory/movements',
    );
    expect(
      http.get(`${BASE_URL}/inventory/reason-categories`, h),
      200,
      'GET /inventory/reason-categories',
    );
    expect(
      http.get(`${BASE_URL}/inventory/adjustments`, h),
      200,
      'GET /inventory/adjustments',
    );
  });

  if (Math.random() < 0.4) {
    group('inventory: stock adjustment', () => {
      const adjRes = http.post(
        `${BASE_URL}/inventory/adjustments`,
        JSON.stringify({
          type: Math.random() < 0.5 ? 'IN' : 'OUT',
          inventoryItemId,
          quantity: randInt(1, 5),
          reasonCategoryId,
          outletId,
          notes: 'Load test adjustment',
        }),
        h,
      );
      expect(adjRes, 201, 'POST /inventory/adjustments');
    });
  }

  if (Math.random() < 0.15) {
    group('inventory: category CRUD', () => {
      const suffix = uniq();
      const createRes = http.post(
        `${BASE_URL}/inventory/categories`,
        JSON.stringify({ name: `LT InvCat ${suffix}` }),
        h,
      );
      if (!expect(createRes, 201, 'POST /inventory/categories')) return;
      const id = unwrap(createRes).id;

      expect(
        http.put(
          `${BASE_URL}/inventory/categories/${id}`,
          JSON.stringify({ name: `LT InvCat ${suffix} updated`, status: 'ACTIVE' }),
          h,
        ),
        200,
        'PUT /inventory/categories/:id',
      );

      expect(
        http.del(`${BASE_URL}/inventory/categories/${id}`, null, h),
        200,
        'DELETE /inventory/categories/:id',
      );
    });
  }
}
