/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Orders (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterEach(async () => {
    await app?.close();
  });

  async function createAccountWithBalance(
    accountId: string,
    asset: string,
    available: number,
    locked = 0,
  ) {
    await prisma.accounts.upsert({
      where: { id: accountId },
      create: { id: accountId },
      update: {},
    });
    const now = new Date();
    await prisma.balances.upsert({
      where: { accountId_asset: { accountId, asset } },
      create: {
        id: `${accountId}-${asset}`,
        accountId,
        asset,
        available,
        locked,
        updatedAt: now,
      },
      update: {
        available,
        locked,
        updatedAt: now,
      },
    });
  }

  async function cleanup(...accountIds: string[]) {
    for (const id of accountIds) {
      await prisma.orders.deleteMany({ where: { accountId: id } });
      await prisma.balances.deleteMany({ where: { accountId: id } });
      await prisma.accounts.deleteMany({ where: { id } });
    }
    await prisma.outbox.deleteMany({});
  }

  describe('Test 1 — Successful BUY Order', () => {
    it('locks quote asset and creates order', async () => {
      const accountId = randomUUID();
      await createAccountWithBalance(accountId, 'USDT', 10000, 0);

      const res = await request(app.getHttpServer())
        .post('/orders')
        .send({
          accountId,
          marketId: 'BTC_USDT',
          side: 'BUY',
          price: '1000',
          quantity: '5',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        accountId,
        marketId: 'BTC_USDT',
        side: 'BUY',
        status: 'OPEN',
      });
      expect(parseFloat(res.body.price)).toBe(1000);
      expect(parseFloat(res.body.quantity)).toBe(5);
      expect(parseFloat(res.body.remaining)).toBe(5);

      const balance = await prisma.balances.findUnique({
        where: { accountId_asset: { accountId, asset: 'USDT' } },
      });
      expect(Number(balance?.available)).toBe(5000);
      expect(Number(balance?.locked)).toBe(5000);

      await cleanup(accountId);
    });
  });

  describe('Test 2 — Successful SELL Order', () => {
    it('locks base asset and creates order', async () => {
      const accountId = randomUUID();
      await createAccountWithBalance(accountId, 'BTC', 10, 0);

      const res = await request(app.getHttpServer())
        .post('/orders')
        .send({
          accountId,
          marketId: 'BTC_USDT',
          side: 'SELL',
          price: '1000',
          quantity: '4',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        accountId,
        marketId: 'BTC_USDT',
        side: 'SELL',
        status: 'OPEN',
      });
      expect(parseFloat(res.body.quantity)).toBe(4);
      expect(parseFloat(res.body.remaining)).toBe(4);

      const balance = await prisma.balances.findUnique({
        where: { accountId_asset: { accountId, asset: 'BTC' } },
      });
      expect(Number(balance?.available)).toBe(6);
      expect(Number(balance?.locked)).toBe(4);

      await cleanup(accountId);
    });
  });

  describe('Test 3 — Insufficient Balance', () => {
    it('rejects request without creating order or outbox event', async () => {
      const accountId = randomUUID();
      await createAccountWithBalance(accountId, 'USDT', 1000, 0);

      await request(app.getHttpServer())
        .post('/orders')
        .send({
          accountId,
          marketId: 'BTC_USDT',
          side: 'BUY',
          price: '500',
          quantity: '3',
        })
        .expect(400);

      const orderCount = await prisma.orders.count({
        where: { accountId },
      });
      expect(orderCount).toBe(0);

      const orderPlacedEvents = await prisma.outbox.findMany({
        where: { eventType: 'OrderPlaced' },
      });
      const forThisAccount = orderPlacedEvents.filter(
        (e) => (e.payload as { accountId?: string })?.accountId === accountId,
      );
      expect(forThisAccount.length).toBe(0);

      const balance = await prisma.balances.findUnique({
        where: { accountId_asset: { accountId, asset: 'USDT' } },
      });
      expect(Number(balance?.available)).toBe(1000);
      expect(Number(balance?.locked)).toBe(0);

      await cleanup(accountId);
    });
  });

  describe('Test 4 — Transaction Atomicity', () => {
    it('rolls back on failure - order and balance not persisted', async () => {
      const accountId = randomUUID();
      await createAccountWithBalance(accountId, 'USDT', 1000, 0);

      await request(app.getHttpServer())
        .post('/orders')
        .send({
          accountId,
          marketId: 'BTC_USDT',
          side: 'BUY',
          price: '500',
          quantity: '3',
        })
        .expect(400);

      const orderCount = await prisma.orders.count({
        where: { accountId },
      });
      expect(orderCount).toBe(0);

      const balance = await prisma.balances.findUnique({
        where: { accountId_asset: { accountId, asset: 'USDT' } },
      });
      expect(Number(balance?.available)).toBe(1000);
      expect(Number(balance?.locked)).toBe(0);

      const outboxForAccount = await prisma.outbox.findMany();
      const orderPlacedEvents = outboxForAccount.filter(
        (e) => e.eventType === 'OrderPlaced',
      );
      expect(orderPlacedEvents.length).toBe(0);

      await cleanup(accountId);
    });
  });

  describe('Test 5 — Outbox Record Created', () => {
    it('writes OrderPlaced event with order payload and status pending', async () => {
      const accountId = randomUUID();
      await createAccountWithBalance(accountId, 'USDT', 10000, 0);

      const res = await request(app.getHttpServer())
        .post('/orders')
        .send({
          accountId,
          marketId: 'BTC_USDT',
          side: 'BUY',
          price: '1000',
          quantity: '2',
        })
        .expect(201);

      const orderId = (res.body as { id: string }).id;
      const outboxEvents = await prisma.outbox.findMany({
        where: { eventType: 'OrderPlaced' },
      });
      const orderEvent = outboxEvents.find(
        (e) => (e.payload as { id?: string })?.id === orderId,
      );
      expect(orderEvent).toBeDefined();
      expect(orderEvent?.published).toBe(false);
      expect(orderEvent?.payload).toMatchObject({
        id: orderId,
        accountId,
        marketId: 'BTC_USDT',
        side: 'BUY',
        status: 'OPEN',
      });

      await cleanup(accountId);
    });
  });
});
