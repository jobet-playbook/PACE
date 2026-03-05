import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dashboardType = searchParams.get('dashboardType')
    
    const where = dashboardType ? { dashboardType } : {}
    
    const members = await prisma.teamMember.findMany({
      where,
      include: {
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })
    
    return NextResponse.json(members)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const member = await prisma.teamMember.create({
      data: body,
    })
    
    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create team member' },
      { status: 500 }
    )
  }
}
