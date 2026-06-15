'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Critical Error</h1>
          <p className="text-gray-600 mb-4">The application encountered an unrecoverable error.</p>
          {error.digest && (
            <p className="text-xs text-gray-400 mb-4 font-mono">Error ID: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
