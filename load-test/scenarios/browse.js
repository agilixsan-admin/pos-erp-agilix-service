import http from 'k6/http';
import { group } from 'k6';
import { BASE_URL, HEALTH_URL } from '../config.js';
import { authHeaders, expect, pick } from '../lib/http.js';

// Read-heavy traffic: listing/browsing screens a POS front-end hits
// constantly (menu, tables, reports, settings). No mutation.
export function browseFlow(data) {
  const h = authHeaders(data);
  const { outletId } = data;

  group('browse: health', () => {
    expect(http.get(HEALTH_URL), 200, 'GET /health');
  });

  group('browse: catalog', () => {
    expect(http.get(`${BASE_URL}/categories`, h), 200, 'GET /categories');
    expect(
      http.get(`${BASE_URL}/products?outletId=${outletId}&limit=20`, h),
      200,
      'GET /products',
    );
    expect(http.get(`${BASE_URL}/products/${data.productId}`, h), 200, 'GET /products/:id');
    expect(
      http.get(`${BASE_URL}/packagings`, h),
      200,
      'GET /packagings',
    );
    expect(
      http.get(`${BASE_URL}/packagings/categories`, h),
      200,
      'GET /packagings/categories',
    );
  });

  group('browse: outlets and tables', () => {
    expect(http.get(`${BASE_URL}/outlets`, h), 200, 'GET /outlets');
    expect(http.get(`${BASE_URL}/outlets/${outletId}`, h), 200, 'GET /outlets/:id');
    expect(
      http.get(`${BASE_URL}/tables?outletId=${outletId}`, h),
      200,
      'GET /tables',
    );
  });

  group('browse: orders and transactions', () => {
    expect(http.get(`${BASE_URL}/orders?limit=20`, h), 200, 'GET /orders');
    expect(http.get(`${BASE_URL}/payments?limit=20`, h), 200, 'GET /payments');
    expect(
      http.get(`${BASE_URL}/transactions?limit=20`, h),
      200,
      'GET /transactions',
    );
  });

  group('browse: reports', () => {
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    expect(
      http.get(
        `${BASE_URL}/reports?outletId=${outletId}&startDate=${startDate}&endDate=${endDate}`,
        h,
      ),
      200,
      'GET /reports',
    );
    expect(
      http.get(
        `${BASE_URL}/reports/sales?outletId=${outletId}&startDate=${startDate}&endDate=${endDate}`,
        h,
      ),
      200,
      'GET /reports/sales',
    );
    expect(
      http.get(`${BASE_URL}/reports/inventory?outletId=${outletId}`, h),
      200,
      'GET /reports/inventory',
    );
  });

  group('browse: admin lists', () => {
    expect(http.get(`${BASE_URL}/users`, h), 200, 'GET /users');
    expect(http.get(`${BASE_URL}/roles`, h), 200, 'GET /roles');
    expect(http.get(`${BASE_URL}/roles/permissions`, h), 200, 'GET /roles/permissions');
    expect(http.get(`${BASE_URL}/settings?outletId=${outletId}`, h), 200, 'GET /settings');
    expect(
      http.get(`${BASE_URL}/settings/discounts`, h),
      200,
      'GET /settings/discounts',
    );
    expect(http.get(`${BASE_URL}/settings/taxes`, h), 200, 'GET /settings/taxes');
    expect(
      http.get(`${BASE_URL}/audit-logs?limit=20`, h),
      200,
      'GET /audit-logs',
    );
  });

  group('browse: auth/me', () => {
    expect(http.get(`${BASE_URL}/auth/me`, h), 200, 'GET /auth/me');
  });
}
