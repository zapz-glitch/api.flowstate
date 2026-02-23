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
    title: 'Instant Analysis',
    description: 'Get property valuations and ARV calculations in milliseconds, not minutes.',
  },
  {
    icon: BarChart3,
    title: 'Accurate Comparables',
    description: 'AI-powered comparable selection based on property characteristics and market data.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Custom Comp Filters',
    description: 'Filter by radius, age, square footage, pool, and more to refine your analysis.',
  },
  {
    icon: Wrench,
    title: 'Flexible Appraisal Rules',
    description: 'Set custom ARV multipliers, rehab costs, and investment criteria.',
  },
  {
    icon: Radio,
    title: 'Real-time Data',
    description: 'Access up-to-date property records, sales history, and market trends.',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise Ready',
    description: 'Secure API with rate limiting, usage analytics, and 99.9% uptime SLA.',
  },
]

export function Features() {
  return (
    <section id="features" className="py-16 bg-background">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-serif font-normal text-foreground mb-4">
            <span className="italic">Everything</span> you need
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Powerful property analysis tools built for real estate investors and developers.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group p-6 rounded-2xl bg-card/50 border border-border hover:border-purple-500/30 hover:bg-card transition-all duration-300"
            >
              <div className="flex gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0 group-hover:from-purple-500/30 group-hover:to-violet-500/30 transition-all">
                  <feature.icon className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-foreground mb-1.5">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
