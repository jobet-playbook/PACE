import { NextRequest, NextResponse } from 'next/server'

// In-memory cache for QA metrics (resets on server restart)
let qaMetricsCache: any = null
let cacheTimestamp: number = 0

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // Validate that we have the expected data structure
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: 'Invalid data format. Expected an array with at least one element.' },
        { status: 400 }
      )
    }

    const [metricsData, googleDocFile] = data

    // Extract the main report data
    const { output, last_30_business_days, critical_qa_wip_tickets, old_qa_wip_tickets } = metricsData

    if (!output) {
      return NextResponse.json(
        { error: 'Missing output data in payload' },
        { status: 400 }
      )
    }

    // Store in cache
    qaMetricsCache = {
      output,
      last_30_business_days,
      critical_qa_wip_tickets,
      old_qa_wip_tickets,
      googleDocFile,
      receivedAt: new Date().toISOString(),
    }
    cacheTimestamp = Date.now()

    return NextResponse.json({
      success: true,
      message: 'QA metrics data cached successfully',
      reportDate: output.date,
      reportType: output.report_meta.report_type,
      assigneeCount: output.people?.length || 0,
      criticalTicketsCount: critical_qa_wip_tickets?.length || 0,
      oldTicketsCount: old_qa_wip_tickets?.length || 0,
      cachedAt: qaMetricsCache.receivedAt,
    })
  } catch (error) {
    console.error('Error processing QA metrics:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process QA metrics data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve cached QA metrics
export async function GET(request: NextRequest) {
  try {
    if (!qaMetricsCache) {
      return NextResponse.json(
        { 
          error: 'No QA metrics data available',
          message: 'Waiting for daily data from n8n workflow'
        },
        { status: 404 }
      )
    }

    // Calculate cache age
    const cacheAgeMinutes = Math.floor((Date.now() - cacheTimestamp) / 1000 / 60)
    const cacheAgeHours = Math.floor(cacheAgeMinutes / 60)

    return NextResponse.json({
      success: true,
      data: qaMetricsCache,
      cacheInfo: {
        cachedAt: qaMetricsCache.receivedAt,
        ageMinutes: cacheAgeMinutes,
        ageHours: cacheAgeHours,
      },
    })
  } catch (error) {
    console.error('Error retrieving QA metrics:', error)
    return NextResponse.json(
      { 
        error: 'Failed to retrieve QA metrics data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
