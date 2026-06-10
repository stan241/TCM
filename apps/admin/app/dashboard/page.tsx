/**
 * Admin Dashboard — Overview metrics for compliance team
 *
 * Server component: reads live counts from TCM API.
 * Access is restricted to allowlisted admin emails (middleware enforces).
 */

const API = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

interface Stats {
  total_active:    number
  total_suspended: number
  total_revoked:   number
  pending_kyc:     number
  pending_mints:   number
  audit_events_24h: number
}

async function getStats(): Promise<Stats> {
  try {
    const res = await fetch(`${API}/api/v1/admin/stats`, { cache: 'no-store' })
    if (!res.ok) throw new Error()
    return res.json()
  } catch {
    return { total_active: 0, total_suspended: 0, total_revoked: 0, pending_kyc: 0, pending_mints: 0, audit_events_24h: 0 }
  }
}

export default async function AdminDashboard() {
  const stats = await getStats()

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-tcm-blue">Operations Dashboard</h1>
        <p className="text-sm text-tcm-grey mt-1">Real-time compliance overview</p>
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Active credentials" value={stats.total_active}    color="green"  />
        <MetricCard label="Suspended"           value={stats.total_suspended} color="yellow" />
        <MetricCard label="Revoked"             value={stats.total_revoked}   color="red"    />
        <MetricCard label="Pending KYC"         value={stats.pending_kyc}     color="blue"   />
        <MetricCard label="Pending mints"       value={stats.pending_mints}   color="blue"   />
        <MetricCard label="Audit events (24h)"  value={stats.audit_events_24h} color="gray"  />
      </div>

      {/* Quick links */}
      <div className="bg-white rounded-xl border p-6 space-y-3">
        <h2 className="font-semibold text-tcm-blue text-sm">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <a href="/credentials" className="block bg-tcm-light-grey hover:bg-gray-200 rounded-lg p-4 transition-colors">
            <p className="font-medium">Credential Management</p>
            <p className="text-xs text-tcm-grey mt-0.5">Search, suspend, revoke credentials</p>
          </a>
          <a href="/audit" className="block bg-tcm-light-grey hover:bg-gray-200 rounded-lg p-4 transition-colors">
            <p className="font-medium">Audit Log</p>
            <p className="text-xs text-tcm-grey mt-0.5">Append-only tamper-evident log</p>
          </a>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    green:  'border-l-green-500',
    yellow: 'border-l-yellow-500',
    red:    'border-l-red-500',
    blue:   'border-l-blue-500',
    gray:   'border-l-gray-400',
  }
  return (
    <div className={`bg-white rounded-xl border border-l-4 ${colors[color]} p-5`}>
      <p className="text-xs text-tcm-grey uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-tcm-blue mt-1">{value.toLocaleString()}</p>
    </div>
  )
}
