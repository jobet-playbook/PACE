import { NextRequest, NextResponse } from 'next/server'

// In-memory cache for QA metrics (resets on server restart)
let qaMetricsCache: any = null
let cacheTimestamp: number = 0

export async function POST(request: NextRequest) {
  try {
    console.log('📥 [QA Metrics] POST request received at:', new Date().toISOString())
    console.log('📥 [QA Metrics] Request headers:', Object.fromEntries(request.headers))
    console.log('📥 [QA Metrics] Content-Type:', request.headers.get('content-type'))
    
    const payload = await request.json()
    console.log('📦 [QA Metrics] Received payload type:', Array.isArray(payload) ? 'Array' : typeof payload)
    console.log('📦 [QA Metrics] Payload keys:', typeof payload === 'object' ? Object.keys(payload) : 'N/A')
    console.log('📦 [QA Metrics] Full payload:', JSON.stringify(payload, null, 2))

    let metricsData, googleDocFile

    // Handle different payload formats
    if (payload?.data && Array.isArray(payload.data)) {
      // Format: { data: [metricsData, googleDocFile] }
      console.log('📦 [QA Metrics] Detected format: { data: [...] }')
      metricsData = payload.data[0]
      googleDocFile = payload.data[1]
    } else if (Array.isArray(payload) && payload.length > 0) {
      if (payload[0]?.data && Array.isArray(payload[0].data)) {
        // Format: [{ data: [metricsData, googleDocFile] }]
        console.log('📦 [QA Metrics] Detected format: [{ data: [...] }]')
        metricsData = payload[0].data[0]
        googleDocFile = payload[0].data[1]
      } else {
        // Format: [metricsData, googleDocFile]
        console.log('📦 [QA Metrics] Detected format: [metricsData, googleDocFile]')
        metricsData = payload[0]
        googleDocFile = payload[1]
      }
    } else {
      console.error('❌ [QA Metrics] Invalid data format')
      return NextResponse.json(
        { error: 'Invalid data format. Expected { data: [...] } or array format.' },
        { status: 400 }
      )
    }
    
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
