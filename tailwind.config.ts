import type { Config } from "tailwindcss"

const config: Config = {
	darkMode: ["class"],
	content: [
		'./pages/**/*.{ts,tsx}',
		'./components/**/*.{ts,tsx}',
		'./app/**/*.{ts,tsx}',
		'./src/**/*.{ts,tsx}',
	],
	// Heatmap intensity classes are composed at runtime (bg-gain-3, bg-loss-5…)
	safelist: [
		{ pattern: /^bg-(gain|loss)-(1|2|3|4|5)$/ },
	],
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ["var(--font-gantari)", "sans-serif"],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				positive: 'hsl(var(--positive))',
				negative: 'hsl(var(--negative))',
				neutral: 'hsl(var(--neutral))',
				warning: 'hsl(var(--warning))',
				info: 'hsl(var(--info))',
				brand: {
					DEFAULT: 'hsl(var(--brand))',
					2: 'hsl(var(--brand-2))',
				},
				grid: 'hsl(var(--grid))',
				raised: 'hsl(var(--raised))',
				sunken: 'hsl(var(--sunken))',
				gain: {
					1: 'hsl(var(--gain-1))',
					2: 'hsl(var(--gain-2))',
					3: 'hsl(var(--gain-3))',
					4: 'hsl(var(--gain-4))',
					5: 'hsl(var(--gain-5))',
				},
				loss: {
					1: 'hsl(var(--loss-1))',
					2: 'hsl(var(--loss-2))',
					3: 'hsl(var(--loss-3))',
					4: 'hsl(var(--loss-4))',
					5: 'hsl(var(--loss-5))',
				},
				success: {
					DEFAULT: 'hsl(142, 76%, 36%)',
					foreground: 'hsl(138, 76%, 97%)'
				},
				error: {
					DEFAULT: 'hsl(0, 84%, 60%)',
					foreground: 'hsl(0, 86%, 97%)'
				},
				chart: {
					'1': 'hsl(var(--chart-1))',
					'2': 'hsl(var(--chart-2))',
					'3': 'hsl(var(--chart-3))',
					'4': 'hsl(var(--chart-4))',
					'5': 'hsl(var(--chart-5))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			},
			transitionTimingFunction: {
				'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
				'standard': 'cubic-bezier(0.2, 0, 0, 1)',
			},
			transitionDuration: {
				DEFAULT: '150ms',
				fast: '120ms',
				base: '180ms',
			},
			boxShadow: {
				'elev-1': 'var(--highlight), var(--elev-1)',
				'elev-2': 'var(--highlight), var(--elev-2)',
				'elev-3': 'var(--highlight), var(--elev-3)',
				inset: 'var(--inset)',
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
}

export default config
