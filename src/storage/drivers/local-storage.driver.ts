import * as path from 'node:path';

export class LocalStorageDriver {
  readonly driverName = 'local' as const;

  constructor(private readonly basePath: string) {}

  resolve(relativePath: string): string {
    return path.resolve(this.basePath, relativePath);
  }
}
