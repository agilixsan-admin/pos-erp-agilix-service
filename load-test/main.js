import { sleep } from 'k6';
import { BASE_URL, EMAIL, PASSWORD, ACTIVE_PROFILE, PROFILE } from './config.js';
import { login } from './lib/http.js';
import { setupFixtures } from './setup.js';
import { browseFlow } from './scenarios/browse.js';
import { orderLifecycleFlow } from './scenarios/orderLifecycle.js';
import { inventoryOpsFlow } from './scenarios/inventoryOps.js';
import { purchasingFlow } from './scenarios/purchasing.js';
import { adminCrudFlow } from './scenarios/adminCrud.js';

export const options = {
  scenarios: {
    main: {
      exec: 'default',
      ...ACTIVE_PROFILE,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
  },
};

export function setup() {
  console.log(`[setup] profile=${PROFILE} baseUrl=${BASE_URL}`);
  const token = login(BASE_URL, EMAIL, PASSWORD);
  const fixtures = setupFixtures(BASE_URL, token);
  console.log('[setup] fixtures ready', JSON.stringify(fixtures));
  // tokenIssuedAt lets each VU know when to re-login (see authHeaders).
  return { token, tokenIssuedAt: Date.now(), ...fixtures };
}

// Weighted mix approximating real POS traffic: mostly reads, then order
// checkout (the core flow), then lower-frequency inventory/purchasing/admin
// operations.
const WEIGHTED_FLOWS = [
  { weight: 0.45, fn: browseFlow },
  { weight: 0.25, fn: orderLifecycleFlow },
  { weight: 0.15, fn: inventoryOpsFlow },
  { weight: 0.08, fn: purchasingFlow },
  { weight: 0.07, fn: adminCrudFlow },
];

export default function (data) {
  const r = Math.random();
  let acc = 0;
  for (const { weight, fn } of WEIGHTED_FLOWS) {
    acc += weight;
    if (r <= acc) {
      fn(data);
      break;
    }
  }
  sleep(Math.random() * 2 + 0.5);
}
