import { getApiKeys, getUser } from '@/lib/api'
import { PLAN_LIMITS } from '@flowstate-api/db'
import ApiKeysList from './ApiKeysList'

async function getApiKeysData() {
  try {
    const [keys, user] = await Promise.all([getApiKeys(), getUser()])
    if (!user) return null

    const plan = (user.plan || 'free') as keyof typeof PLAN_LIMITS
    const limits = PLAN_LIMITS[plan]

    return {
      keys,
      plan,
      limits,
      canCreateMore: limits.maxApiKeys === -1 || keys.length < limits.maxApiKeys,
    }
  } catch {
    return null
  }
}

export default async function ApiKeysPage() {
  const data = await getApiKeysData()

  if (!data) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            API Keys
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            Manage your API keys for authentication
          </p>
        </div>
      </div>

      <ApiKeysList
        keys={data.keys}
        plan={data.plan}
        limits={data.limits}
        canCreateMore={data.canCreateMore}
      />
    </div>
  )
}
