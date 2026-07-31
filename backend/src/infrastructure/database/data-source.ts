import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import { buildTypeOrmLoggingConfig } from "./typeorm-logging";
import { databaseTlsForEnvironment } from "./production-database-tls";
dotenv.config();

export default new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "5432", 10),
  database: process.env.DATABASE_NAME || "clawchat",
  username: process.env.DATABASE_USER || "clawchat",
  password: process.env.DATABASE_PASSWORD || "clawchat_dev_password",
  entities: [__dirname + "/../../entities/*.entity{.ts,.js}"],
  migrations: [__dirname + "/../../migrations/*{.ts,.js}"],
  synchronize: false,
  ...buildTypeOrmLoggingConfig(process.env),
  ssl: databaseTlsForEnvironment(process.env),
});
