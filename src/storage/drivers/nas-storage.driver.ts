import * as path from 'node:path';

export class NasStorageDriver {
  readonly driverName = 'nas' as const;

  constructor(private readonly basePath: string) {}

  resolve(relativePath: string): string {
    return path.resolve(this.basePath, relativePath);
  }
}
