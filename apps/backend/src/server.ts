import app from './app.js'
import env from './config/env.js'
import db from './config/db.js'

async function start() {
  try {
    await db.$connect()
    console.log(' Database connected')

    app.listen(env.PORT, () => {
      console.log(`Server running on port ${env.PORT}`)
    })
  } catch (error) {
    console.error('Failed to connect to database:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await db.$disconnect()
  console.log('Database disconnected')
  process.exit(0)
})

start()
