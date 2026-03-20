/**
 * Smoke test — verify the system works under minimal load.
 * Run: k6 run smoke.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Test config: 1 user, 30 seconds
export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // P95 under 2 seconds
    http_req_failed: ['rate<0.01'],     // Less than 1% errors
  },
};

// Setup: register and login to get a token
export function setup() {
  const uniqueEmail = `loadtest-${Date.now()}@test.com`;

  // Register
  http.post(`${BASE_URL}/v1/auth/register`, JSON.stringify({
    email: uniqueEmail,
    password: 'testpass123',
  }), { headers: { 'Content-Type': 'application/json' } });

  // Login
  const loginRes = http.post(`${BASE_URL}/v1/auth/login`, JSON.stringify({
    email: uniqueEmail,
    password: 'testpass123',
  }), { headers: { 'Content-Type': 'application/json' } });

  const token = JSON.parse(loginRes.body).access_token;
  return { token };
}

// Main test function — runs repeatedly for each virtual user
export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  // 1. Health check
  const healthRes = http.get(`${BASE_URL}/v1/health`, { headers });
  check(healthRes, {
    'health: status 200': (r) => r.status === 200,
  });

  // 2. Submit plan generation
  const genRes = http.post(`${BASE_URL}/v1/plans/generate`, JSON.stringify({
    goal: 'build muscle',
    days_per_week: 3,
    equipment: 'dumbbells',
    constraints: 'none',
  }), { headers });

  check(genRes, {
    'generate: status 202': (r) => r.status === 202,
    'generate: has task_id': (r) => JSON.parse(r.body).task_id !== undefined,
  });

  // 3. Poll task status
  if (genRes.status === 202) {
    const taskId = JSON.parse(genRes.body).task_id;
    const taskRes = http.get(`${BASE_URL}/v1/tasks/${taskId}`, { headers });
    check(taskRes, {
      'task: status 200': (r) => r.status === 200,
    });
  }

  sleep(1); // 1 second between iterations
}