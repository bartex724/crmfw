process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/crm?schema=public';
process.env.IMAGE_STORAGE_DRIVER ??= 'local';
process.env.IMAGE_STORAGE_LOCAL_PATH ??= './tmp/local-images';
process.env.IMAGE_STORAGE_NAS_PATH ??= '//nas/warehouse/images';
