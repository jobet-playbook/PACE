"use client"

import { useState, useEffect } from "react"
import type { CRData, CROwner, CRPushbackTicket } from "@/lib/code-review-workflow"

// ── Helpers ────────────────────────────────────────────────────────────────────

function getTrendEl(current: number, previous: number) {
  const diff = current - previous
  if (diff > 0) return <span className="text-emerald-600 text-xs font-medium mt-1 block">▲ +{diff} vs prior</span>
  if (diff < 0) return <span className="text-red-500 text-xs font-medium mt-1 block">▼ {diff} vs prior</span>
  return <span className="text-slate-400 text-xs font-medium mt-1 block">— 0 vs prior</span>
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  GREEN:  { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200' },
  YELLOW: { bg: 'bg-yellow-50',   text: 'text-yellow-700',  border: 'border-yellow-200'  },
  RED:    { bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-200'     },
}

const STATUS_LEFT_BORDER: Record<string, string> = {
  GREEN:  'border-l-emerald-600',
  YELLOW: 'border-l-yellow-600',
  RED:    'border-l-red-600',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, trend }: { label: string; value: React.ReactNode; trend?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 flex-1 min-w-0">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</div>
      <div className="text-4xl font-extrabold text-slate-900">{value}</div>
      {trend}
    </div>
  )
}

function OwnersTable({ owners }: { owners: CROwner[] }) {
  if (owners.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6 text-center text-slate-500 italic text-sm">
        No tickets entered Code Review in the last 7 days.
      </div>
    )
  }
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Owner</th>
            <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Total Tickets</th>
            <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tickets</th>
            <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Weighted SP</th>
          </tr>
        </thead>
        <tbody>
          {owners.map((o, i) => (
            <tr key={o.owner} className={i < owners.length - 1 ? 'border-b border-slate-100' : ''}>
              <td className="px-5 py-4 font-medium text-slate-800">{o.owner}</td>
              <td className="px-5 py-4 text-slate-500 text-center">
                {o.ticket_count}
                {o.missing_sp > 0 && (
                  <div className="text-red-400 text-xs mt-1">({o.missing_sp} missing SP)</div>
                )}
              </td>
              <td className="px-5 py-4 text-slate-500 text-xs leading-relaxed">{o.ticket_keys}</td>
              <td className="px-5 py-4 text-slate-900 font-bold text-center">{o.weighted_sp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExclusionsTable({ exclusions }: { exclusions: CRPushbackTicket[] }) {
  if (exclusions.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-6 text-center text-slate-500 italic text-sm">
          No exclusions (re-entries) detected in the last 28 days. 🎉
        </div>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="bg-red-50 border-b border-red-200">
            <th className="px-5 py-4 text-xs font-semibold text-red-800 uppercase tracking-wide">Ticket</th>
            <th className="px-5 py-4 text-xs font-semibold text-red-800 uppercase tracking-wide">Owner</th>
            <th className="px-5 py-4 text-xs font-semibold text-red-800 uppercase tracking-wide">Status</th>
            <th className="px-5 py-4 text-xs font-semibold text-red-800 uppercase tracking-wide text-center">Entries</th>
          </tr>
        </thead>
        <tbody>
          {exclusions.map((ex, i) => {
            const last = ex.pushback_history[ex.pushback_history.length - 1]
            const assignee = last?.assignee ?? 'Unknown'
            const status   = last?.pushback_activity?.status ?? 'Unknown'
            return (
              <tr key={ex.key} className={i < exclusions.length - 1 ? 'border-b border-slate-100' : ''}>
                <td className="px-5 py-4 font-semibold text-red-600">{ex.key}</td>
                <td className="px-5 py-4 text-slate-700">{assignee}</td>
                <td className="px-5 py-4">
                  <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-1 rounded">{status}</span>
                </td>
                <td className="px-5 py-4 font-semibold text-slate-800 text-center">{ex.cr_pass_count}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CodeReviewReport() {
  const [data, setData]       = useState<CRData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/code-review-metrics/live')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setData(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
        Loading Code Review metrics from Jira…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
        <p className="font-semibold mb-1">Failed to load Code Review metrics</p>
        <p className="text-sm">{error ?? 'Unknown error'}</p>
      </div>
    )
  }

  const { w7, prior_w7, owners, exclusions, status, recommendations, report_date } = data
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.GREEN

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Code Review Pace Report</h2>
          <p className="text-sm text-slate-500 mt-1">Reporting Window: Last 7 Days ({report_date})</p>
        </div>
        <span className={`text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-md border ${s.bg} ${s.text} ${s.border}`}>
          STATUS: {status}
        </span>
      </div>

      {/* 3 summary cards */}
      <div className="flex gap-4">
        <StatCard
          label="Total Tickets (7d)"
          value={w7.total_tickets}
          trend={getTrendEl(w7.total_tickets, prior_w7.total_tickets)}
        />
        <StatCard
          label="1st-Pass Reviews (7d)"
          value={w7.pass_distribution.p1}
          trend={getTrendEl(w7.pass_distribution.p1, prior_w7.pass_distribution.p1)}
        />
        <StatCard
          label="Exclusions (28d)"
          value={exclusions.length}
          trend={<span className="text-slate-400 text-xs font-medium mt-1 block">Re-entered tickets</span>}
        />
      </div>

      {/* Recommendations */}
      <div className={`border-l-4 rounded-r-lg p-4 bg-white shadow-sm ${STATUS_LEFT_BORDER[status] ?? STATUS_LEFT_BORDER.GREEN}`}>
        <h3 className="text-sm font-bold text-slate-900 mb-2">Recommendations &amp; Insights</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
          {recommendations.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </div>

      {/* Pass distribution breakdown */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '1st Pass', val: w7.pass_distribution.p1,     color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
          { label: '2nd Pass', val: w7.pass_distribution.p2,     color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
          { label: '3rd Pass', val: w7.pass_distribution.p3,     color: 'text-orange-700 bg-orange-50 border-orange-200' },
          { label: '4th+ Pass', val: w7.pass_distribution.p4plus, color: 'text-red-700 bg-red-50 border-red-200' },
        ].map(({ label, val, color }) => (
          <div key={label} className={`rounded-lg border p-4 text-center ${color}`}>
            <div className="text-3xl font-extrabold">{val}</div>
            <div className="text-xs font-semibold uppercase tracking-wide mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Weighted SP note */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 leading-relaxed">
        <span className="font-semibold">Weighted SP formula:</span>{' '}
        1st pass = 100% · 2nd pass = 33% · 3rd pass = 25% · 4th+ = 0% — higher re-entry rates reduce a developer's weighted output.
      </div>

      {/* Owners table */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-3">Tickets in Code Review Last 7 Days by Owner</h3>
        <OwnersTable owners={owners} />
      </div>

      {/* Exclusions table */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Tickets with Re-entries Last 28 Days</h3>
        <p className="text-sm text-slate-500 mb-3">
          Tickets entering Code Review on their 2nd+ occurrence (contribute 0 to weighted throughput).
        </p>
        <ExclusionsTable exclusions={exclusions} />
      </div>

    </div>
  )
}
