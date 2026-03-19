import { validateEnv } from './env.schema';

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  database: {
    url: string | null;
  };
  publicBaseUrl: string;
  storage: {
    driver: 'local' | 'nas';
    localPath: string | null;
    nasPath: string | null;
    activePath: string;
  };
};

export function buildConfiguration(rawEnv: NodeJS.ProcessEnv = process.env): AppConfig {
  const env = validateEnv({
    ...rawEnv,
    APP_PUBLIC_BASE_URL:
      rawEnv.APP_PUBLIC_BASE_URL?.trim() ||
      (rawEnv.VERCEL_URL ? `https://${rawEnv.VERCEL_URL}` : 'http://localhost:3000'),
    IMAGE_STORAGE_LOCAL_PATH: rawEnv.IMAGE_STORAGE_LOCAL_PATH?.trim() || '/tmp/crm-media'
  });
  const publicBaseUrl = normalizeBaseUrl(env.APP_PUBLIC_BASE_URL ?? 'http://localhost:3000');
  const activePath =
    env.IMAGE_STORAGE_DRIVER === 'local'
      ? env.IMAGE_STORAGE_LOCAL_PATH ?? ''
      : env.IMAGE_STORAGE_NAS_PATH ?? '';

  return {
    nodeEnv: env.NODE_ENV,
    database: {
      url: env.DATABASE_URL ?? null
    },
    publicBaseUrl,
    storage: {
      driver: env.IMAGE_STORAGE_DRIVER,
      localPath: env.IMAGE_STORAGE_LOCAL_PATH ?? null,
      nasPath: env.IMAGE_STORAGE_NAS_PATH ?? null,
      activePath
    }
  };
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}
