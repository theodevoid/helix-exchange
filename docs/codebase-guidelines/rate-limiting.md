# Rate Limiting

This project uses `@nestjs/throttler` for rate limiting. Custom decorators in [`src/common/decorators/throttle.decorator.ts`](../../apps/api/src/common/decorators/throttle.decorator.ts) provide consistent limits across endpoint types.

## Setup

`ThrottlerModule` must be configured in `AppModule` with named throttlers that match the decorators:

```ts
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60_000,   // 1 minute
        limit: 10,     // default for short
      },
      {
        name: 'medium',
        ttl: 300_000,  // 5 minutes
        limit: 100,    // default for medium
      },
    ]),
    // ...
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

## Decorators

| Decorator | Limit | TTL | Use case |
|-----------|-------|-----|----------|
| `AuthThrottle` | 5 | 1 min | Authentication endpoints (login, signup, password reset) |
| `UploadThrottle` | 10 | 5 min | File upload endpoints |
| `TransactionThrottle` | 50 | 5 min | Transactional endpoints (orders, withdrawals) |
| `ApiThrottle` | 200 | 5 min | General API endpoints |
| `SkipThrottle` | — | — | Exempt endpoint from rate limiting |

## Usage

Apply decorators at the **method** or **controller** level.

**Method-level (per route):**

```ts
import { Controller, Post } from '@nestjs/common';
import { TransactionThrottle } from '@common/decorators/throttle.decorator';

@Controller()
export class OrdersController {
  @Post('order')
  @TransactionThrottle()
  async createOrder() {
    // 50 requests per 5 minutes
  }
}
```

**Controller-level (all routes):**

```ts
import { ApiThrottle } from '@common/decorators/throttle.decorator';

@ApiThrottle()
@Controller('api')
export class ApiController {
  // All routes: 200 requests per 5 minutes
}
```

**Exempt from throttling:**

```ts
import { SkipThrottle } from '@common/decorators/throttle.decorator';

@Controller('health')
export class HealthController {
  @Get()
  @SkipThrottle()
  check() {
    // Not rate limited (e.g. for load balancers, k8s probes)
  }
}
```

## Endpoint Recommendations

| Endpoint type | Decorator | Rationale |
|---------------|-----------|-----------|
| `POST /auth/*` (login, signup) | `AuthThrottle` | Mitigate brute-force |
| `POST /order` | `TransactionThrottle` | Limit trading volume per client |
| Public read endpoints | `ApiThrottle` | Standard API limit |
| `GET /health` | `SkipThrottle` | Health checks should not be throttled |
| `GET /` (root) | `SkipThrottle` or `ApiThrottle` | Depends on usage |

## Implementation

Decorators wrap `@nestjs/throttler`'s `Throttle` with predefined limits:

```ts
// throttle.decorator.ts
export const TransactionThrottle = () =>
  Throttle({ medium: { limit: 50, ttl: 300000 } });
```

The `short` and `medium` names must match throttler definitions in `ThrottlerModule.forRoot()`.
