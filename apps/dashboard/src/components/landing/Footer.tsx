'use client'

import Link from 'next/link'
import { Zap, Github, Twitter, Linkedin } from 'lucide-react'

const footerLinks = {
  Product: [
    { name: 'Features', href: '#features' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'Documentation', href: '#docs' },
    { name: 'API Reference', href: '#' },
  ],
  Company: [
    { name: 'About', href: '#' },
    { name: 'Blog', href: '#' },
    { name: 'Careers', href: '#' },
    { name: 'Contact', href: '#' },
  ],
  Legal: [
    { name: 'Privacy Policy', href: '#' },
    { name: 'Terms of Service', href: '#' },
    { name: 'Cookie Policy', href: '#' },
  ],
}

export function Footer() {
  return (
    <footer className="relative py-20 overflow-hidden border-t border-white/10">
      <div className="absolute inset-0 mesh-gradient opacity-30" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/25">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-neutral-900 dark:text-white">
                Flowstate
              </span>
            </Link>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-xs mb-6">
              Property intelligence API platform for real estate investors, lenders, and developers.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="#"
                className="flex h-10 w-10 items-center justify-center rounded-xl glass-button"
              >
                <Twitter className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
              </a>
              <a
                href="#"
                className="flex h-10 w-10 items-center justify-center rounded-xl glass-button"
              >
                <Github className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
              </a>
              <a
                href="#"
                className="flex h-10 w-10 items-center justify-center rounded-xl glass-button"
              >
                <Linkedin className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">
                {category}
              </h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            &copy; {new Date().getFullYear()} Flowstate. All rights reserved.
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-500">
            Built with love on Cloudflare Workers
          </p>
        </div>
      </div>
    </footer>
  )
}
