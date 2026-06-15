import Link from 'next/link'

export default function NotFound() {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
          <p className="text-gray-600 mb-6">Page not found.</p>
          <Link href="/dashboard" className="text-indigo-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </body>
    </html>
  )
}
