'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function updateTeamMemberPerformance(
  memberId: string,
  data: {
    todayTickets?: number
    todaySP?: number
    todayFirstPass?: number
    todayFirstPassSP?: number
    todayRepeatPass?: number
    todayRepeatPassSP?: number
    todayChurn?: number
  }
) {
  try {
    await prisma.teamMember.update({
      where: { id: memberId },
      data,
    })
    
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Failed to update team member:', error)
    return { success: false, error: 'Failed to update team member' }
  }
}

export async function addActivity(
  memberId: string,
  activity: {
    ticketKey: string
    sp: number
    type: string
    time: string
    description: string
  }
) {
  try {
    await prisma.activity.create({
      data: {
        ...activity,
        memberId,
      },
    })
    
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Failed to add activity:', error)
    return { success: false, error: 'Failed to add activity' }
  }
}
