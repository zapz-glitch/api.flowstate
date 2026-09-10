import type { Metadata } from 'next'
import { Inter, Source_Serif_4, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { DesignProvider } from '@/components/design-provider'
import { DesignLab } from '@/components/DesignLab'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
  style: ['normal', 'italic'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Flowstate API',
  description: 'Property valuation and underwriting API for real estate investors',
}

// Restore the saved design variant + theme before paint to avoid a flash.
const initScript = `
  try {
    var d = localStorage.getItem('design-variant');
    if (d === 'command' || d === 'aurora' || d === 'editorial') {
      document.documentElement.dataset.design = d;
    } else {
      document.documentElement.dataset.design = 'command';
    }
    var t = localStorage.getItem('theme');
    if (t === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  } catch (e) {}
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" data-design="command" suppressHydrationWarning>
      <body className={`${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
        <ThemeProvider>
          <DesignProvider>
            <div className="scene" aria-hidden="true" />
            {children}
            <DesignLab />
          </DesignProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
