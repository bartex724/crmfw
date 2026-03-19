import { buildConfiguration } from '../../src/config/configuration';
import { validateEnv } from '../../src/config/env.schema';
import { StorageService } from '../../src/storage/storage.service';

function baseEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    IMAGE_STORAGE_DRIVER: 'local',
    IMAGE_STORAGE_LOCAL_PATH: './tmp/local-images'
  };
}

describe('Storage configuration validation', () => {
  it('fails for unsupported IMAGE_STORAGE_DRIVER value', () => {
    const env = {
      ...baseEnv(),
      IMAGE_STORAGE_DRIVER: 's3'
    } as NodeJS.ProcessEnv;

    expect(() => validateEnv(env)).toThrow(/IMAGE_STORAGE_DRIVER/);
  });

  it('requires path env var for selected driver', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'test',
        IMAGE_STORAGE_DRIVER: 'local'
      })
    ).toThrow(/IMAGE_STORAGE_LOCAL_PATH/);

    expect(() =>
      validateEnv({
        NODE_ENV: 'test',
        IMAGE_STORAGE_DRIVER: 'nas'
      })
    ).toThrow(/IMAGE_STORAGE_NAS_PATH/);
  });
});

describe('Storage driver selection', () => {
  it('selects local driver when IMAGE_STORAGE_DRIVER=local', () => {
    const config = buildConfiguration(baseEnv());
    const service = new StorageService(config);

    expect(service.getDriverName()).toBe('local');
    expect(service.resolvePath('photo.jpg')).toContain('photo.jpg');
  });

  it('selects nas driver when IMAGE_STORAGE_DRIVER=nas', () => {
    const config = buildConfiguration({
      NODE_ENV: 'test',
      IMAGE_STORAGE_DRIVER: 'nas',
      IMAGE_STORAGE_NAS_PATH: '\\\\nas\\warehouse\\images'
    });
    const service = new StorageService(config);

    expect(service.getDriverName()).toBe('nas');
    expect(service.resolvePath('photo.jpg')).toContain('photo.jpg');
  });
});
