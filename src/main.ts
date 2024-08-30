import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { useContainer } from 'class-validator';

import { PrismaClientExceptionFilter } from './filters/prisma-client-exception.filter';
import { PrismaClientValidationFilter } from './filters/prisma-client-validation.filter';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app: NestExpressApplication = await NestFactory.create(AppModule);
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(
    new PrismaClientExceptionFilter(httpAdapter),
    new PrismaClientValidationFilter(),
  );

  await app.listen(process.env.PORT);
}
void bootstrap();
