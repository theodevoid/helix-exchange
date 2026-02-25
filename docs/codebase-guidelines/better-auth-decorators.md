# Better Auth Decorators

This project uses [@thallesp/nestjs-better-auth](https://github.com/ThallesP/nestjs-better-auth) for authentication. The `AuthGuard` is registered globally, so all routes require authentication unless explicitly configured otherwise.

## Route Protection

| Decorator           | Effect                                           | Use case                              |
|---------------------|--------------------------------------------------|----------------------------------------|
| (none)              | Protected—auth required                          | Default for all routes                 |
| `@AllowAnonymous()` | Public—no auth required                          | Health checks, public pages            |
| `@OptionalAuth()`   | Auth optional—`@Session()` may be `null`         | Routes that behave differently when logged in |
| `@Session()`        | Inject current `UserSession`                      | Access user data in controllers       |

## Decorators

### @Session()

Injects the current user session into controller methods. Use when the route is protected and you need the authenticated user.

```ts
import { Controller, Get } from '@nestjs/common';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';

@Controller('orders')
export class OrdersController {
  @Get('me')
  async getMyOrders(@Session() session: UserSession) {
    const userId = session.user.id;
    // ...
  }
}
```

- `session.user` — User object (id, name, email, etc.)
- `session.user.id` — User ID (use for `userId` in services)
- `session.session` — Full session metadata (expiresAt, token, etc.)

### @AllowAnonymous()

Marks a route as public. No authentication is required.

```ts
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller()
export class AppController {
  @Get()
  @AllowAnonymous()
  getRoot() {
    return { name: 'Helix Exchange API' };
  }
}

@Controller('health')
export class HealthController {
  @Get()
  @AllowAnonymous()
  async check() {
    // ...
  }
}
```

Use as a method decorator or class decorator:

```ts
@AllowAnonymous()
@Controller('public')
export class PublicController {
  // All routes in this controller are public
}
```

### @OptionalAuth()

Makes authentication optional. `@Session()` will be `null` for unauthenticated requests.

```ts
import { OptionalAuth, Session, UserSession } from '@thallesp/nestjs-better-auth';

@Controller('feed')
export class FeedController {
  @Get()
  @OptionalAuth()
  async getFeed(@Session() session: UserSession | null) {
    if (session) {
      return this.feedService.getPersonalized(session.user.id);
    }
    return this.feedService.getDefault();
  }
}
```

### @Roles(roles)

System-level role check. Requires Better Auth's [admin plugin](https://www.better-auth.com/docs/plugins/admin). Checks `user.role` only.

```ts
import { Roles } from '@thallesp/nestjs-better-auth';

@Controller('admin')
export class AdminController {
  @Roles(['admin'])
  @Get('dashboard')
  async dashboard() {
    // Only users with user.role = 'admin' can access
  }
}
```

### @OrgRoles(roles)

Organization-level role check. Requires Better Auth's [organization plugin](https://www.better-auth.com/docs/plugins/organization). Checks organization member role; requires `activeOrganizationId` in session.

```ts
import { OrgRoles, Session, UserSession } from '@thallesp/nestjs-better-auth';

@Controller('org')
export class OrgController {
  @OrgRoles(['owner', 'admin'])
  @Get('settings')
  async getSettings(@Session() session: UserSession) {
    const orgId = session.session.activeOrganizationId;
    // ...
  }
}
```

## Request Object Access

Session and user are also attached to the request object:

```ts
import { Request } from 'express';

@Get('me')
async getProfile(@Request() req: Request) {
  return { session: req.session, user: req.user };
}
```

## Summary

- **Protected routes:** Use `@Session()` to get the current user; no extra decorator needed.
- **Public routes:** Add `@AllowAnonymous()` (e.g. `/`, `/health`).
- **Optional auth:** Use `@OptionalAuth()` and handle `session` being `null`.
- **Admin/org routes:** Use `@Roles()` or `@OrgRoles()` when those plugins are configured.
