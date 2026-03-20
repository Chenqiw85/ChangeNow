/**
 * Stress test — find the system's breaking point.
 * Gradually increases load from 1 to 100 concurrent users.
 * Run: k6 run stress.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users in 1 min
    { duration: '2m', target: 10 },   // Stay at 10 users for 2 min
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users for 2 min
    { duration: '1m', target: 100 },  // Ramp up to 100 users
    { duration: '2m', target: 100 },  // Stay at 100 users for 2 min
    { duration: '1m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],  // P95 under 5 seconds
    http_req_failed: ['rate<0.05'],     // Less than 5% errors
  },
};

// Each VU gets its own user account
export function setup() {
  const users = [];
  for (let i = 0; i < 100; i++) {
    const email = `stress-${Date.now()}-${i}@test.com`;

    http.post(`${BASE_URL}/v1/auth/register`, JSON.stringify({
      email: email,
      password: 'testpass123',
    }), { headers: { 'Content-Type': 'application/json' } });

    const loginRes = http.post(`${BASE_URL}/v1/auth/login`, JSON.stringify({
      email: email,
      password: 'testpass123',
    }), { headers: { 'Content-Type': 'application/json' } });

    try {
      const token = JSON.parse(loginRes.body).access_token;
      users.push({ email, token });
    } catch (e) {
      // If registration/login fails, skip this user
    }
  }
  return { users };
}

export default function (data) {
  // Each VU picks a user based on its ID
  const userIndex = (__VU - 1) % data.users.length;
  const user = data.users[userIndex];

  if (!user || !user.token) return;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${user.token}`,
  };

  // Mix of read and write operations (realistic traffic pattern)
  const rand = Math.random();

  if (rand < 0.3) {
    // 30% — submit plan generation
    const res = http.post(`${BASE_URL}/v1/plans/generate`, JSON.stringify({
      goal: 'build muscle',
      days_per_week: Math.floor(Math.random() * 5) + 2,
      equipment: 'full gym',
      constraints: 'none',
    }), { headers });

    check(res, {
      'generate: accepted': (r) => r.status === 202 || r.status === 200,
      'generate: not rate limited': (r) => r.status !== 429,
    });

  } else if (rand < 0.7) {
    // 40% — poll task status (simulating waiting users)
    // Use a placeholder task ID — will get 404 but tests the route
    const res = http.get(`${BASE_URL}/v1/tasks/00000000-0000-0000-0000-000000000000`, { headers });
    check(res, {
      'task poll: responded': (r) => r.status === 200 || r.status === 404,
    });

  } else {
    // 30% — health check (lightweight)
    const res = http.get(`${BASE_URL}/v1/health`);
    check(res, {
      'health: status 200': (r) => r.status === 200,
    });
  }

  sleep(Math.random() * 2 + 0.5); // 0.5-2.5 seconds between requests
}