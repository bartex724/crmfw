import { AuditRetentionService } from '../../src/audit/audit-retention.service';
import { redactSensitive } from '../../src/common/logging/redaction.util';
import { LOGIN_THROTTLE_LIMIT, LoginThrottleService } from '../../src/security/throttling.config';

describe('Foundation security hardening', () => {
  it('redaction removes credential and token fields from nested payloads', () => {
    const payload = {
      email: 'user@example.com',
      password: 'Secret123!',
      nested: {
        authorization: 'Bearer abc',
        tokenValue: 'abc',
        profile: {
          sessionId: 'sid-1'
        }
      }
    };

    const sanitized = redactSensitive(payload);
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.nested.authorization).toBe('[REDACTED]');
    expect(sanitized.nested.tokenValue).toBe('[REDACTED]');
    expect(sanitized.nested.profile.sessionId).toBe('[REDACTED]');
  });

  it('throttling blocks login attempts after configured threshold without account lockout mutation', () => {
    const service = new LoginThrottleService();
    const base = new Date('2026-03-19T00:00:00.000Z').getTime();
    const key = '127.0.0.1:admin@example.com';

    for (let index = 0; index < LOGIN_THROTTLE_LIMIT; index += 1) {
      expect(service.isAllowed(key, base + index * 1000)).toBe(true);
    }

    expect(service.isAllowed(key, base + LOGIN_THROTTLE_LIMIT * 1000)).toBe(false);
  });

  it('retention cleanup deletes audit records older than 90 days and preserves newer ones', async () => {
    const now = new Date('2026-03-19T00:00:00.000Z');
    const records = [
      { id: 'old', createdAt: new Date('2025-11-01T00:00:00.000Z') },
      { id: 'new', createdAt: new Date('2026-02-20T00:00:00.000Z') }
    ];

    const prismaMock = {
      auditLog: {
        deleteMany: jest.fn(async ({ where }: { where: { createdAt: { lt: Date } } }) => {
          const cutoff = where.createdAt.lt;
          const stale = records.filter((record) => record.createdAt.getTime() < cutoff.getTime());
          for (const entry of stale) {
            const index = records.findIndex((record) => record.id === entry.id);
            if (index >= 0) {
              records.splice(index, 1);
            }
          }
          return { count: stale.length };
        })
      }
    };

    const retention = new AuditRetentionService(prismaMock as never);
    const deleted = await retention.cleanup(now);

    expect(deleted).toBe(1);
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('new');
  });
});
