'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Key,
  BarChart3,
  LogOut,
  Home,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  ChevronsUpDown,
  User,
} from 'lucide-react'
import { signOut } from '@/lib/auth-client'
import { Logo } from '@/components/ui/Logo'
import { cn } from '@/lib/utils'
import { useUser } from '@/components/auth/UserProvider'
import { useTheme } from '@/components/theme-provider'
import { useSidebar } from '@/components/SidebarProvider'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: Home, code: '01' },
  { name: 'API Playground', href: '/dashboard/analyze', icon: Search, code: '02' },
  { name: 'API Keys', href: '/dashboard/api-keys', icon: Key, code: '03' },
  { name: 'Usage', href: '/dashboard/usage', icon: BarChart3, code: '04' },
  { name: 'API Logs', href: '/dashboard/logs', icon: FileText, code: '05' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user } = useUser()
  const { theme, toggleTheme } = useTheme()
  const { collapsed, toggleCollapsed } = useSidebar()

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/'
  }

  if (!user) return null

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase()

  return (
    <>
      {/* ── Desktop rail ─────────────────────────────────────────────────── */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden lg:flex lg:flex-col bg-card/80 backdrop-blur-md border-r border-border transition-all duration-300 ease-in-out',
          collapsed ? 'w-[76px]' : 'w-60'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo & Collapse */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-border">
            <Link href="/dashboard" className="flex items-center">
              {collapsed ? (
                <div className="w-9 h-9 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_0_16px_hsl(var(--primary)/0.4)]">
                  <span className="text-primary-foreground font-bold text-sm font-mono">F</span>
                </div>
              ) : (
                <Logo size="sm" />
              )}
            </Link>
            <button
              onClick={toggleCollapsed}
              className={cn(
                'p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors',
                collapsed && 'absolute -right-3 top-6 bg-card border border-border shadow-sm'
              )}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {!collapsed && (
              <div className="hud-label px-3 pb-2 pt-1">Modules</div>
            )}
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-md text-sm font-medium transition-all duration-200',
                    collapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5',
                    isActive
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  {/* Active edge */}
                  <span
                    className={cn(
                      'absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-primary transition-all duration-200',
                      isActive ? 'opacity-100 shadow-[0_0_8px_hsl(var(--primary)/0.8)]' : 'opacity-0'
                    )}
                  />
                  <item.icon
                    className={cn('w-5 h-5 flex-shrink-0 transition-colors', isActive && 'text-primary')}
                  />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.name}</span>
                      <span
                        className={cn(
                          'hud-label transition-opacity',
                          isActive ? 'text-primary opacity-100' : 'opacity-0 group-hover:opacity-50'
                        )}
                      >
                        {item.code}
                      </span>
                    </>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Status strip */}
          {!collapsed && (
            <div className="px-4 py-3 border-t border-border">
              <div className="flex items-center gap-2">
                <span className="hud-dot live" />
                <span className="hud-label">API Online</span>
                <span className="hud-label ml-auto opacity-60">v5</span>
              </div>
            </div>
          )}

          {/* User */}
          <div className="p-3 border-t border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-3 w-full rounded-md p-2 text-left transition-colors hover:bg-secondary',
                    collapsed && 'justify-center'
                  )}
                >
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-sm font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {user.name || 'User'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <ChevronsUpDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={collapsed ? 'right' : 'top'}
                align={collapsed ? 'start' : 'center'}
                className="w-56"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.name || 'User'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Account Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleTheme}>
                  {theme === 'dark' ? (
                    <>
                      <Sun className="mr-2 h-4 w-4" />
                      Light Mode
                    </>
                  ) : (
                    <>
                      <Moon className="mr-2 h-4 w-4" />
                      Dark Mode
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* ── Mobile header ────────────────────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-16 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4">
        <Link href="/dashboard">
          <Logo size="sm" />
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user.name || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {navigation.map((item) => (
              <DropdownMenuItem key={item.name} asChild>
                <Link href={item.href} className="cursor-pointer">
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={toggleTheme}>
              {theme === 'dark' ? (
                <>
                  <Sun className="mr-2 h-4 w-4" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="mr-2 h-4 w-4" />
                  Dark Mode
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Mobile bottom bar ────────────────────────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-card/80 backdrop-blur-md border-t border-border">
        <nav className="flex items-center justify-around h-full px-2">
          {navigation.slice(0, 5).map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.name.split(' ')[0]}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}
