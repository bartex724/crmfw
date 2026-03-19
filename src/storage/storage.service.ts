import { Inject, Injectable } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { APP_CONFIG } from '../config/config.module';
import type { AppConfig } from '../config/configuration';
import { LocalStorageDriver } from './drivers/local-storage.driver';
import { NasStorageDriver } from './drivers/nas-storage.driver';

type StorageDriver = LocalStorageDriver | NasStorageDriver;

@Injectable()
export class StorageService {
  private readonly driver: StorageDriver;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.driver =
      this.config.storage.driver === 'local'
        ? new LocalStorageDriver(this.config.storage.activePath)
        : new NasStorageDriver(this.config.storage.activePath);
  }

  getDriverName(): 'local' | 'nas' {
    return this.driver.driverName;
  }

  resolvePath(relativePath: string): string {
    return this.driver.resolve(relativePath);
  }

  async ensureDirectory(relativeDir: string): Promise<string> {
    const normalizedRelativeDir = relativeDir.trim();
    const absolutePath = this.resolvePath(normalizedRelativeDir);
    await fs.mkdir(absolutePath, { recursive: true });
    return absolutePath;
  }

  async writeBuffer(relativePath: string, buffer: Buffer): Promise<string> {
    const normalizedRelativePath = relativePath.trim();
    const absolutePath = this.resolvePath(normalizedRelativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer);
    return absolutePath;
  }

  async removeFile(relativePath: string): Promise<void> {
    const absolutePath = this.resolvePath(relativePath.trim());
    await fs.rm(absolutePath, { force: true });
  }
}
