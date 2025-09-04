// K6 Load Testing Script for Gamalan AI-Agile Platform
// Run with: k6 run load_test.js

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const responseTimeP95 = new Trend('response_time_p95');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 20 }, // Ramp up to 20 users  
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    error_rate: ['rate<0.1'],         // Error rate under 10%
    http_req_failed: ['rate<0.1'],    // Request failure rate under 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

// Test data
const testData = {
  projects: [
    { name: 'Load Test Project 1', description: 'Performance testing project' },
    { name: 'Load Test Project 2', description: 'Stress testing project' },
  ],
  stories: [
    { title: 'Load Test Story', description: 'Performance test story', labels: ['test'] },
    { title: 'Stress Test Story', description: 'Load testing story', labels: ['performance'] },
  ],
  tasks: [
    { title: 'Load Test Task', description: 'Performance test task', acceptance_criteria_refs: ['AC1'] },
  ],
};

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
  };

  group('Health Checks', function () {
    // Test system health endpoints
    const healthResponse = http.get(`${BASE_URL}/health`);
    check(healthResponse, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time < 100ms': (r) => r.timings.duration < 100,
    });
    
    const readyResponse = http.get(`${BASE_URL}/ready`);
    check(readyResponse, {
      'readiness check status is 200': (r) => r.status === 200,
      'readiness check response time < 100ms': (r) => r.timings.duration < 100,
    });
  });

  group('Authentication Flow', function () {
    // Test protected endpoints without auth
    const unauthorizedResponse = http.get(`${BASE_URL}/api/v1/projects`);
    check(unauthorizedResponse, {
      'unauthorized access returns 401': (r) => r.status === 401,
    });
  });

  group('Projects API', function () {
    // Get projects list
    const getProjectsResponse = http.get(`${BASE_URL}/api/v1/projects`, { headers });
    const getProjectsSuccess = check(getProjectsResponse, {
      'get projects status is 200': (r) => r.status === 200,
      'get projects response time < 300ms': (r) => r.timings.duration < 300,
      'projects response is valid JSON': (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch (e) {
          return false;
        }
      },
    });
    
    errorRate.add(!getProjectsSuccess);
    responseTimeP95.add(getProjectsResponse.timings.duration);

    // Create project
    const createProjectPayload = JSON.stringify(testData.projects[0]);
    const createProjectResponse = http.post(
      `${BASE_URL}/api/v1/projects`,
      createProjectPayload,
      { headers }
    );
    
    check(createProjectResponse, {
      'create project status is 201': (r) => r.status === 201,
      'create project response time < 500ms': (r) => r.timings.duration < 500,
    });
  });

  group('Backlog API', function () {
    const projectId = '550e8400-e29b-41d4-a716-446655440000'; // Test project ID

    // Get stories for project
    const getStoriesResponse = http.get(
      `${BASE_URL}/api/v1/projects/${projectId}/stories`,
      { headers }
    );
    
    check(getStoriesResponse, {
      'get stories status is 200': (r) => r.status === 200,
      'get stories response time < 400ms': (r) => r.timings.duration < 400,
    });

    // Create story
    const createStoryPayload = JSON.stringify(testData.stories[0]);
    const createStoryResponse = http.post(
      `${BASE_URL}/api/v1/projects/${projectId}/stories`,
      createStoryPayload,
      { headers }
    );
    
    check(createStoryResponse, {
      'create story status is 201': (r) => r.status === 201,
      'create story response time < 600ms': (r) => r.timings.duration < 600,
    });
  });

  group('Readiness API', function () {
    const storyId = '550e8400-e29b-41d4-a716-446655440001'; // Test story ID

    // Check story readiness
    const readinessResponse = http.get(
      `${BASE_URL}/api/v1/stories/${storyId}/readiness`,
      { headers }
    );
    
    check(readinessResponse, {
      'readiness check status is 200': (r) => r.status === 200,
      'readiness check response time < 800ms': (r) => r.timings.duration < 800,
    });
  });

  group('Prompt Builder API', function () {
    const storyId = '550e8400-e29b-41d4-a716-446655440001'; // Test story ID

    // Generate plan pack
    const planPackResponse = http.post(
      `${BASE_URL}/api/v1/stories/${storyId}/plan-pack`,
      '{}',
      { headers }
    );
    
    check(planPackResponse, {
      'plan pack generation status is 200 or 201': (r) => r.status === 200 || r.status === 201,
      'plan pack response time < 2000ms': (r) => r.timings.duration < 2000, // AI operations take longer
    });
  });

  // Simulate realistic user behavior with think time
  sleep(1);
}

// Cleanup function
export function teardown(data) {
  console.log('Load test completed');
  console.log(`Error rate: ${errorRate.rate * 100}%`);
}