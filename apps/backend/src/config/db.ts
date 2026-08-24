import { PrismaClient } from '../../generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import env from './env.js'

const adapter = new PrismaPg(env.DATABASE_URL)
const db = new PrismaClient({adapter })

export default db
