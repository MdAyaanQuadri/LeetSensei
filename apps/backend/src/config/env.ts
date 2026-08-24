import dotenv from 'dotenv'
dotenv.config()

const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
}

const missing = Object.entries(env)
  .filter(([, v]) => v === undefined || v === '')
  .map(([k]) => k)

if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
}

export default env
