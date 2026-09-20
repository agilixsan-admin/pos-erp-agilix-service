import http from 'k6/http';
import { fail } from 'k6';
import { jsonHeaders, unwrap, unwrapList, expect, uniq } from './lib/http.js';

// Creates the baseline fixtures every scenario shares: an outlet, a product
// with a sellable variant, a table, an inventory item, a supplier and a
// printer. Runs once in k6's setup() phase, not per-VU.
export function setupFixtures(baseUrl, token) {
  const h = jsonHeaders(token);
  const suffix = uniq();

  // 1. Outlet — seed script already creates "Outlet Utama"; reuse it.
  const outletsRes = http.get(`${baseUrl}/outlets`, h);
  expect(outletsRes, 200, 'setup: list outlets');
  const outlets = unwrapList(outletsRes);
  let outletId = outlets.length > 0 ? outlets[0].id : null;
  if (!outletId) {
    const createOutletRes = http.post(
      `${baseUrl}/outlets`,
      JSON.stringify({ name: `Load Test Outlet ${suffix}` }),
      h,
    );
    expect(createOutletRes, 201, 'setup: create outlet');
    outletId = unwrap(createOutletRes).id;
  }
  if (!outletId) fail('setup: could not resolve an outletId');

  // 2. Product category
  const categoryRes = http.post(
    `${baseUrl}/categories`,
    JSON.stringify({ name: `Load Test Category ${suffix}` }),
    h,
  );
  expect(categoryRes, 201, 'setup: create category');
  const categoryId = unwrap(categoryRes).id;

  // 3. Product with one sellable variant
  const productRes = http.post(
    `${baseUrl}/products`,
    JSON.stringify({
      name: `Load Test Product ${suffix}`,
      categoryId,
      price: 25000,
      status: 'ACTIVE',
      variants: [
        { name: 'Regular', sku: `LT-${suffix}`, price: 25000, status: 'ACTIVE' },
      ],
    }),
    h,
  );
  expect(productRes, 201, 'setup: create product');
  const product = unwrap(productRes);
  const variantId = product?.variants?.[0]?.id;
  if (!variantId) fail(`setup: product has no variant id: ${productRes.body}`);

  // 4. Table
  const tableRes = http.post(
    `${baseUrl}/tables`,
    JSON.stringify({
      outletId,
      tableNumber: `LT-${suffix}`,
      capacity: 4,
    }),
    h,
  );
  expect(tableRes, 201, 'setup: create table');
  const tableId = unwrap(tableRes).id;

  // 5. Inventory category + item (used by purchasing / inventory scenarios)
  const invCategoryRes = http.post(
    `${baseUrl}/inventory/categories`,
    JSON.stringify({ name: `Load Test Raw Material ${suffix}` }),
    h,
  );
  expect(invCategoryRes, 201, 'setup: create inventory category');
  const inventoryCategoryId = unwrap(invCategoryRes).id;

  const invItemRes = http.post(
    `${baseUrl}/inventory`,
    JSON.stringify({
      name: `Load Test Coffee Beans ${suffix}`,
      categoryId: inventoryCategoryId,
      unit: 'kg',
      unitCost: 80000,
      minimumStock: 5,
    }),
    h,
  );
  expect(invItemRes, 201, 'setup: create inventory item');
  const inventoryItemId = unwrap(invItemRes).id;

  // 6. Reason category for stock adjustments
  const reasonCategoryRes = http.post(
    `${baseUrl}/inventory/reason-categories`,
    JSON.stringify({ name: `Load Test Reason ${suffix}`, type: 'BOTH' }),
    h,
  );
  expect(reasonCategoryRes, 201, 'setup: create reason category');
  const reasonCategoryId = unwrap(reasonCategoryRes).id;

  // 7. Supplier
  const supplierRes = http.post(
    `${baseUrl}/suppliers`,
    JSON.stringify({ name: `Load Test Supplier ${suffix}` }),
    h,
  );
  expect(supplierRes, 201, 'setup: create supplier');
  const supplierId = unwrap(supplierRes).id;

  // 8. Printer (optional, referenced by print/dispatch flows)
  const printerRes = http.post(
    `${baseUrl}/printers`,
    JSON.stringify({
      outletId,
      name: `Load Test Printer ${suffix}`,
      type: 'RECEIPT',
      connectionType: 'NETWORK',
      ipAddress: '192.168.1.200',
    }),
    h,
  );
  expect(printerRes, 201, 'setup: create printer');
  const printerId = unwrap(printerRes).id;

  return {
    outletId,
    categoryId,
    productId: product.id,
    variantId,
    tableId,
    inventoryCategoryId,
    inventoryItemId,
    reasonCategoryId,
    supplierId,
    printerId,
  };
}
