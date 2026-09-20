import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { BASE_URL, EMAIL, PASSWORD } from '../config.js';

// Access tokens live 15 minutes (JWT_EXPIRES_IN), so any run longer than that
// must re-login mid-flight — setup()'s token alone dies ~23 minutes into a soak.
const REFRESH_AFTER_MS = Number(__ENV.TOKEN_REFRESH_MS || 12 * 60 * 1000);

let vuToken = null;
let vuTokenAt = 0;

export function jsonHeaders(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return { headers };
}

// The API wraps every response as { success, message, data | items/total/... }.
export function unwrap(res) {
  const body = res.json();
  if (body && typeof body === 'object' && 'data' in body) return body.data;
  return body;
}

// Defensive: list endpoints spread `{ items, total, page, limit }` or
// `{ data: [...] }` depending on the module. Try the common shapes.
export function unwrapList(res) {
  const body = res.json();
  if (!body) return [];
  if (Array.isArray(body.items)) return body.items;
  if (Array.isArray(body.data)) return body.data;
  if (body.data && Array.isArray(body.data.items)) return body.data.items;
  if (Array.isArray(body.results)) return body.results;
  return [];
}

export function expect(res, statuses, label) {
  const arr = Array.isArray(statuses) ? statuses : [statuses];
  const ok = check(res, {
    [`${label} -> ${arr.join('/')}`]: (r) => arr.includes(r.status),
  });
  if (!ok) {
    console.error(
      `[FAIL] ${label}: got ${res.status} body=${String(res.body).slice(0, 300)} url=${res.request.url}`,
    );
  }
  return ok;
}

export function login(baseUrl, email, password) {
  const res = http.post(
    `${baseUrl}/auth/login`,
    JSON.stringify({ email, password }),
    jsonHeaders(),
  );
  const ok = check(res, {
    'login succeeded': (r) => r.status === 200 || r.status === 201,
  });
  if (!ok) {
    fail(`Login failed (${res.status}): ${res.body}`);
  }
  const data = unwrap(res);
  if (!data || !data.accessToken) {
    fail(`Login response missing accessToken: ${res.body}`);
  }
  return data.accessToken;
}

// `auth/login` is throttled to 5/min per IP, and every VU's token expires at
// roughly the same moment — so back off and retry rather than failing the run.
function reLogin() {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: EMAIL, password: PASSWORD }),
      jsonHeaders(),
    );
    if (res.status === 200 || res.status === 201) {
      const data = unwrap(res);
      if (data && data.accessToken) return data.accessToken;
    }
    if (res.status !== 429) {
      console.error(
        `re-login failed (${res.status}): ${String(res.body).slice(0, 200)}`,
      );
    }
    sleep(5 + Math.random() * 10);
  }
  return null;
}

// Use this instead of jsonHeaders(data.token): it hands back the setup token
// while it is still fresh, then transparently re-logins per VU.
export function authHeaders(data) {
  const issuedAt = vuToken ? vuTokenAt : data.tokenIssuedAt || 0;
  if (Date.now() - issuedAt < REFRESH_AFTER_MS) {
    return jsonHeaders(vuToken || data.token);
  }
  const fresh = reLogin();
  if (fresh) {
    vuToken = fresh;
    vuTokenAt = Date.now();
  }
  return jsonHeaders(vuToken || data.token);
}

export function uniq() {
  // __VU/__ITER only exist during VU-context iterations, not in setup()/teardown().
  const vu = typeof __VU !== 'undefined' ? __VU : 'setup';
  const iter = typeof __ITER !== 'undefined' ? __ITER : 0;
  return `${vu}-${iter}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
