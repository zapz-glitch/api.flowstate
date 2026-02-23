/**
 * Test script for Gemini Zillow Fetcher
 *
 * Uses Gemini's URL context tool via Google AI API to fetch Zillow listings.
 *
 * Run with:
 *   cd apps/api
 *   source .dev.vars && npx tsx src/scripts/test-gemini-zillow.ts
 */

import { createGeminiZillowFetcher } from '../services/photo-provider/providers/zillow/gemini-fetcher'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY environment variable is required')
  console.error('Get your API key from: https://aistudio.google.com/app/apikey')
  process.exit(1)
}

async function main() {
  const fetcher = createGeminiZillowFetcher({
    apiKey: GEMINI_API_KEY!, // Already validated above
    model: 'gemini-2.0-flash',
  })

  // Test property - use a known listing
  const testProperty = {
    propertyId: 'test-123',
    address: '3103 W San Juan St',
    city: 'Tampa',
    state: 'FL',
    zipCode: '33629',
  }

  console.log('Testing Gemini Zillow Fetcher...')
  console.log('Property:', testProperty)
  console.log('')

  const result = await fetcher.fetchListing(testProperty)

  console.log('Result:')
  console.log(JSON.stringify(result, null, 2))

  if (result.listing) {
    console.log('')
    console.log('Summary:')
    console.log(`  Photos: ${result.listing.photos.length}`)
    console.log(`  Price: ${result.listing.price}`)
    console.log(`  Status: ${result.listing.status}`)
    console.log(`  Days on Market: ${result.listing.daysOnMarket}`)
    console.log(`  Features: ${result.listing.features?.length || 0}`)
    console.log(`  Duration: ${result.timing?.durationMs}ms`)
  } else {
    console.log('')
    console.log('ERROR:', result.error)
  }
}

main().catch(console.error)
