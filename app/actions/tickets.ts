'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function updateTicketStatus(ticketId: string, status: string) {
  try {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status },
    })
    
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Failed to update ticket:', error)
    return { success: false, error: 'Failed to update ticket' }
  }
}

export async function deleteTicket(ticketId: string) {
  try {
    await prisma.ticket.delete({
      where: { id: ticketId },
    })
    
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete ticket:', error)
    return { success: false, error: 'Failed to delete ticket' }
  }
}

export async function createTicket(data: {
  key: string
  recentAge: number
  age: number
  sp: number | null
  assignee: string
  developer: string
  returnCount: number
  firstQA: string
  latestQA: string
  status: string
  summary: string
  dashboardType: string
  ticketType: string
}) {
  try {
    await prisma.ticket.create({
      data,
    })
    
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Failed to create ticket:', error)
    return { success: false, error: 'Failed to create ticket' }
  }
}
