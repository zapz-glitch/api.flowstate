'use client'

import { ArrowRight, MapPin, Terminal, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState, useEffect, useCallback } from 'react'

interface HeroProps {
  onGetStartedClick: () => void
}

interface TerminalLine {
  type: 'command' | 'output' | 'success' | 'loading'
  content: string
  color?: string
}

export function Hero({ onGetStartedClick }: HeroProps) {
  const [copied, setCopied] = useState(false)
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [currentText, setCurrentText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showCursor, setShowCursor] = useState(true)
  const [commandIndex, setCommandIndex] = useState(0)

  const curlCommand = `curl -X POST https://api.flowstate.homes/v1/analyze \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"address": "123 Main St, Tampa, FL 33607"}'`

  const commands = [
    {
      text: 'curl -X POST api.flowstate.homes/v1/analyze -d \'{"address": "123 Main St, Tampa, FL"}\'',
      response: [
        '{ "success": true, "data": {',
        '    "arv": 892000,',
        '    "buyPrice": 623000,',
        '    "recommendation": "buy",',
        '    "comparables": 8',
        '  }',
        '}',
      ],
      successMsg: 'Analysis complete - 127ms'
    },
    {
      text: 'curl -X POST api.flowstate.homes/v1/analyze -d \'{"address": "456 Oak Ave, Miami", "compFilters": {"radius": 0.5, "maxAge": 90}}\'',
      response: [
        '{ "success": true, "data": {',
        '    "arv": 1250000,',
        '    "buyPrice": 875000,',
        '    "recommendation": "buy",',
        '    "comparables": 5,',
        '    "filters": { "radius": "0.5mi", "age": "90d" }',
        '  }',
        '}',
      ],
      successMsg: 'Analysis complete - 89ms'
    },
    {
      text: 'curl -X POST api.flowstate.homes/v1/analyze -d \'{"address": "789 Palm Dr, Orlando", "appraisalRules": {"arvMultiplier": 0.7}}\'',
      response: [
        '{ "success": true, "data": {',
        '    "arv": 485000,',
        '    "buyPrice": 339500,',
        '    "recommendation": "buy",',
        '    "comparables": 6,',
        '    "rules": { "arvMultiplier": 0.7 }',
        '  }',
        '}',
      ],
      successMsg: 'Analysis complete - 156ms'
    },
    {
      text: 'curl -X POST api.flowstate.homes/v1/analyze -d \'{"address": "321 Beach Rd, Clearwater", "compFilters": {"minSqft": 1500, "samePool": true}}\'',
      response: [
        '{ "success": true, "data": {',
        '    "arv": 725000,',
        '    "buyPrice": 507500,',
        '    "recommendation": "buy",',
        '    "comparables": 4,',
        '    "filters": { "minSqft": 1500, "pool": true }',
        '  }',
        '}',
      ],
      successMsg: 'Analysis complete - 112ms'
    }
  ]

  // Blinking cursor
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev)
    }, 530)
    return () => clearInterval(cursorInterval)
  }, [])

  // Type a single character
  const typeCharacter = useCallback((text: string, index: number, onComplete: () => void) => {
    if (index <= text.length) {
      setCurrentText(text.slice(0, index))
      if (index < text.length) {
        const delay = 25 + Math.random() * 35 // Natural typing speed
        setTimeout(() => typeCharacter(text, index + 1, onComplete), delay)
      } else {
        onComplete()
      }
    }
  }, [])

  // Add output lines one by one
  const showOutput = useCallback((outputLines: string[], index: number, onComplete: () => void) => {
    if (index < outputLines.length) {
      setLines(prev => [...prev, { type: 'output', content: outputLines[index] }])
      setTimeout(() => showOutput(outputLines, index + 1, onComplete), 60)
    } else {
      onComplete()
    }
  }, [])

  // Main animation loop
  useEffect(() => {
    const runAnimation = async () => {
      const command = commands[commandIndex]

      // Clear and start fresh
      setLines([])
      setCurrentText('')
      setIsTyping(true)

      // Wait a moment before starting
      await new Promise(resolve => setTimeout(resolve, 800))

      // Type the command
      await new Promise<void>(resolve => {
        typeCharacter(command.text, 0, resolve)
      })

      // Add the command to lines
      setLines([{ type: 'command', content: command.text }])
      setCurrentText('')
      setIsTyping(false)

      // Show loading
      await new Promise(resolve => setTimeout(resolve, 300))
      setLines(prev => [...prev, { type: 'loading', content: 'Fetching...' }])

      // Wait for "response"
      await new Promise(resolve => setTimeout(resolve, 600))

      // Remove loading and show response
      setLines(prev => prev.filter(l => l.type !== 'loading'))

      await new Promise<void>(resolve => {
        showOutput(command.response, 0, resolve)
      })

      // Show success message
      await new Promise(resolve => setTimeout(resolve, 200))
      setLines(prev => [...prev, { type: 'success', content: command.successMsg }])

      // Wait before next command
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Move to next command
      setCommandIndex(prev => (prev + 1) % commands.length)
    }

    runAnimation()
  }, [commandIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = () => {
    navigator.clipboard.writeText(curlCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="relative pt-24 sm:pt-32 pb-12 sm:pb-16 overflow-hidden">
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left side - Text content */}
          <div className="space-y-6 sm:space-y-8 text-center lg:text-left">
            <div className="hud-label inline-flex items-center gap-2 border border-border rounded-full px-3 py-1.5">
              <span className="hud-dot live" />
              property intelligence API
            </div>

            {/* Main headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-foreground leading-[1.08] tracking-tight mb-4 sm:mb-6">
              <span className="hero-gradient-text">Analyze fast,</span>
              <br />
              <span>invest smarter</span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-muted-foreground max-w-md leading-relaxed mx-auto lg:mx-0">
              Get instant property valuations, comparable sales, and investment analysis powered by AI.
            </p>

            {/* Address input */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 p-2 sm:pl-5 ui-panel max-w-md mx-auto lg:mx-0">
              <div className="flex items-center gap-3 flex-1 px-3 sm:px-0">
                <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
                <Input
                  type="text"
                  placeholder="Enter a property address..."
                  className="flex-1 bg-transparent border-0 text-foreground placeholder:text-muted-foreground text-[15px] focus-visible:ring-0 shadow-none"
                />
              </div>
              <Button
                onClick={onGetStartedClick}
                className="w-full sm:w-auto font-mono uppercase tracking-wider shadow-[0_0_20px_hsl(var(--primary)/0.35)]"
              >
                Analyze
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Right side - Terminal API demo */}
          <div className="w-full">
            <div className="rounded-md overflow-hidden ui-panel hud-frame shadow-2xl">
              {/* Terminal header */}
              <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-secondary/60 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-muted-foreground/40 transition-all hover:bg-muted-foreground/60" />
                    <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-muted-foreground/30 transition-all hover:bg-muted-foreground/50" />
                    <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-muted-foreground/20 transition-all hover:bg-muted-foreground/40" />
                  </div>
                  <div className="flex items-center gap-2 ml-2 sm:ml-3 text-muted-foreground text-xs sm:text-sm">
                    <Terminal className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                    <span className="hidden sm:inline font-mono">api.flowstate.homes</span>
                  </div>
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary font-mono"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-accent" />
                      <span className="text-accent hidden sm:inline">copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Terminal content */}
              <div className="p-3 sm:p-4 font-mono text-xs sm:text-sm min-h-[200px] sm:min-h-[300px] max-h-[250px] sm:max-h-[300px] overflow-hidden bg-background/70">
                {/* Previous lines */}
                <div className="space-y-1">
                  {lines.map((line, index) => (
                    <div
                      key={index}
                      className="animate-in fade-in slide-in-from-bottom-1 duration-150"
                    >
                      {line.type === 'command' && (
                        <div className="flex items-start gap-2">
                          <span className="text-primary select-none">❯</span>
                          <span className="text-foreground/80 break-all">{line.content}</span>
                        </div>
                      )}
                      {line.type === 'output' && (
                        <div className="ml-4 text-xs">
                          <span className="text-primary">
                            {line.content.replace(/"([^"]+)":/g, (_, key) => `"${key}":`).split(':')[0]}
                          </span>
                          <span className="text-muted-foreground">
                            {line.content.includes(':') ? ':' + line.content.split(':').slice(1).join(':') : ''}
                          </span>
                          {!line.content.includes(':') && (
                            <span className="text-muted-foreground">{line.content}</span>
                          )}
                        </div>
                      )}
                      {line.type === 'loading' && (
                        <div className="flex items-center gap-2 ml-4 text-muted-foreground">
                          <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span className="text-xs">{line.content}</span>
                        </div>
                      )}
                      {line.type === 'success' && (
                        <div className="flex items-center gap-2 ml-4 text-accent text-xs mt-2">
                          <Check className="h-3.5 w-3.5" />
                          <span>{line.content}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Current typing line */}
                {isTyping && (
                  <div className="flex items-start gap-2 mt-1">
                    <span className="text-primary select-none">❯</span>
                    <span className="text-foreground/80 break-all">
                      {currentText}
                      <span
                        className={`inline-block w-2 h-4 bg-primary ml-0.5 align-middle transition-opacity duration-100 ${
                          showCursor ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    </span>
                  </div>
                )}

                {/* Waiting cursor when not typing */}
                {!isTyping && lines.length === 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-primary select-none">❯</span>
                    <span
                      className={`inline-block w-2 h-4 bg-primary transition-opacity duration-100 ${
                        showCursor ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
