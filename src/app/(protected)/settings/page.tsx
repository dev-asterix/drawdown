'use client';

import { SettingsForm } from '@/components/settings/settings-form';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserNav } from '@/components/auth/user-nav';
import { Footer } from '@/components/layout/footer';
import { Settings } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-screen app-backdrop text-foreground">
      {/* Premium Header */}
      <header className="sticky top-0 z-40 flex h-16 md:h-20 shrink-0 items-center justify-between gap-3 md:gap-6 border-b border-border px-4 md:px-8 bg-card shadow-elev-1">
        {/* Logo Section - Clickable */}
        <Link href="/" className="flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity duration-200">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-blue-500/10 shadow-elev-2 ring-1 ring-primary/30 transition duration-base hover:shadow-elev-3 hover:">
            <Image
              src="/logo.png"
              alt="Logo"
              width={24}
              height={24}
              className="object-contain md:w-7 md:h-7"
            />
          </div>
          <div>
            <h1 className="font-bold text-base md:text-xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">Drawdown</h1>
            <p className="hidden md:block text-[10px] font-medium text-muted-foreground">Portfolio Tracker</p>
          </div>
        </Link>

        {/* Settings Icon & Title - Center on Mobile - Clickable */}
        <Link href="/" className="flex-1 flex justify-center sm:hidden hover:opacity-80 transition-opacity duration-200">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Settings</span>
          </div>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserNav />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-base">
          <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
            {/* Desktop Title Section */}
            <div className="hidden sm:block mb-8">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="h-6 w-6 text-primary" />
                <h1 className="text-3xl font-bold">Settings</h1>
              </div>
              <p className="text-muted-foreground">
                Manage your preferences and portfolio settings
              </p>
            </div>

            {/* Settings Form */}
            <div className="rounded-xl border border-border bg-card p-6 md:p-8">
              <SettingsForm />
            </div>
          </div>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
