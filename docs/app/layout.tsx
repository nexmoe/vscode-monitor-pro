import './global.css'
import { RootProvider } from 'fumadocs-ui/provider'
import { Inter } from 'next/font/google'
import type { ReactNode } from 'react'

const inter = Inter({
	subsets: ['latin'],
})

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" className={inter.className} suppressHydrationWarning>
			<body className="min-h-screen bg-background">
				<RootProvider search={{ enabled: false }}>{children}</RootProvider>
			</body>
		</html>
	)
}
