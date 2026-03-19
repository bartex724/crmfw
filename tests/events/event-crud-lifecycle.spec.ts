import { EventsService } from '../../src/events/events.service';
import { createEventsHarness } from './fixtures/events-harness';

describe('Event CRUD and lifecycle', () => {
  it('creates event, adds plannedQuantity items, and enforces lifecycle transitions', async () => {
    const harness = createEventsHarness();
    const auditService = { record: jest.fn(async () => undefined) };
    const service = new EventsService(harness.prisma as never, auditService as never);

    const created = await service.createEvent(
      {
        name: 'Expo Day',
        eventDate: '2026-04-05T10:00:00.000Z',
        location: 'Hall A'
      },
      'admin-1'
    );

    expect(created.lifecycleStatus).toBe('DRAFT');

    const added = await service.addEventItem(
      String(created.id),
      {
        itemId: harness.items[0].id,
        plannedQuantity: 3
      },
      'admin-1'
    );

    expect(added.plannedQuantity).toBe(3);
    expect(added.status).toBe('TO_PACK');

    const active = await service.activateEvent(String(created.id), 'admin-1');
    expect(active.lifecycleStatus).toBe('ACTIVE');

    const closed = await service.closeEvent(String(created.id), 'admin-1');
    expect(closed.lifecycleStatus).toBe('CLOSED');

    await expect(
      service.updateEvent(
        String(created.id),
        {
          location: 'Hall B'
        },
        'admin-1'
      )
    ).rejects.toThrow('Closed event is read-only');

    await expect(
      service.addEventItem(
        String(created.id),
        {
          itemId: harness.items[1].id,
          plannedQuantity: 1
        },
        'admin-1'
      )
    ).rejects.toThrow('Closed event is read-only');
  });

  it('requires Admin role to reopen closed events', async () => {
    const harness = createEventsHarness();
    const auditService = { record: jest.fn(async () => undefined) };
    const service = new EventsService(harness.prisma as never, auditService as never);

    const created = await service.createEvent(
      {
        name: 'Expo Day',
        eventDate: '2026-04-05T10:00:00.000Z',
        location: 'Hall A'
      },
      'admin-1'
    );
    await service.closeEvent(String(created.id), 'admin-1');

    await expect(service.reopenEvent(String(created.id), 'office-1', 'OFFICE_STAFF')).rejects.toThrow(
      'Only Admin can reopen closed events'
    );

    const reopened = await service.reopenEvent(String(created.id), 'admin-1', 'ADMIN');
    expect(reopened.lifecycleStatus).toBe('ACTIVE');
  });

  it('validates plannedQuantity and inventory item existence on event item add', async () => {
    const harness = createEventsHarness();
    const auditService = { record: jest.fn(async () => undefined) };
    const service = new EventsService(harness.prisma as never, auditService as never);

    const created = await service.createEvent(
      {
        name: 'Expo Day',
        eventDate: '2026-04-05T10:00:00.000Z',
        location: 'Hall A'
      },
      'admin-1'
    );

    await expect(
      service.addEventItem(
        String(created.id),
        {
          itemId: harness.items[0].id,
          plannedQuantity: 0
        },
        'admin-1'
      )
    ).rejects.toThrow('plannedQuantity must be a positive integer');

    await expect(
      service.addEventItem(
        String(created.id),
        {
          itemId: 'missing-item',
          plannedQuantity: 1
        },
        'admin-1'
      )
    ).rejects.toThrow('Inventory item not found');
  });
});
