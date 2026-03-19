import { buildConfiguration } from '../../src/config/configuration';

function baseEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    IMAGE_STORAGE_DRIVER: 'local',
    IMAGE_STORAGE_LOCAL_PATH: './tmp/local-images'
  };
}

describe('Box QR configuration', () => {
  it('requires APP_PUBLIC_BASE_URL', () => {
    expect(() =>
      buildConfiguration({
        ...baseEnv()
      })
    ).toThrow(/APP_PUBLIC_BASE_URL/);
  });

  it('normalizes trailing slash in APP_PUBLIC_BASE_URL', () => {
    const config = buildConfiguration({
      ...baseEnv(),
      APP_PUBLIC_BASE_URL: 'https://example.test/public/'
    });

    expect((config as Record<string, unknown>).publicBaseUrl).toBe('https://example.test/public');
  });
});
