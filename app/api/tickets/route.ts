import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dashboardType = searchParams.get('dashboardType')
    const ticketType = searchParams.get('ticketType')
    const assignee = searchParams.get('assignee')
    
    const where: any = {}
    if (dashboardType) where.dashboardType = dashboardType
    if (ticketType) where.ticketType = ticketType
    if (assignee && assignee !== 'all') where.assignee = assignee
    
    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { age: 'desc' },
    })
    
    return NextResponse.json(tickets)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch tickets' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const ticket = await prisma.ticket.create({
      data: body,
    })
    
    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create ticket' },
      { status: 500 }
    )
  }
}
