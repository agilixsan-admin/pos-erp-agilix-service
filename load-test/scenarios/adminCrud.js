import http from 'k6/http';
import { group } from 'k6';
import { BASE_URL, HEAVY_PROFILE } from '../config.js';
import { authHeaders, unwrap, expect, uniq, pick } from '../lib/http.js';

// `POST /users` sends a real invitation email through whatever SMTP is
// configured in .env. Keep that off by default; opt in explicitly with
// `-e INCLUDE_USER_INVITES=true` once you know where those emails go.
const INCLUDE_USER_INVITES = (__ENV.INCLUDE_USER_INVITES || 'false') === 'true';

// Low-frequency admin/back-office CRUD, covering the remaining settings-ish
// controllers. Each branch creates its own throwaway resource and deletes
// it again so runs stay idempotent and don't pollute shared fixtures.
export function adminCrudFlow(data) {
  const h = authHeaders(data);
  const { outletId, variantId, inventoryItemId } = data;
  const suffix = uniq();

  const branches = [
    () => tableCrud(h, outletId, suffix),
    () => discountCrud(h, outletId, suffix),
    () => taxCrud(h, suffix),
    () => packagingCrud(h, outletId, suffix),
    () => printerCrud(h, outletId, suffix),
    () => roleCrud(h, outletId, suffix),
    () => recipeCrud(h, variantId, inventoryItemId),
    () => userReads(h),
  ];
  pick(branches)();
}

function tableCrud(h, outletId, suffix) {
  group('admin: table CRUD', () => {
    const createRes = http.post(
      `${BASE_URL}/tables`,
      JSON.stringify({ outletId, tableNumber: `AT-${suffix}` }),
      h,
    );
    if (!expect(createRes, 201, 'POST /tables')) return;
    const id = unwrap(createRes).id;
    expect(http.get(`${BASE_URL}/tables/${id}`, h), 200, 'GET /tables/:id');
    expect(
      http.put(`${BASE_URL}/tables/${id}`, JSON.stringify({ capacity: 6 }), h),
      200,
      'PUT /tables/:id',
    );
    expect(http.del(`${BASE_URL}/tables/${id}`, null, h), 200, 'DELETE /tables/:id');
  });
}

function discountCrud(h, outletId, suffix) {
  group('admin: discount CRUD', () => {
    const createRes = http.post(
      `${BASE_URL}/settings/discounts`,
      JSON.stringify({
        outletId,
        name: `LT Discount ${suffix}`,
        type: 'PERCENTAGE',
        value: 10,
        validityType: 'ALWAYS_ACTIVE',
      }),
      h,
    );
    if (!expect(createRes, 201, 'POST /settings/discounts')) return;
    const id = unwrap(createRes).id;
    expect(
      http.get(`${BASE_URL}/settings/discounts/${id}`, h),
      200,
      'GET /settings/discounts/:id',
    );
    expect(
      http.get(
        `${BASE_URL}/settings/discounts/applicable?outletId=${outletId}`,
        h,
      ),
      200,
      'GET /settings/discounts/applicable',
    );
    expect(
      http.put(
        `${BASE_URL}/settings/discounts/${id}`,
        JSON.stringify({ value: 15 }),
        h,
      ),
      200,
      'PUT /settings/discounts/:id',
    );
    expect(
      http.del(`${BASE_URL}/settings/discounts/${id}`, null, h),
      200,
      'DELETE /settings/discounts/:id',
    );
  });
}

function taxCrud(h, suffix) {
  group('admin: tax CRUD', () => {
    const createRes = http.post(
      `${BASE_URL}/settings/taxes`,
      JSON.stringify({ name: `LT Tax ${suffix}`, rate: 5, type: 'EXCLUSIVE' }),
      h,
    );
    if (!expect(createRes, 201, 'POST /settings/taxes')) return;
    const id = unwrap(createRes).id;
    expect(http.get(`${BASE_URL}/settings/taxes/${id}`, h), 200, 'GET /settings/taxes/:id');
    expect(
      http.put(`${BASE_URL}/settings/taxes/${id}`, JSON.stringify({ rate: 7 }), h),
      200,
      'PUT /settings/taxes/:id',
    );
    expect(
      http.del(`${BASE_URL}/settings/taxes/${id}`, null, h),
      200,
      'DELETE /settings/taxes/:id',
    );
  });
}

