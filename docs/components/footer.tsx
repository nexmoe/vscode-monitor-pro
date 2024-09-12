import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="w-full py-12 bg-gray-100 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            © {new Date().getFullYear()} Monitor Pro. 由 <Link href="https://github.com/nexmoe" className="text-blue-500 hover:underline" target='_blank'>
              Nexmoe
            </Link> 开发
          </p>
        </div>
      </div>
    </footer>
  )
}