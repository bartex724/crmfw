import { EventsService } from '../../src/events/events.service';
import { createEventsHarness } from './fixtures/events-harness';

type ReconciliationResponse = {
  status: string;
  lostQuantity: number;
  returnedQuantity: number;
};

type ReconciliationService = EventsService & {
  updateItemReconciliation: (
    eventId: string,
    eventItemId: string,
    dto: { lostQuantity: number; returnedQuantity: number },
    actorUserId: string | null
  ) => Promise<ReconciliationResponse>;
};

function createSubject() {
  const harness = createEventsHarness();
  const auditService = { record: jest.fn(async () => undefined) };
  const service = new EventsService(harness.prisma as never, auditService as never);

  return {
    harness,
    auditService,
    service: service as ReconciliationService
  };
}

async function createEventWithRow(service: EventsService, itemId: string, plannedQuantity: number) {
  const event = await service.createEvent(
    {
      name: 'Expo',
      eventDate: '2026-04-05T10:00:00.000Z',
      location: 'Hall A'
    },
    'admin-1'
  );
  const row = await service.addEventItem(
    String(event.id),
    {
      itemId,
      plannedQuantity
    },
    'admin-1'
  );

  return { event, row };
}

describe('Event item reconciliation', () => {
  it('applies lostQuantity delta to central stock', async () => {
    const { service, harness } = createSubject();
    const { event, row } = await createEventWithRow(service, harness.items[0].id, 5);

    const updated = await service.updateItemReconciliation(
      String(event.id),
      String(row.id),
      { lostQuantity: 2, returnedQuantity: 1 },
      'admin-1'
    );

    expect(updated.status).toBe('TO_PACK');
    expect(updated.lostQuantity).toBe(2);
    expect(updated.returnedQuantity).toBe(1);
    expect(harness.items[0].quantity).toBe(8);
    expect(harness.prisma.stockAdjustment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          delta: -2,
          beforeQuantity: 10,
          afterQuantity: 8
        })
      })
    );
  });

  it('rejects non-integer and out-of-range reconciliation quantities', async () => {
    const { service, harness } = createSubject();
    const { event, row } = await createEventWithRow(service, harness.items[0].id, 4);

    await expect(
      service.updateItemReconciliation(
        String(event.id),
        String(row.id),
        { lostQuantity: 1.5, returnedQuantity: 0 },
        'admin-1'
      )
    ).rejects.toThrow('integer');

    await expect(
      service.updateItemReconciliation(
        String(event.id),
        String(row.id),
        { lostQuantity: -1, returnedQuantity: 0 },
        'admin-1'
      )
    ).rejects.toThrow('between 0 and plannedQuantity');

    await expect(
      service.updateItemReconciliation(
        String(event.id),
        String(row.id),
        { lostQuantity: 5, returnedQuantity: 0 },
        'admin-1'
      )
    ).rejects.toThrow('between 0 and plannedQuantity');

    await expect(
      service.updateItemReconciliation(
        String(event.id),
        String(row.id),
        { lostQuantity: 0, returnedQuantity: 5 },
        'admin-1'
      )
    ).rejects.toThrow('between 0 and plannedQuantity');
  });

  it('rejects reconciliation when stock would become negative', async () => {
    const { service, harness } = createSubject();
    const { event, row } = await createEventWithRow(service, harness.items[1].id, 8);

    await expect(
      service.updateItemReconciliation(
        String(event.id),
        String(row.id),
        { lostQuantity: 6, returnedQuantity: 0 },
        'admin-1'
      )
    ).rejects.toThrow('Insufficient stock');

    expect(harness.items[1].quantity).toBe(5);
    expect(harness.prisma.stockAdjustment.create).not.toHaveBeenCalled();
  });

  it('does not change stock when only returnedQuantity changes', async () => {
    const { service, harness } = createSubject();
    const { event, row } = await createEventWithRow(service, harness.items[0].id, 5);
    const beforeQuantity = harness.items[0].quantity;

    const updated = await service.updateItemReconciliation(
      String(event.id),
      String(row.id),
      { lostQuantity: 0, returnedQuantity: 3 },
      'admin-1'
    );

    expect(updated.lostQuantity).toBe(0);
    expect(updated.returnedQuantity).toBe(3);
    expect(harness.items[0].quantity).toBe(beforeQuantity);
    expect(harness.prisma.stockAdjustment.create).not.toHaveBeenCalled();
  });

  it('applies repeat reconciliation updates using loss delta in both directions', async () => {
    const { service, harness } = createSubject();
    const { event, row } = await createEventWithRow(service, harness.items[0].id, 8);

    await service.updateItemReconciliation(
      String(event.id),
      String(row.id),
      { lostQuantity: 2, returnedQuantity: 0 },
      'admin-1'
    );
    await service.updateItemReconciliation(
      String(event.id),
      String(row.id),
      { lostQuantity: 5, returnedQuantity: 0 },
      'admin-1'
    );
    const updated = await service.updateItemReconciliation(
      String(event.id),
      String(row.id),
      { lostQuantity: 1, returnedQuantity: 0 },
      'admin-1'
    );

    expect(updated.lostQuantity).toBe(1);
    expect(harness.items[0].quantity).toBe(9);

    const deltas = harness.stockAdjustments.map((adjustment) => adjustment.delta);
    expect(deltas).toEqual([-2, -3, 4]);
  });

  it('records reconciliation audit metadata with before/after values and stock delta', async () => {
    const { service, harness, auditService } = createSubject();
    const { event, row } = await createEventWithRow(service, harness.items[0].id, 6);

    await service.updateItemReconciliation(
      String(event.id),
      String(row.id),
      { lostQuantity: 1, returnedQuantity: 1 },
      'admin-1'
    );
    await service.updateItemReconciliation(
      String(event.id),
      String(row.id),
      { lostQuantity: 3, returnedQuantity: 2 },
      'admin-1'
    );

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          previousLostQuantity: 1,
          nextLostQuantity: 3,
          previousReturnedQuantity: 1,
          nextReturnedQuantity: 2,
          stockDelta: -2,
          beforeItemQuantity: 9,
          afterItemQuantity: 7
        })
      })
    );
  });

  it('allows reconciliation writes for closed events', async () => {
    const { service, harness } = createSubject();
    const { event, row } = await createEventWithRow(service, harness.items[0].id, 5);
    await service.activateEvent(String(event.id), 'admin-1');
    await service.closeEvent(String(event.id), 'admin-1');

    const updated = await service.updateItemReconciliation(
      String(event.id),
      String(row.id),
      { lostQuantity: 1, returnedQuantity: 1 },
      'admin-1'
    );

    expect(updated.lostQuantity).toBe(1);
    expect(updated.returnedQuantity).toBe(1);
  });
});
