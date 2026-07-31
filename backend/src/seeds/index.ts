import { seed } from './seed'

seed()
  .then(() => {
    console.log('✅ ClawChat seed complete')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ Seed failed:', err)
    process.exit(1)
  })
