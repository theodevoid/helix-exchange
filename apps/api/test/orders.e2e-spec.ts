/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { connect, StringCodec } from 'nats';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { OutboxPublisherService } from '@/infra/outbox/outbox-publisher.service';
import { NatsService } from '@/infra/nats/nats.service';

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

  describe('Phase 2 — Outbox Publisher', () => {
    describe('Test 1 — Outbox Event Gets Published', () => {
      it('publishes event to NATS and marks published', async () => {
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

        const outboxBefore = await prisma.outbox.findFirst({
          where: { eventType: 'OrderPlaced' },
        });
        expect(outboxBefore?.published).toBe(false);

        const publisher = app.get(OutboxPublisherService);

        const received: string[] = [];
        const nc = await connect({
          servers: process.env.NATS_URL ?? 'nats://localhost:4222',
        });
        const sc = StringCodec();
        const sub = nc.subscribe('orders.placed');
        (async () => {
          for await (const msg of sub) {
            received.push(sc.decode(msg.data));
          }
        })();

        await publisher.poll();

        await new Promise((r) => setTimeout(r, 100));
        sub.unsubscribe();
        await nc.close();

        const outboxAfter = await prisma.outbox.findFirst({
          where: { id: outboxBefore!.id },
        });
        expect(outboxAfter?.published).toBe(true);
        expect(outboxAfter?.publishedAt).toBeDefined();

        expect(received.length).toBe(1);
        const event = JSON.parse(received[0]!);
        expect(event).toMatchObject({
          type: 'OrderPlaced',
          data: {
            orderId,
            accountId,
            marketId: 'BTC_USDT',
            side: 'BUY',
            price: '1000',
            quantity: '2',
          },
        });

        await cleanup(accountId);
      });
    });

    describe('Test 2 — Multiple Events Maintain Order', () => {
      it('publishes events in created_at order', async () => {
        const events = [
          { id: randomUUID(), seq: 1 },
          { id: randomUUID(), seq: 2 },
          { id: randomUUID(), seq: 3 },
        ];

        for (const e of events) {
          await prisma.outbox.create({
            data: {
              id: e.id,
              eventType: 'OrderPlaced',
              payload: {
                id: e.id,
                accountId: 'test',
                marketId: 'BTC_USDT',
                side: 'BUY',
                price: '1000',
                quantity: '1',
                seq: e.seq,
              },
              published: false,
            },
          });
        }

        const received: string[] = [];
        const nc = await connect({
          servers: process.env.NATS_URL ?? 'nats://localhost:4222',
        });
        const sc = StringCodec();
        const sub = nc.subscribe('orders.placed');
        (async () => {
          for await (const msg of sub) {
            received.push(sc.decode(msg.data));
          }
        })();

        const publisher = app.get(OutboxPublisherService);
        await publisher.poll();

        await new Promise((r) => setTimeout(r, 100));
        sub.unsubscribe();
        await nc.close();

        expect(received.length).toBe(3);
        const orderIds = received.map(
          (r) => (JSON.parse(r) as { data: { orderId?: string } }).data.orderId,
        );
        expect(orderIds).toEqual([events[0]!.id, events[1]!.id, events[2]!.id]);

        await prisma.outbox.deleteMany({ where: { eventType: 'OrderPlaced' } });
      });
    });

    describe('Test 3 — Failed Publish Retries', () => {
      it('does not mark published on NATS failure, retries next poll', async () => {
        const accountId = randomUUID();
        await createAccountWithBalance(accountId, 'USDT', 10000, 0);

        const failingNats: NatsService = {
          publish: () => {
            throw new Error('NATS unavailable');
          },
        } as NatsService;

        const customModule = await Test.createTestingModule({
          imports: [AppModule],
        })
          .overrideProvider(NatsService)
          .useValue(failingNats)
          .compile();

        const customApp = customModule.createNestApplication();
        customApp.useGlobalPipes(
          new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
          }),
        );
        await customApp.init();

        await request(customApp.getHttpServer())
          .post('/orders')
          .send({
            accountId,
            marketId: 'BTC_USDT',
            side: 'BUY',
            price: '1000',
            quantity: '1',
          })
          .expect(201);

        const outboxEvent = await prisma.outbox.findFirst({
          where: { eventType: 'OrderPlaced' },
        });
        expect(outboxEvent?.published).toBe(false);

        const publisher = customApp.get(OutboxPublisherService);
        await publisher.poll();

        const stillUnpublished = await prisma.outbox.findFirst({
          where: { id: outboxEvent!.id },
        });
        expect(stillUnpublished?.published).toBe(false);

        await customApp.close();

        const realPublisher = app.get(OutboxPublisherService);
        await realPublisher.poll();

        const finallyPublished = await prisma.outbox.findFirst({
          where: { id: outboxEvent!.id },
        });
        expect(finallyPublished?.published).toBe(true);

        await cleanup(accountId);
      });
    });

    describe('Test 4 — Worker Handles Batch Publishing', () => {
      it('first poll publishes 5, second poll publishes remaining', async () => {
        const customModule = await Test.createTestingModule({
          imports: [AppModule],
        })
          .overrideProvider(OutboxPublisherService)
          .useFactory({
            factory: (prisma: PrismaService, nats: NatsService) =>
              new OutboxPublisherService(prisma, nats, { batchSize: 5 }),
            inject: [PrismaService, NatsService],
          })
          .compile();

        const customApp = customModule.createNestApplication();
        customApp.useGlobalPipes(
          new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
          }),
        );
        await customApp.init();

        await prisma.outbox.deleteMany({});

        for (let i = 0; i < 10; i++) {
          await prisma.outbox.create({
            data: {
              id: randomUUID(),
              eventType: 'OrderPlaced',
              payload: {
                id: randomUUID(),
                accountId: 'test',
                marketId: 'BTC_USDT',
                side: 'BUY',
                price: '1000',
                quantity: '1',
                seq: i,
              },
              published: false,
            },
          });
        }

        const received: string[] = [];
        const nc = await connect({
          servers: process.env.NATS_URL ?? 'nats://localhost:4222',
        });
        const sc = StringCodec();
        const sub = nc.subscribe('orders.placed');
        (async () => {
          for await (const msg of sub) {
            received.push(sc.decode(msg.data));
          }
        })();

        const publisher = customApp.get(OutboxPublisherService);
        await publisher.poll();
        expect(received.length).toBe(5);

        await publisher.poll();
        expect(received.length).toBe(10);

        sub.unsubscribe();
        await nc.close();
        await customApp.close();

        await prisma.outbox.deleteMany({});
      });
    });

    describe('Test 5 — Published Events Not Reprocessed', () => {
      it('never picks up events with published=true', async () => {
        const eventId = randomUUID();
        await prisma.outbox.create({
          data: {
            id: eventId,
            eventType: 'OrderPlaced',
            payload: {
              id: randomUUID(),
              accountId: 'test',
              marketId: 'BTC_USDT',
              side: 'BUY',
              price: '1000',
              quantity: '1',
            },
            published: true,
            publishedAt: new Date(),
          },
        });

        const publisher = app.get(OutboxPublisherService);
        await publisher.poll();

        const received: string[] = [];
        const nc = await connect({
          servers: process.env.NATS_URL ?? 'nats://localhost:4222',
        });
        const sc = StringCodec();
        const sub = nc.subscribe('orders.placed');
        (async () => {
          for await (const msg of sub) {
            received.push(sc.decode(msg.data));
          }
        })();

        await new Promise((r) => setTimeout(r, 200));
        sub.unsubscribe();
        await nc.close();

        expect(received.length).toBe(0);

        const event = await prisma.outbox.findUnique({
          where: { id: eventId },
        });
        expect(event?.published).toBe(true);

        await prisma.outbox.deleteMany({ where: { id: eventId } });
      });
    });
  });
});
