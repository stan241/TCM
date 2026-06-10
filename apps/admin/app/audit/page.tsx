'use client'

/**
 * Admin — Audit Log Viewer
 * Append-only, tamper-evident. Displays chain_hash verification status inline.
 */

import { useState, useEffect } from 'react'

interface AuditEntry {
  audit_event_id: string
  token_id:       string
  result_type:    string
  event_time:     string
  chain_hash:     string
  hash_ok?:       boolean
}

export default function AuditLogPage() {
  const [entries,  setEntries]  = useState<AuditEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [page,     setPage]     = useState(0)
  const PAGE_SIZE = 50

  useEffect(() => {
    setLoading(true)
    fetch(`/api/v1/audit?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`)
      .then(r => r.json())
      .then(d => setEntries(d.entries ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [page])

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-tcm-blue">Audit Log</h1>
        <p className="text-sm text-tcm-grey mt-1">
          Append-only tamper-evident chain. Each row shows SHA-256 hash verification status.
        </p>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-tcm-grey">Loading…</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-tcm-light-grey text-tcm-grey uppercase">
              <tr>
                {['Event ID', 'Token', 'Type', 'Time', 'Hash', 'Integrity'].map(h => (
                  <th key={h} className="text-left px-3 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map(e => (
                <tr key={e.audit_event_id} className="hover:bg-tcm-light-grey">
                  <td className="px-3 py-2 font-mono text-tcm-grey">{e.audit_event_id.slice(0, 8)}…</td>
                  <td className="px-3 py-2 font-mono">{e.token_id}</td>
                  <td className="px-3 py-2">
                    <span className="bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">{e.result_type}</span>
                  </td>
                  <td className="px-3 py-2 text-tcm-grey whitespace-nowrap">
                    {new Date(e.event_time).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-tcm-grey">{e.chain_hash.slice(0, 12)}…</td>
                  <td className="px-3 py-2">
                    {e.hash_ok === false
                      ? <span className="text-red-600 font-bold">⚠ BROKEN</span>
                      : <span className="text-green-600">✓ OK</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex justify-between text-sm">
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          className="text-tcm-blue disabled:opacity-40"
        >
          ← Previous
        </button>
        <span className="text-tcm-grey">Page {page + 1}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={entries.length < PAGE_SIZE}
          className="text-tcm-blue disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
