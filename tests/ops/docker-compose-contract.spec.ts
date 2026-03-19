import * as fs from 'node:fs';
import * as path from 'node:path';

describe('docker compose contract', () => {
  it('includes postgres healthcheck and api dependency on service_healthy', () => {
    const composePath = path.join(process.cwd(), 'docker-compose.yml');
    const compose = fs.readFileSync(composePath, 'utf8');

    expect(compose).toContain('db:');
    expect(compose).toContain('healthcheck:');
    expect(compose).toContain('pg_isready');
    expect(compose).toContain('depends_on:');
    expect(compose).toContain('condition: service_healthy');
  });
});
