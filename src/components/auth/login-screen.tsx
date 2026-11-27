import { LoginButton } from "./login-button"
import { AnimatedBackground } from "./animated-background"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { ThemeToggle } from "@/components/layout/theme-toggle"

const providerButton =
    "relative h-11 w-full rounded-xl border border-border bg-card font-medium text-foreground shadow-elev-1 hover:bg-accent hover:shadow-elev-2 group/btn"

export function LoginScreen() {
    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden lg:justify-end">
            <div className="absolute right-6 top-6 z-50">
                <ThemeToggle />
            </div>
            <AnimatedBackground />

            <div className="relative z-10 w-full max-w-md px-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 lg:max-w-lg lg:pr-24">
                <div className="surface-raised relative overflow-hidden">
                    <div className="flex flex-col items-center gap-3 px-8 pb-6 pt-10 text-center">
                        <div className="well mb-3 p-3">
                            <Image src="/logo.png" alt="Logo" width={48} height={48} className="h-12 w-12 object-contain" priority />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">Drawdown</h1>
                        <p className="max-w-xs text-sm text-muted-foreground">Mindful trading performance tracker</p>
                    </div>

                    <div className="flex flex-col gap-3 px-8 pb-6">
                        <LoginButton provider="google" label="Continue with Google" className={providerButton} icon="google" />

                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center">
                                <span className="bg-raised px-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Or</span>
                            </div>
                        </div>

                        <LoginButton provider="microsoft-entra-id" label="Continue with Microsoft" className={providerButton} icon="microsoft" />
                    </div>

                    <div className="border-t border-border bg-sunken/60 px-8 py-4 text-center">
                        <Link href="/demo" className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                            Explore the live demo
                            <ArrowRight className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" />
                        </Link>
                        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                            By continuing, you agree to our{" "}
                            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">Terms</Link> and{" "}
                            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</Link>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
