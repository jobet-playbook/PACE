import { NextResponse } from 'next/server'
import { getChartData } from '@/lib/chart-data'

export async function GET(
  request: Request,
  { params }: { params: { dashboardType: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const member = searchParams.get('member') || undefined

    const data = await getChartData(params.dashboardType, member)
    
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch chart data' },
      { status: 500 }
    )
  }
}
