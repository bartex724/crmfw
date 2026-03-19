import type { INestApplication } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AccessModule } from '../../src/access/access.module';
import { AuthService, SessionAuthGuard } from '../../src/auth/auth.service';
import { InventoryController } from '../../src/inventory/inventory.controller';
import { InventoryService } from '../../src/inventory/inventory.service';

const inventoryServiceMock = {
  listCategories: jest.fn(async () => []),
  createCategory: jest.fn(async () => ({ id: 'c-1', name: 'Audio' })),
  updateCategory: jest.fn(async () => ({ id: 'c-1', name: 'Audio Pro' })),
  deleteCategory: jest.fn(async () => ({ deleted: true, id: 'c-1', force: false })),
  listItems: jest.fn(async () => []),
  getItem: jest.fn(async () => ({ id: 'i-1', name: 'Cable' })),
  createItem: jest.fn(async () => ({ id: 'i-1', code: 'ITM-0001', quantity: 5 })),
  updateItem: jest.fn(async () => ({ id: 'i-1', code: 'ITM-0001' })),
  deleteItem: jest.fn(async () => ({ deleted: true, id: 'i-1', force: false }))
};

@Module({
  imports: [AccessModule],
  controllers: [InventoryController],
  providers: [
    SessionAuthGuard,
    {
      provide: InventoryService,
      useValue: inventoryServiceMock
    },
    {
      provide: AuthService,
      useValue: {
        getAuthenticatedUserFromToken: jest.fn()
      }
    }
  ]
})
class InventoryRoleAccessTestModule {}

describe('Inventory role access', () => {
  let app: INestApplication;
  const previousNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [InventoryRoleAccessTestModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows warehouse staff inventory writes', async () => {
    await request(app.getHttpServer())
      .post('/inventory/categories')
      .set({ 'x-test-role': 'WAREHOUSE_STAFF' })
      .send({ name: 'Audio' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/inventory/items')
      .set({ 'x-test-role': 'WAREHOUSE_STAFF' })
      .send({ name: 'Cable', categoryId: 'cat-1', quantity: 5 })
      .expect(201);

    expect(inventoryServiceMock.createCategory).toHaveBeenCalledTimes(1);
    expect(inventoryServiceMock.createItem).toHaveBeenCalledTimes(1);
  });

  it('denies office staff and guest inventory writes', async () => {
    await request(app.getHttpServer())
      .post('/inventory/items')
      .set({ 'x-test-role': 'OFFICE_STAFF' })
      .send({ name: 'Cable', categoryId: 'cat-1', quantity: 5 })
      .expect(403);

    await request(app.getHttpServer())
      .patch('/inventory/items/i-1')
      .set({ 'x-test-role': 'OFFICE_STAFF' })
      .send({ name: 'Cable Updated' })
      .expect(403);

    await request(app.getHttpServer())
      .delete('/inventory/items/i-1')
      .set({ 'x-test-role': 'GUEST' })
      .expect(403);
  });

  it('allows office staff and guest inventory reads', async () => {
    await request(app.getHttpServer())
      .get('/inventory/categories')
      .set({ 'x-test-role': 'OFFICE_STAFF' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/inventory/items')
      .set({ 'x-test-role': 'GUEST' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/inventory/items/i-1')
      .set({ 'x-test-role': 'GUEST' })
      .expect(200);
  });
});
