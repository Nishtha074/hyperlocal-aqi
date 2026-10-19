const request = require('supertest');
const app = require('../server');

describe('Task API', () => {
  test('GET /tasks returns 200', async () => {
    const response = await request(app).get('/tasks');
    expect(response.statusCode).toBe(200);
  });
});
