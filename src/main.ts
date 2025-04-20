import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { useContainer } from 'class-validator';

import { GeneralPrismaClientExceptionFilter } from './filters/general-prisma-client-exception.filter';
import { PrismaClientValidationFilter } from './filters/prisma-client-validation.filter';
import { NestExpressApplication } from '@nestjs/platform-express';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app: NestExpressApplication = await NestFactory.create(AppModule);
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(
    new GeneralPrismaClientExceptionFilter(httpAdapter),
    new PrismaClientValidationFilter(),
  );
  await app.listen(process.env.PORT);
}
void bootstrap();
