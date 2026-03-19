import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildConfiguration } from '../../src/config/configuration';
import { StorageService } from '../../src/storage/storage.service';

describe('Storage switching with IMAGE_STORAGE_DRIVER', () => {
  it('writes and removes files for local storage using relativePath values', async () => {
    const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-local-storage-'));
    const config = buildConfiguration({
      NODE_ENV: 'test',
      IMAGE_STORAGE_DRIVER: 'local',
      IMAGE_STORAGE_LOCAL_PATH: localRoot,
      APP_PUBLIC_BASE_URL: 'https://app.example.test'
    });

    const storageService = new StorageService(config);
    const relativePath = 'items/item-1/photo-local.jpg';

    const absolutePath = await storageService.writeBuffer(relativePath, Buffer.from('local-bytes'));
    expect(absolutePath.startsWith(localRoot)).toBe(true);

    const loaded = await fs.readFile(absolutePath, { encoding: 'utf-8' });
    expect(loaded).toBe('local-bytes');

    await storageService.removeFile(relativePath);
    await expect(fs.access(absolutePath)).rejects.toThrow();

    await fs.rm(localRoot, { recursive: true, force: true });
  });

  it('switches to nas driver path and keeps relativePath persistence contract', async () => {
    const nasRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-nas-storage-'));
    const config = buildConfiguration({
      NODE_ENV: 'test',
      IMAGE_STORAGE_DRIVER: 'nas',
      IMAGE_STORAGE_NAS_PATH: nasRoot,
      APP_PUBLIC_BASE_URL: 'https://app.example.test'
    });

    const storageService = new StorageService(config);
    const relativePath = 'items/item-2/photo-nas.jpg';

    const absolutePath = await storageService.writeBuffer(relativePath, Buffer.from('nas-bytes'));
    expect(storageService.getDriverName()).toBe('nas');
    expect(absolutePath.startsWith(nasRoot)).toBe(true);

    await storageService.removeFile(relativePath);
    await expect(fs.access(absolutePath)).rejects.toThrow();

    await fs.rm(nasRoot, { recursive: true, force: true });
  });
});
