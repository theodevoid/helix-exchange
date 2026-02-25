import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import "reflect-metadata";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Better Auth needs raw body for auth routes
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
