import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { WsAdapter } from "@nestjs/platform-ws";
import { AppModule } from "./app.module";
import compression = require("compression");
import helmet from "helmet";
import { json, Request, urlencoded } from "express";
import { seed } from "./seeds/seed";
import cookieParser = require("cookie-parser");
import { webCsrfMiddleware } from "./common/middleware/web-csrf.middleware";
import {
  assertDestructiveSeedAllowed,
  assertProductionEnvironment,
} from "./config/production-env";
import { shouldMountApiDocs } from "./config/api-docs";
import {
  shouldParseJsonRequest,
  shouldParseUrlencodedRequest,
} from "./common/http/request-body-routing";

async function bootstrap() {
  assertProductionEnvironment();

  if (process.env.SEED_ON_START === "true") {
    assertDestructiveSeedAllowed();
    console.log("Seeding database...");
    await seed();
    console.log("Seed complete");
  }

  const app = await NestFactory.create(AppModule);
  const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || "10mb";

  app.use(helmet());
  app.use(compression());
  app.use(
    json({
      limit: requestBodyLimit,
      type: (request) => shouldParseJsonRequest(request as Request),
      verify: (req: Request & { rawBody?: Buffer }, _res, buffer) => {
        if (
          req.originalUrl
            ?.split("?", 1)[0]
            ?.endsWith("/api/v1/billing/webhooks/stripe")
        ) {
          req.rawBody = Buffer.from(buffer);
        }
      },
    }),
  );
  app.use(
    urlencoded({
      extended: true,
      limit: requestBodyLimit,
      type: (request) => shouldParseUrlencodedRequest(request as Request),
    }),
  );
  app.use(cookieParser());
  const apiPrefix = process.env.API_PREFIX || "api/v1";
  const allowedOrigins = getAllowedOrigins(process.env.CORS_ORIGINS);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  });
  app.setGlobalPrefix(apiPrefix);
  app.use(webCsrfMiddleware);
  app.useWebSocketAdapter(new WsAdapter(app));
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (shouldMountApiDocs(process.env)) {
    const config = new DocumentBuilder()
      .setTitle("ClawChat API")
      .setDescription("ClawChat AI Workforce OS - Backend API")
      .setVersion("1.0")
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("docs", app, document);
    console.log(`API docs mounted at /docs`);
  } else {
    console.log("API docs disabled for this environment");
  }

  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`ClawChat backend listening on port ${port}`);
}

bootstrap();

function getAllowedOrigins(configuredOrigins?: string) {
  const origins = new Set(
    (configuredOrigins || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3033");
    origins.add("http://127.0.0.1:3033");
    origins.add("http://localhost:3000");
  }

  return [...origins];
}
