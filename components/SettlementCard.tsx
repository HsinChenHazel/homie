'use client'

import { useState } from 'react'
import { App, Card, Button, Typography, Grid } from 'antd'
import { ArrowRightOutlined, ClockCircleOutlined, CheckCircleOutlined } from '@ant-design/icons'
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
  const isMobile = Grid.useBreakpoint().md === false

  const hasItems = settlement.settlement_items.length > 0
  const allPaid = hasItems && settlement.settlement_items.every(i => i.paid_at !== null)
  const utilityTags: string[] = Array.from(new Set(
    (settlement.linked_splits ?? [])
      .map(s => s.expense)
      .filter(e => e?.expense_type === 'utility' && e.utility_category)
      .map(e => e!.utility_category!)
  ))

  if (!hasItems) return null

  async function handleMarkPaid(itemId: string) {
    setLoadingId(itemId)
    const result = await markPaidAction(itemId)
    setLoadingId(null)
    if (result.error) {
      message.error(result.error)
      return
    }
    message.success('Marked as paid!')
    router.refresh()
  }

  const titleRow = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {allPaid
        ? <CheckCircleOutlined style={{ color: '#4361EE' }} />
        : <ClockCircleOutlined style={{ color: '#faad14' }} />
      }
      <span>Settlement</span>
      <span style={{
        fontSize: 12,
        fontWeight: 400,
        color: allPaid ? '#4361EE' : '#d46b08',
        background: allPaid ? 'transparent' : '#fff7e6',
        border: `1px solid ${allPaid ? '#4361EE' : '#ffd591'}`,
        borderRadius: 4,
        padding: '0 6px',
        lineHeight: '20px',
      }}>
        {allPaid ? 'Complete' : 'Pending'}
      </span>
      {utilityTags.map(cat => (
        <span key={cat} style={{
          fontSize: 11,
          fontWeight: 400,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          color: '#595959',
          background: '#f5f5f5',
          border: '1px solid #d9d9d9',
          borderRadius: 4,
          padding: '0 6px',
          lineHeight: '20px',
        }}>
          {utilityIcon(cat)}{utilityLabel(cat)}
        </span>
      ))}
    </div>
  )

  const metaText = (
    <Text type="secondary" style={{ fontSize: 11 }}>
      Initiated by {settlement.created_by_profile?.display_name ?? 'someone'} · {settlement.expense_count} expense{settlement.expense_count !== 1 ? 's' : ''} · {settlement.created_at.slice(0, 10)}
    </Text>
  )

  return (
    <Card
      style={{ marginBottom: 16 }}
      title={titleRow}
      extra={!isMobile ? metaText : undefined}
    >

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {settlement.settlement_items.map(item => {
          const isMyDebt = item.from_user_id === currentUserId
          const isPaid = item.paid_at !== null

          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '10px 14px',
                background: isPaid ? '#f6ffed' : '#fafafa',
                borderRadius: 8,
                border: `1px solid ${isPaid ? '#b7eb8f' : '#f0f0f0'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <MiniAvatar profile={item.from_profile} />
                <Text strong style={{ color: isPaid ? '#8c8c8c' : '#cf1322' }}>
                  {item.from_profile?.display_name ?? '?'}
                </Text>
                <ArrowRightOutlined style={{ color: '#4361EE', fontSize: 13 }} />
                <MiniAvatar profile={item.to_profile} />
                <Text strong style={{ color: isPaid ? '#8c8c8c' : '#4361EE' }}>
                  {item.to_profile?.display_name ?? '?'}
                </Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: isPaid ? '#8c8c8c' : undefined, textDecoration: isPaid ? 'line-through' : undefined }}>
                  ${Number(item.amount).toFixed(2)}
                </Text>
                {isPaid && <CheckCircleOutlined style={{ color: '#4361EE', fontSize: 13 }} />}
              </div>

              {isMyDebt && !isPaid && (
                <Button
                  type="primary"
                  size="small"
                  loading={loadingId === item.id}
                  onClick={() => handleMarkPaid(item.id)}
                  style={{ fontSize: 11, padding: '0 8px', height: 24 }}
                >
                  I&apos;ve paid
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {isMobile && (
        <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 12, paddingTop: 10 }}>
          {metaText}
        </div>
      )}
    </Card>
  )
}
