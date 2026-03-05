import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('📥 [QA Metrics] POST request received at:', new Date().toISOString())
    console.log('📥 [QA Metrics] Request headers:', Object.fromEntries(request.headers))
    console.log('📥 [QA Metrics] Content-Type:', request.headers.get('content-type'))
    
    const payload = await request.json()
    console.log('📦 [QA Metrics] Received payload type:', Array.isArray(payload) ? 'Array' : typeof payload)
    console.log('📦 [QA Metrics] Payload keys:', typeof payload === 'object' ? Object.keys(payload) : 'N/A')

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
    const { output, last_30_business_days, rollback_windows, critical_wip_tickets, old_qa_wip_tickets, docs_id } = metricsData

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
    console.log('🔴 [QA Metrics] Critical tickets:', critical_wip_tickets?.length || 0)
    console.log('⏰ [QA Metrics] Old tickets:', old_qa_wip_tickets?.length || 0)

    // Save to Supabase
    const { data: insertedData, error: insertError } = await supabase
      .from('pace_qa_metrics')
      .insert({
        output,
        last_30_business_days,
        rollback_windows,
        critical_wip_tickets,
        old_qa_wip_tickets,
        docs_id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ [QA Metrics] Supabase insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to save metrics to database', details: insertError.message },
        { status: 500 }
      )
    }

    console.log('💾 [QA Metrics] Data saved to Supabase successfully, ID:', insertedData.id)

    return NextResponse.json({
      success: true,
      message: 'QA metrics data saved successfully',
      reportDate: output.date,
      reportType: output.report_meta.report_type,
      assigneeCount: output.people?.length || 0,
      criticalTicketsCount: critical_wip_tickets?.length || 0,
      oldTicketsCount: old_qa_wip_tickets?.length || 0,
      savedAt: insertedData.created_at,
      id: insertedData.id,
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

// GET endpoint to retrieve latest QA metrics from Supabase
export async function GET(request: NextRequest) {
  try {
    console.log('📤 [QA Metrics] GET request received at:', new Date().toISOString())
    
    // Fetch the most recent record from Supabase
    const { data, error } = await supabase
      .from('pace_qa_metrics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      console.log('⚠️ [QA Metrics] No data available in database')
      return NextResponse.json(
        { 
          error: 'No QA metrics data available',
          message: 'Waiting for daily data from n8n workflow'
        },
        { status: 404 }
      )
    }

    // Calculate data age
    const createdAt = new Date(data.created_at)
    const ageMinutes = Math.floor((Date.now() - createdAt.getTime()) / 1000 / 60)
    const ageHours = Math.floor(ageMinutes / 60)

    console.log('✅ [QA Metrics] Returning data from Supabase')
    console.log('⏱️ [QA Metrics] Data age:', ageMinutes, 'minutes')
    console.log('📅 [QA Metrics] Created at:', data.created_at)

    return NextResponse.json({
      success: true,
      data: {
        output: data.output,
        last_30_business_days: data.last_30_business_days,
        rollback_windows: data.rollback_windows,
        critical_wip_tickets: data.critical_wip_tickets,
        old_qa_wip_tickets: data.old_qa_wip_tickets,
        docs_id: data.docs_id,
        receivedAt: data.created_at,
      },
      cacheInfo: {
        cachedAt: data.created_at,
        ageMinutes: ageMinutes,
        ageHours: ageHours,
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
