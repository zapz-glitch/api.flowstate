/**
 * Seed script to create a test admin user with enterprise plan
 *
 * Usage:
 *   cd packages/db
 *   npx tsx src/seed.ts
 *
 * Or via wrangler D1:
 *   wrangler d1 execute flowstate-api-db --local --file=./seed.sql
 */

import { scryptAsync } from '@noble/hashes/scrypt'
import { bytesToHex, randomBytes } from '@noble/hashes/utils'

// Better Auth password config (must match their implementation)
const config = {
  N: 16384,
  r: 16,
  p: 1,
  dkLen: 64,
}

async function hashPassword(password: string): Promise<string> {
  const salt = bytesToHex(randomBytes(16))
  const key = await scryptAsync(password.normalize('NFKC'), salt, {
    N: config.N,
    p: config.p,
    r: config.r,
    dkLen: config.dkLen,
    maxmem: 128 * config.N * config.r * 2,
  })
  return `${salt}:${bytesToHex(key)}`
}

async function generateSeed() {
  // Admin user credentials
  const adminEmail = 'admin@flowstate.homes'
  const adminPassword = 'admin123456' // Change this in production!
  const adminName = 'Admin User'

  // Generate IDs
  const userId = crypto.randomUUID()
  const accountId = crypto.randomUUID()
  const apiKeyId = crypto.randomUUID()

  // Hash the password using Better Auth's method
  const passwordHash = await hashPassword(adminPassword)

  // Generate API key
  const rawApiKey = `fsk_${crypto.randomUUID().replace(/-/g, '')}`
  const keyPrefix = rawApiKey.substring(0, 12)

  // Hash API key with SHA-256
  const encoder = new TextEncoder()
  const data = encoder.encode(rawApiKey)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const now = new Date().toISOString()
  const nextMonth = new Date()
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  nextMonth.setDate(1)
  const quotaResetAt = nextMonth.toISOString()

  console.log('='.repeat(60))
  console.log('FLOWSTATE API - SEED DATA')
  console.log('='.repeat(60))
  console.log('')
  console.log('Admin Credentials:')
  console.log(`  Email:    ${adminEmail}`)
  console.log(`  Password: ${adminPassword}`)
  console.log(`  Plan:     enterprise`)
  console.log('')
  console.log('API Key (save this - it won\'t be shown again!):')
  console.log(`  ${rawApiKey}`)
  console.log('')
  console.log('='.repeat(60))
  console.log('')
  console.log('Run the following SQL to create the admin user:')
  console.log('')
  console.log('------- SQL START -------')

  const sql = `
-- Insert admin user
INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt, plan)
VALUES (
  '${userId}',
  '${adminName}',
  '${adminEmail}',
  1,
  '${now}',
  '${now}',
  'enterprise'
);

-- Insert account (for password auth)
INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt)
VALUES (
  '${accountId}',
  '${userId}',
  'credential',
  '${userId}',
  '${passwordHash}',
  '${now}',
  '${now}'
);

-- Insert API key
INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, monthly_quota, current_usage, quota_reset_at, is_active, created_at)
VALUES (
  '${apiKeyId}',
  '${userId}',
  'Default Admin Key',
  '${keyHash}',
  '${keyPrefix}',
  NULL,
  0,
  '${quotaResetAt}',
  1,
  '${now}'
);
`.trim()

  console.log(sql)
  console.log('')
  console.log('------- SQL END -------')
  console.log('')
  console.log('To apply locally:')
  console.log('  wrangler d1 execute flowstate-api-db --local --command="<SQL>"')
  console.log('')
  console.log('Or save the SQL to a file and run:')
  console.log('  wrangler d1 execute flowstate-api-db --local --file=./seed.sql')
}

generateSeed().catch(console.error)
