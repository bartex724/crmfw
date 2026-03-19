import * as fs from 'node:fs';
import * as path from 'node:path';

describe('docker smoke contract', () => {
  it('Dockerfile runs as non-root and starts production runtime', () => {
    const dockerfilePath = path.join(process.cwd(), 'Dockerfile');
    const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');

    expect(dockerfile).toContain('FROM node:24-alpine');
    expect(dockerfile).toContain('USER app');
    expect(dockerfile).toContain('npx prisma migrate deploy');
    expect(dockerfile).toContain('node dist/src/main.js');
  });

  it('compose uses Dockerfile build wiring', () => {
    const composePath = path.join(process.cwd(), 'docker-compose.yml');
    const compose = fs.readFileSync(composePath, 'utf8');

    expect(compose).toContain('build:');
    expect(compose).toContain('dockerfile: Dockerfile');
    expect(compose).toContain('command: sh -c "npx prisma migrate deploy && node dist/src/main.js"');
  });
});
