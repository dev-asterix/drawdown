
"use client"

import { useSession, signOut } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, TrendingUp, Wallet, Settings, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils/utils"
import Link from "next/link"
import { FormattedCurrency, FormattedPercentage } from "@/components/common/formatted-values"
import { formatCurrency } from "@/lib/utils/format-settings"
import { useSettings } from "@/hooks/use-settings"
interface UserNavProps {
    stats?: {
        currentEquity: number;
        totalPnL: number;
        totalPnLPercentage: number;
    };
}

export function UserNav({ stats }: UserNavProps) {
    const { data: session } = useSession()
    const { settings } = useSettings()

    if (!session?.user) return null

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="pressable flex items-center rounded-xl border border-border bg-card p-1 shadow-elev-1 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60" aria-label="Account menu">
                    <Avatar className="h-7 w-7 md:h-8 md:w-8">
                        <AvatarImage src={session.user.image || ""} alt={session.user.name || ""} />
                        <AvatarFallback className="text-xs md:text-sm font-semibold bg-gradient-to-br from-brand to-brand-2 text-primary-foreground">
                            {session.user.name?.[0]}
                        </AvatarFallback>
                    </Avatar>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-2">
                {/* User Info */}
                <DropdownMenuLabel className="px-2 pb-2">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 ring-2 ring-primary/30">
                            <AvatarImage src={session.user.image || ""} alt={session.user.name || ""} />
                            <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-brand to-brand-2 text-primary-foreground">
                                {session.user.name?.[0]}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                                {session.user.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {session.user.email}
                            </p>
                        </div>
                    </div>
                </DropdownMenuLabel>

                {stats && (
                    <>
                        <DropdownMenuSeparator className="my-2" />
                        
                        {/* Stats Cards in Dropdown */}
                        <div className="space-y-2 px-2 py-2">
                            {/* Equity Card */}
                            <div className="well px-3 py-2.5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Current Equity
                                    </p>
                                </div>
                                <p className="text-lg font-bold text-foreground">
                                    {formatCurrency(stats.currentEquity, settings)}
                                </p>
                            </div>

                            {/* P&L Card */}
                            <div className="well px-3 py-2.5">
                                <div className="flex items-center gap-2 mb-1">
                                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Total P&L
                                    </p>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <p className={cn(
                                        'text-lg font-bold',
                                        stats.totalPnL >= 0 ? 'text-positive' : 'text-negative'
                                    )}>
                                        {stats.totalPnL >= 0 ? '+' : '−'}{formatCurrency(Math.abs(stats.totalPnL), settings)}
                                    </p>
                                    <span className={cn(
                                        'text-xs font-semibold px-2 py-0.5 rounded-md',
                                        stats.totalPnL >= 0 
                                            ? 'bg-positive/10 text-positive'
                                            : 'bg-negative/10 text-negative'
                                    )}>
                                        <FormattedPercentage value={stats.totalPnLPercentage} />
                                    </span>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <DropdownMenuSeparator className="my-2" />
                
                {/* Settings */}
                <DropdownMenuItem asChild>
                    <Link href="/settings" className="px-3 py-2 cursor-pointer text-foreground hover:bg-accent rounded-lg">
                        <Settings className="mr-2 h-4 w-4" />
                        <span className="font-medium">Settings</span>
                    </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-2" />
                
                {/* Sign Out */}
                <DropdownMenuItem 
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="px-3 py-2 cursor-pointer text-negative focus:text-negative focus:bg-negative/10 rounded-lg"
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span className="font-medium">Sign Out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