function packagingCrud(h, outletId, suffix) {
  group('admin: packaging CRUD', () => {
    const catRes = http.post(
      `${BASE_URL}/packagings/categories`,
      JSON.stringify({ name: `LT PkgCat ${suffix}` }),
      h,
    );
    if (!expect(catRes, 201, 'POST /packagings/categories')) return;
    const categoryId = unwrap(catRes).id;

    const pkgRes = http.post(
      `${BASE_URL}/packagings`,
      JSON.stringify({ name: `LT Pkg ${suffix}`, categoryId, outletId }),
      h,
    );
    if (expect(pkgRes, 201, 'POST /packagings')) {
      const pkgId = unwrap(pkgRes).id;
      expect(http.get(`${BASE_URL}/packagings/${pkgId}`, h), 200, 'GET /packagings/:id');
      expect(
        http.put(`${BASE_URL}/packagings/${pkgId}`, JSON.stringify({ status: 'INACTIVE' }), h),
        200,
        'PUT /packagings/:id',
      );
      expect(http.del(`${BASE_URL}/packagings/${pkgId}`, null, h), 200, 'DELETE /packagings/:id');
    }
    expect(
      http.del(`${BASE_URL}/packagings/categories/${categoryId}`, null, h),
      200,
      'DELETE /packagings/categories/:id',
    );
  });
}

function printerCrud(h, outletId, suffix) {
  group('admin: printer CRUD', () => {
    const createRes = http.post(
      `${BASE_URL}/printers`,
      JSON.stringify({
        outletId,
        name: `LT Printer ${suffix}`,
        type: 'KITCHEN',
        connectionType: 'NETWORK',
        ipAddress: '192.168.1.201',
      }),
      h,
    );
    if (!expect(createRes, 201, 'POST /printers')) return;
    const id = unwrap(createRes).id;
    expect(http.get(`${BASE_URL}/printers/${id}`, h), 200, 'GET /printers/:id');
    expect(
      http.get(`${BASE_URL}/printers/routing-rules?outletId=${outletId}`, h),
      200,
      'GET /printers/routing-rules',
    );
    // Skipped in heavy profiles — see HEAVY_PROFILE note in config.js.
    if (!HEAVY_PROFILE) {
      expect(
        http.post(`${BASE_URL}/printers/${id}/test-print`, null, h),
        [200, 201],
        'POST /printers/:id/test-print',
      );
    }
    expect(
      http.put(`${BASE_URL}/printers/${id}`, JSON.stringify({ isDefault: false }), h),
      200,
      'PUT /printers/:id',
    );
    expect(http.del(`${BASE_URL}/printers/${id}`, null, h), 200, 'DELETE /printers/:id');
  });
}

function roleCrud(h, outletId, suffix) {
  group('admin: role CRUD', () => {
    const createRes = http.post(
      `${BASE_URL}/roles`,
      JSON.stringify({
        name: `LT Role ${suffix}`,
        outletId,
        permissions: ['order.read'],
      }),
      h,
    );
    if (!expect(createRes, 201, 'POST /roles')) return;
    const id = unwrap(createRes).id;
    expect(http.get(`${BASE_URL}/roles/${id}`, h), 200, 'GET /roles/:id');
    expect(
      http.put(
        `${BASE_URL}/roles/${id}`,
        JSON.stringify({ name: `LT Role ${suffix} v2`, permissions: ['order.read', 'product.read'] }),
        h,
      ),
      200,
      'PUT /roles/:id',
    );
    expect(http.del(`${BASE_URL}/roles/${id}`, null, h), 200, 'DELETE /roles/:id');
  });

  if (INCLUDE_USER_INVITES) {
    const email = `loadtest+${suffix}@example.invalid`;
    const inviteRes = http.post(
      `${BASE_URL}/users`,
      JSON.stringify({ email, name: `Load Test User ${suffix}`, roleId: null, outletId }),
      h,
    );
    expect(inviteRes, [200, 201], 'POST /users');
  }
}

function recipeCrud(h, variantId, inventoryItemId) {
  // Read-only on purpose: variantId/inventoryItemId are the same fixtures
  // orderLifecycle sells against. Attaching a real recipe here makes every
  // subsequent order require raw-material stock that setup() never
  // provisions, so it starts failing with INSUFFICIENT_RAW_MATERIAL_STOCK
  // for the rest of the run.
  group('admin: recipe reads', () => {
    expect(
      http.get(`${BASE_URL}/recipes/variants/${variantId}`, h),
      200,
      'GET /recipes/variants/:variantId',
    );
    expect(
      http.get(`${BASE_URL}/recipes/variants/${variantId}/cogs`, h),
      200,
      'GET /recipes/variants/:variantId/cogs',
    );
    expect(
      http.get(`${BASE_URL}/recipes/materials/${inventoryItemId}`, h),
      200,
      'GET /recipes/materials/:inventoryItemId',
    );
  });
}

function userReads(h) {
  group('admin: user reads', () => {
    expect(http.get(`${BASE_URL}/users`, h), 200, 'GET /users');
  });
}
