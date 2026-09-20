'use client'

import { useState } from 'react'
import { App, Card, Button, Typography } from 'antd'
import { CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { markPaidAction } from '@/app/actions'
import { useRouter } from 'next/navigation'
import { utilityLabel, utilityIcon } from '@/components/expenses/AddExpenseModal'

const { Text } = Typography

type AvatarProfile = { id: string; display_name: string; avatar_color?: string | null; avatar_initials?: string | null } | null

type SettlementItem = {
  id: string
  from_user_id: string
  to_user_id: string
  amount: number
  paid_at: string | null
  from_profile: AvatarProfile
  to_profile: AvatarProfile
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const chars = (s: string) => Array.from(s)
  if (parts.length === 1) return chars(parts[0]).slice(0, 2).join('').toUpperCase()
  return (chars(parts[0])[0] + chars(parts[1])[0]).toUpperCase()
}

function MiniAvatar({ profile }: { profile: AvatarProfile }) {
  if (!profile) return null
  return (
    <div style={{
      width: 26, height: 26, borderRadius: '50%',
      background: profile.avatar_color ?? '#d9d9d9',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 700, color: '#fff',
      flexShrink: 0, letterSpacing: 0.5,
    }}>
      {profile.avatar_initials || getInitials(profile.display_name)}
    </div>
  )
}

type LinkedSplit = {
  expense: { expense_type: string; utility_category: string | null } | null
}

type Settlement = {
  id: string
  created_at: string
  status: string
  expense_count: number
  settlement_type?: string
  utility_category?: string
  settlement_items: SettlementItem[]
  created_by_profile: { id: string; display_name: string } | null
  linked_splits?: LinkedSplit[]
}

type Props = {
  settlement: Settlement
  currentUserId: string
}

export default function SettlementCard({ settlement, currentUserId }: Props) {
  const { message } = App.useApp()
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const myDebts = settlement.settlement_items.filter(i => i.from_user_id === currentUserId && !i.paid_at)
  const owedToMe = settlement.settlement_items.filter(i => i.to_user_id === currentUserId && !i.paid_at)

  if (myDebts.length === 0 && owedToMe.length === 0) return null

  const utilityTags: string[] = Array.from(new Set(
    (settlement.linked_splits ?? [])
      .map(s => s.expense)
      .filter(e => e?.expense_type === 'utility' && e.utility_category)
      .map(e => e!.utility_category!)
  ))

  async function handleMarkPaid(itemId: string) {
    setLoadingId(itemId)
    const result = await markPaidAction(itemId)
    setLoadingId(null)
    if (result.error) { message.error(result.error); return }
    message.success('Marked as paid!')
    router.refresh()
  }

  const sectionLabel = (text: string) => (
    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>{text}</Text>
  )

  return (
    <Card
      style={{ marginBottom: 16 }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>Settlement</span>
          <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>
            · {settlement.created_at.slice(0, 10)}
          </Text>
          {utilityTags.map(cat => (
            <span key={cat} style={{
              fontSize: 11, fontWeight: 400,
              display: 'inline-flex', alignItems: 'center', gap: 3,
              color: '#595959', background: '#f5f5f5',
              border: '1px solid #d9d9d9', borderRadius: 4,
              padding: '0 6px', lineHeight: '20px',
            }}>
              {utilityIcon(cat)}{utilityLabel(cat)}
            </span>
          ))}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {myDebts.length > 0 && (
          <div>
            {sectionLabel('You owe')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myDebts.map(item => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: '#fafafa',
                  borderRadius: 8, border: '1px solid #f0f0f0',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MiniAvatar profile={item.to_profile} />
                    <Text strong>
                      {item.to_profile?.display_name ?? '?'}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Text strong>${Number(item.amount).toFixed(2)}</Text>
                    <Button
                      type="primary"
                      size="small"
                      loading={loadingId === item.id}
                      onClick={() => handleMarkPaid(item.id)}
                      style={{ fontSize: 11, padding: '0 8px', height: 24 }}
                    >
                      I&apos;ve paid
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {owedToMe.length > 0 && (
          <div>
            {sectionLabel("You're owed")}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {owedToMe.map(item => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: '#fafafa',
                  borderRadius: 8, border: '1px solid #f0f0f0',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MiniAvatar profile={item.from_profile} />
                    <Text style={{ color: '#595959' }}>
                      {item.from_profile?.display_name ?? '?'}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text strong>${Number(item.amount).toFixed(2)}</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ClockCircleOutlined style={{ color: '#bfbfbf', fontSize: 12 }} />
                      <Text type="secondary" style={{ fontSize: 11 }}>Waiting</Text>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </Card>
  )
}
