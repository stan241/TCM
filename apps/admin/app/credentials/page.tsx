'use client'

/**
 * Admin — Credential Management
 * Search credentials, view details, trigger suspend/revoke.
 */

import { useState } from 'react'

export default function CredentialManagement() {
  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState<any[]>([])
  const [loading,     setLoading]     = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setActionError(null)

    try {
      const res  = await fetch(`/api/v1/credentials/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setResults(data.results ?? [])
    } catch { setResults([]) }
    finally   { setLoading(false) }
  }

  async function takeAction(token_id: string, action: 'suspend' | 'revoke') {
    const reason = prompt(`Enter reason for ${action}:`)
    if (!reason) return
    setActionError(null)

    const res  = await fetch(`/api/v1/credentials/${token_id}/${action}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ reason }),
    })
    const data = await res.json()
    if (!res.ok) { setActionError(data.error ?? 'Action failed'); return }

    // Refresh results
    setResults(prev => prev.map(r =>
      r.token_id === token_id
        ? { ...r, status: action === 'suspend' ? 'SUSPENDED' : 'REVOKED' }
        : r
    ))
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-tcm-blue">Credential Management</h1>
        <p className="text-sm text-tcm-grey mt-1">Search by token ID, wallet, or email</p>
      </div>

      <form onSubmit={search} className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="TCT-12345, 0xWallet, or email..."
          className="flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tcm-blue"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-tcm-blue text-white px-6 py-2 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{actionError}</div>
      )}

      {results.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-tcm-light-grey text-tcm-grey text-xs uppercase">
              <tr>
                {['Token ID', 'Status', 'Jurisdiction', 'Activated', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.map(row => (
                <CredentialRow key={row.token_id} row={row} onAction={takeAction} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results.length === 0 && !loading && query && (
        <div className="text-center text-sm text-tcm-grey py-12">No results found.</div>
      )}
    </div>
  )
}

function CredentialRow({ row, onAction }: { row: any; onAction: (id: string, action: 'suspend'|'revoke') => void }) {
  const statusColor: Record<string, string> = {
    ACTIVE:    'text-green-700 bg-green-100',
    SUSPENDED: 'text-yellow-700 bg-yellow-100',
    REVOKED:   'text-red-700 bg-red-100',
    EXPIRED:   'text-gray-600 bg-gray-100',
  }
  const color = statusColor[row.status] ?? 'text-gray-600 bg-gray-100'

  return (
    <tr className="hover:bg-tcm-light-grey transition-colors">
      <td className="px-4 py-3 font-mono text-xs">{row.token_id}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{row.status}</span>
      </td>
      <td className="px-4 py-3">{row.jurisdiction_code}</td>
      <td className="px-4 py-3 text-tcm-grey">
        {row.activated_at ? new Date(row.activated_at).toLocaleDateString() : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          {row.status === 'ACTIVE' && (
            <button
              onClick={() => onAction(row.token_id, 'suspend')}
              className="text-xs text-yellow-700 border border-yellow-300 rounded px-2 py-1 hover:bg-yellow-50"
            >
              Suspend
            </button>
          )}
          {row.status !== 'REVOKED' && (
            <button
              onClick={() => onAction(row.token_id, 'revoke')}
              className="text-xs text-red-700 border border-red-300 rounded px-2 py-1 hover:bg-red-50"
            >
              Revoke
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
