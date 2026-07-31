import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { AppModule } from '../app.module'

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false })

  const config = new DocumentBuilder()
    .setTitle('ClawChat API')
    .setDescription('ClawChat API contract export')
    .setVersion('1.0')
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, config)
  const outputPath =
    process.argv[2]
    || resolve(process.cwd(), '../packages/contracts/openapi.snapshot.json')

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, JSON.stringify(document, null, 2))
  await app.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
