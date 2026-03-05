export async function fetchDashboardData(dashboardType: 'qa' | 'documentation' | 'code-review') {
  const response = await fetch(`/api/dashboard/${dashboardType}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${dashboardType} dashboard data`)
  }
  return response.json()
}

export async function fetchChartData(dashboardType: string, member?: string) {
  const url = new URL(`/api/chart/${dashboardType}`, window.location.origin)
  if (member) {
    url.searchParams.set('member', member)
  }
  
  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error('Failed to fetch chart data')
  }
  return response.json()
}
