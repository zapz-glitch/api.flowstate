'use client'

import {
  Zap,
  BarChart3,
  SlidersHorizontal,
  Wrench,
  Radio,
  ShieldCheck
} from 'lucide-react'

const features = [
  {
    icon: Zap,
    code: 'F-01',
    title: 'Instant Analysis',
    description: 'Get property valuations and ARV calculations in milliseconds, not minutes.',
  },
  {
    icon: BarChart3,
    code: 'F-02',
    title: 'Accurate Comparables',
    description: 'AI-powered comparable selection based on property characteristics and market data.',
  },
  {
    icon: SlidersHorizontal,
    code: 'F-03',
    title: 'Custom Comp Filters',
    description: 'Filter by radius, age, square footage, pool, and more to refine your analysis.',
  },
  {
    icon: Wrench,
    code: 'F-04',
    title: 'Flexible Appraisal Rules',
    description: 'Set custom ARV multipliers, rehab costs, and investment criteria.',
  },
  {
    icon: Radio,
    code: 'F-05',
    title: 'Real-time Data',
    description: 'Access up-to-date property records, sales history, and market trends.',
  },
  {
    icon: ShieldCheck,
    code: 'F-06',
    title: 'Enterprise Ready',
    description: 'Secure API with rate limiting, usage analytics, and 99.9% uptime SLA.',
  },
]

export function Features() {
  return (
    <section id="features" className="py-20 relative">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="hud-label mb-3">Capabilities</div>
          <h2 className="text-3xl sm:text-4xl font-semibold text-foreground mb-4 tracking-tight">
            Everything you need
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Powerful property analysis tools built for real estate investors and developers.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group ui-panel p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-md bg-primary/10 border border-primary/25 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="hud-label opacity-50 group-hover:opacity-100 group-hover:text-primary transition-all">
                  {feature.code}
                </span>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1.5">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
