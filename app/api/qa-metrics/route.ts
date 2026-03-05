import { NextRequest, NextResponse } from 'next/server'

// In-memory cache for QA metrics (resets on server restart)
let qaMetricsCache: any = null
let cacheTimestamp: number = 0

export async function POST(request: NextRequest) {
  try {
    console.log('📥 [QA Metrics] POST request received at:', new Date().toISOString())
    console.log('📥 [QA Metrics] Request headers:', Object.fromEntries(request.headers))
    
    const data = await request.json()
    console.log('📦 [QA Metrics] Received data type:', Array.isArray(data) ? 'Array' : typeof data)
    console.log('📦 [QA Metrics] Data length:', Array.isArray(data) ? data.length : 'N/A')

    // Validate that we have the expected data structure
    if (!Array.isArray(data) || data.length === 0) {
      console.error('❌ [QA Metrics] Invalid data format - not an array or empty')
      return NextResponse.json(
        { error: 'Invalid data format. Expected an array with at least one element.' },
        { status: 400 }
      )
    }

    const [metricsData, googleDocFile] = data
    console.log('📊 [QA Metrics] Metrics data keys:', Object.keys(metricsData || {}))
    console.log('📄 [QA Metrics] Google Doc file:', googleDocFile?.name || 'Not provided')

    // Extract the main report data
    const { output, last_30_business_days, critical_qa_wip_tickets, old_qa_wip_tickets } = metricsData

    if (!output) {
      console.error('❌ [QA Metrics] Missing output data in payload')
      return NextResponse.json(
        { error: 'Missing output data in payload' },
        { status: 400 }
      )
    }

    console.log('✅ [QA Metrics] Output data found')
    console.log('📅 [QA Metrics] Report date:', output.date)
    console.log('📋 [QA Metrics] Report type:', output.report_meta?.report_type)
    console.log('👥 [QA Metrics] People count:', output.people?.length || 0)
    console.log('🔴 [QA Metrics] Critical tickets:', critical_qa_wip_tickets?.length || 0)
    console.log('⏰ [QA Metrics] Old tickets:', old_qa_wip_tickets?.length || 0)

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

    console.log('💾 [QA Metrics] Data cached successfully at:', qaMetricsCache.receivedAt)

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
    console.error('❌ [QA Metrics] Error processing QA metrics:', error)
    console.error('❌ [QA Metrics] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
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
    console.log('📤 [QA Metrics] GET request received at:', new Date().toISOString())
    
    if (!qaMetricsCache) {
      console.log('⚠️ [QA Metrics] No cached data available')
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

    console.log('✅ [QA Metrics] Returning cached data')
    console.log('⏱️ [QA Metrics] Cache age:', cacheAgeMinutes, 'minutes')
    console.log('📅 [QA Metrics] Cached at:', qaMetricsCache.receivedAt)

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
    console.error('❌ [QA Metrics] Error retrieving QA metrics:', error)
    console.error('❌ [QA Metrics] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { 
        error: 'Failed to retrieve QA metrics data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
