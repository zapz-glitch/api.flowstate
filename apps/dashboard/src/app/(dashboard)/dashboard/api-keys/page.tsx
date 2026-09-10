import { getApiKeys, getUser } from '@/lib/api'
import { PLAN_LIMITS } from '@flowstate-api/db'
import { KeyRound } from 'lucide-react'
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
    return <div className="hud-label p-6">Loading…</div>
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="hud-label mb-2 flex items-center gap-2">
            <KeyRound className="w-3.5 h-3.5 text-primary" />
            Credentials
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            API Keys
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
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
