'use client'

import { useState } from 'react'
import { Button } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import AddExpenseModal from './expenses/AddExpenseModal'
import type { Profile } from '@/lib/types'

type Props = {
  members: Pick<Profile, 'id' | 'display_name'>[]
  currentUserId: string
  householdId: string
  defaultCurrency?: string
}

export default function AddExpenseFAB({ members, currentUserId, householdId, defaultCurrency }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="primary"
        shape="circle"
        icon={<PlusOutlined />}
        size="large"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          width: 56,
          height: 56,
          fontSize: 22,
          boxShadow: '0 4px 16px rgba(67,97,238,0.35)',
          zIndex: 1000,
        }}
      />
      <AddExpenseModal
        open={open}
        onClose={() => setOpen(false)}
        members={members}
        currentUserId={currentUserId}
        householdId={householdId}
        defaultCurrency={defaultCurrency}
      />
    </>
  )
}
