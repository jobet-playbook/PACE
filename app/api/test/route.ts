import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🧪 [TEST] GET request received at:', new Date().toISOString())
  return NextResponse.json({ 
    message: 'Test endpoint working!',
    timestamp: new Date().toISOString()
  })
}

export async function POST(request: NextRequest) {
  console.log('🧪 [TEST] POST request received at:', new Date().toISOString())
  console.log('🧪 [TEST] Headers:', Object.fromEntries(request.headers))
  
  try {
    const body = await request.json()
    console.log('🧪 [TEST] Body received:', JSON.stringify(body, null, 2))
    
    return NextResponse.json({ 
      success: true,
      message: 'Test POST successful!',
      receivedData: body,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('🧪 [TEST] Error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to parse body',
      timestamp: new Date().toISOString()
    }, { status: 400 })
  }
}
