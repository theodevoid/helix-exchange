# DTO Validation Guidelines

## Overview

All request DTOs in the API use `class-validator` for validation. The global `ValidationPipe` is configured in `main.ts` and automatically validates incoming request bodies before they reach controller logic.

## Structure

- **One DTO per file** in a `dto` subfolder per module
- **Example:** `modules/orders/dto/create-order.dto.ts`, `modules/orders/dto/update-order.dto.ts`
- Use **`class`** (not `type` or `interface`) for DTOs—decorators require class syntax
- Use the definite assignment assertion (`!`) for required properties to satisfy strict property initialization (e.g. `marketId!: string`)

## ValidationPipe Configuration

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,           // strip unknown properties from the payload
    transform: true,           // enable class-transformer for type coercion
    forbidNonWhitelisted: true, // reject requests with unknown properties (400)
  })
);
```

## Decorator Conventions

| Use case                 | Decorator                                  | Example                            |
|--------------------------|--------------------------------------------|------------------------------------|
| UUID fields              | `@IsUUID()`                                | `@IsUUID() marketId: string`       |
| Enums                    | `@IsEnum(EnumType)`                        | `@IsEnum(OrderSide) side: OrderSide` |
| String patterns          | `@Matches(/regex/, { message })`           | Decimal format, IDs                |
| Optional fields          | `@IsOptional()`                            | `@IsOptional() @IsString() notes`  |
| Conditional validation   | `@ValidateIf((o) => condition)`            | Require price for LIMIT orders     |
| Nested objects           | `@ValidateNested()` + `@Type(() => Dto)`   | Nested DTOs                        |

## Examples

**Basic DTO:**

```ts
import { IsEnum, IsString, IsUUID } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  marketId: string;

  @IsEnum(OrderSide)
  side: OrderSide;

  @IsString()
  quantity: string;
}
```

**Conditional validation:**

```ts
@ValidateIf((o) => o.type === OrderType.LIMIT || o.side === OrderSide.BUY)
@IsString()
@Matches(/^\d+(\.\d+)?$/, { message: 'price must be a positive decimal' })
price?: string;
```

## Error Responses

When validation fails, NestJS returns `400 Bad Request` with a body describing the errors:

```json
{
  "message": ["price must be a positive decimal"],
  "error": "Bad Request"
}
```
