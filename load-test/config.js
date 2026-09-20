// Shared config for all k6 load test scripts.
// Override any of these via `k6 run -e NAME=value ...`

const rawBaseUrl = __ENV.BASE_URL || 'http://localhost:4500/api/v1';
export const BASE_URL = rawBaseUrl.replace(/\/$/, '');
export const HEALTH_URL =
  __ENV.HEALTH_URL || `${BASE_URL.replace(/\/api\/v1$/, '')}/health`;

export const EMAIL = __ENV.EMAIL || 'owner@testcafe.com';
export const PASSWORD = __ENV.PASSWORD || 'Password123!';

export const PROFILE = __ENV.PROFILE || 'smoke';

// executor configs per test target/goal
export const PROFILES = {
  // sanity check: does every flow work at all
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
  },
  // expected normal traffic
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 10 },
      { duration: '3m', target: 10 },
      { duration: '30s', target: 0 },
    ],
    gracefulRampDown: '10s',
  },
  // push past normal capacity to find the breaking point
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 20 },
      { duration: '2m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '2m', target: 150 },
      { duration: '1m', target: 0 },
    ],
    gracefulRampDown: '15s',
  },
  // sudden burst of traffic
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 5 },
      { duration: '10s', target: 200 },
      { duration: '40s', target: 200 },
      { duration: '10s', target: 5 },
      { duration: '20s', target: 0 },
    ],
    gracefulRampDown: '10s',
  },
  // sustained moderate load over a long window (memory leaks, slow degradation)
  soak: {
    executor: 'constant-vus',
    vus: 15,
    duration: '30m',
  },
};

export const ACTIVE_PROFILE = PROFILES[PROFILE] || PROFILES.smoke;

// Print/test-print made the origin hang and 502 under concurrent load in an
// earlier run (likely a blocking connect to an unreachable printer IP).
// Skip those calls in the heavy profiles so a stress/spike/soak run isn't
// dominated by that one known-risky path on shared staging.
export const HEAVY_PROFILE = ['stress', 'spike', 'soak'].includes(PROFILE);
