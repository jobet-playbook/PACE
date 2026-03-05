import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
    })
    
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(ticket)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch ticket' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    const ticket = await prisma.ticket.update({
      where: { id: params.id },
      data: body,
    })
    
    return NextResponse.json(ticket)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update ticket' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.ticket.delete({
      where: { id: params.id },
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete ticket' },
      { status: 500 }
    )
  }
}
