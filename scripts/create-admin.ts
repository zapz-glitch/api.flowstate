#!/usr/bin/env npx tsx
/**
 * Create Admin User Script
 *
 * Creates an admin user with a hashed password in the D1 database.
 * Uses bcrypt for password hashing (same as Better Auth).
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts --email admin@example.com --password yourpassword --name "Admin User"
 *
 * Options:
 *   --email     Email address (required)
 *   --password  Password (required)
 *   --name      Display name (default: "Admin")
 *   --plan      Plan type: free, pro, enterprise (default: enterprise)
 *   --remote    Apply to remote database (default: local)
 */

import { execSync } from 'child_process'
import { randomUUID, scrypt as cryptoScrypt, randomBytes } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(cryptoScrypt)

// Parse command line arguments
function parseArgs(): {
  email: string
  password: string
  name: string
  plan: string
  remote: boolean
} {
  const args = process.argv.slice(2)
  const result = {
    email: '',
    password: '',
    name: 'Admin',
    plan: 'enterprise',
    remote: false,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--email':
        result.email = args[++i]
        break
      case '--password':
        result.password = args[++i]
        break
      case '--name':
        result.name = args[++i]
        break
      case '--plan':
        result.plan = args[++i]
        break
      case '--remote':
        result.remote = true
        break
    }
  }

  if (!result.email) {
    console.error('Error: --email is required')
    process.exit(1)
  }
  if (!result.password) {
    console.error('Error: --password is required')
    process.exit(1)
  }
  if (!['free', 'pro', 'enterprise'].includes(result.plan)) {
    console.error('Error: --plan must be free, pro, or enterprise')
    process.exit(1)
  }

  return result
}

// Hash password using scrypt (same as Better Auth)
// Better Auth uses @noble/hashes/scrypt with these settings:
// N: 16384, r: 16, p: 1, dkLen: 64
// Format: salt:key (both hex encoded)
async function hashPassword(password: string): Promise<string> {
  // Generate random salt (16 bytes, encoded as hex = 32 chars)
  const saltBytes = randomBytes(16)
  const salt = saltBytes.toString('hex')

  // Use same config as Better Auth: N=16384, r=16, p=1, dkLen=64
  // Node's scrypt uses: cost (N), blockSize (r), parallelization (p)
  const keyBuffer = await scryptAsync(
    password.normalize('NFKC'),
    salt,
    64, // dkLen
    { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 }
  )

  return `${salt}:${(keyBuffer as Buffer).toString('hex')}`
}

// Execute D1 command using a temp file to avoid shell escaping issues
function executeD1(sql: string, remote: boolean): void {
  const fs = require('fs')
  const path = require('path')
  const tempFile = path.join(process.cwd(), '.temp-sql-' + Date.now() + '.sql')

  try {
    // Write SQL to temp file
    fs.writeFileSync(tempFile, sql)

    const remoteFlag = remote ? '--remote' : ''
    const cmd = `cd apps/api && wrangler d1 execute flowstate-api-db ${remoteFlag} --file "${tempFile}"`

    const output = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd() })
    console.log(output)
  } catch (error) {
    console.error('D1 command failed:', error)
    throw error
  } finally {
    // Clean up temp file
    try {
      fs.unlinkSync(tempFile)
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function main() {
  const { email, password, name, plan, remote } = parseArgs()

  console.log(`\nCreating admin user...`)
  console.log(`  Email: ${email}`)
  console.log(`  Name: ${name}`)
  console.log(`  Plan: ${plan}`)
  console.log(`  Database: ${remote ? 'REMOTE' : 'LOCAL'}`)
  console.log('')

  // Generate IDs
  const userId = randomUUID()
  const accountId = randomUUID()
  const now = new Date().toISOString()

  // Hash password
  console.log('Hashing password...')
  const passwordHash = await hashPassword(password)

  // Check if user already exists
  console.log('Checking if user exists...')
  try {
    const checkCmd = `cd apps/api && wrangler d1 execute flowstate-api-db ${remote ? '--remote' : ''} --command "SELECT id FROM user WHERE email = '${email}'" --json`
    const checkResult = execSync(checkCmd, { encoding: 'utf-8', cwd: process.cwd() })
    const parsed = JSON.parse(checkResult)
    if (parsed[0]?.results?.length > 0) {
      console.log(`\nUser with email ${email} already exists.`)
      console.log('Delete it first or use a different email.')
      process.exit(1)
    }
  } catch {
    // Ignore errors, proceed with creation
  }

  // Create user
  console.log('Creating user...')
  const userSql = `
    INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt, plan)
    VALUES ('${userId}', '${name}', '${email}', 1, '${now}', '${now}', '${plan}')
  `.trim().replace(/\n/g, ' ')

  executeD1(userSql, remote)

  // Create account with password
  console.log('Creating account with password...')
  const accountSql = `
    INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt)
    VALUES ('${accountId}', '${email}', 'credential', '${userId}', '${passwordHash}', '${now}', '${now}')
  `.trim().replace(/\n/g, ' ')

  executeD1(accountSql, remote)

  console.log('\n✅ Admin user created successfully!')
  console.log(`\n   Email: ${email}`)
  console.log(`   Password: ${password}`)
  console.log(`   Plan: ${plan}`)
  console.log(`\n   Login at: ${remote ? 'https://flowstate-dashboard.weareflowstate1.workers.dev/login' : 'http://localhost:3000/login'}`)
}

main().catch(console.error)
