'use client'

import { useState } from 'react'
import { App, Card, Button, Typography, Modal } from 'antd'
import { ArrowRightOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { createSettlementAction } from '@/app/actions'
import { useRouter } from 'next/navigation'
import type { BalanceData } from '@/lib/balances'

const { Text } = Typography

type SettlementItem = { fromName: string; toName: string; amount: number }

type Props = {
  data: BalanceData
  householdId: string
  compact?: boolean
  expenseCount?: number
  pendingSettlementIds?: string[]
  pendingSettlementItems?: SettlementItem[]
  mergedData?: BalanceData
}

export default function BalanceSummary({ data, householdId, compact, expenseCount = 0, pendingSettlementIds = [], pendingSettlementItems = [], mergedData }: Props) {
  const { message } = App.useApp()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const { balances, transactions } = data
  const hasPendingSettlement = pendingSettlementIds.length > 0

  const allSettled = transactions.length === 0

  const finalTransactions = hasPendingSettlement && mergedData ? mergedData.transactions : transactions

  async function handleSettle() {
    setLoading(true)
    const result = await createSettlementAction(
      householdId,
      finalTransactions.map(t => ({ fromId: t.fromId, toId: t.toId, amount: t.amount })),
      expenseCount,
      pendingSettlementIds
    )
    setLoading(false)
    setModalOpen(false)
    if (result.error) { message.error(result.error); return }
    message.success('Settlement created! Everyone can now confirm their payments.')
    router.refresh()
  }

  if (allSettled) return null

  const settleButton = (
    <Button type="primary" size="small" loading={loading} onClick={() => setModalOpen(true)}>
      Settle
    </Button>
  )

  return (
    <>
      <Card
        title="Unsettled Balances"
        style={{ marginBottom: 16 }}
        extra={settleButton}
      >
        {/* Net per member */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          {balances.map(b => (
            <div key={b.userId} style={{ display: 'flex', flexDirection: 'column' }}>
              <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{b.name}</Text>
              <Text
                strong
                style={{
                  fontSize: 14,
                  color: b.net > 0 ? '#4361EE' : b.net < 0 ? '#cf1322' : '#8c8c8c',
                }}
              >
                {b.net > 0 ? `+$${b.net.toFixed(2)}` : b.net < 0 ? `-$${Math.abs(b.net).toFixed(2)}` : 'settled'}
              </Text>
            </div>
          ))}
        </div>

        {/* Minimum transactions */}
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
          Settle up in {transactions.length} transfer{transactions.length !== 1 ? 's' : ''}:
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {transactions.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Text strong style={{ color: '#cf1322' }}>{t.fromName}</Text>
              <ArrowRightOutlined style={{ color: '#d9d9d9', fontSize: 11 }} />
              <Text strong style={{ color: '#4361EE' }}>{t.toName}</Text>
              <Text type="secondary" style={{ marginLeft: 4 }}>${t.amount.toFixed(2)}</Text>
            </div>
          ))}
        </div>

      </Card>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            Confirm Settlement
          </div>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalOpen(false)}>Cancel</Button>,
          <Button key="confirm" type="primary" loading={loading} onClick={handleSettle}>
            Start Settlement
          </Button>,
        ]}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Each person confirms after they&apos;ve sent the money. Expenses lock once all payments are confirmed.
        </Text>

        {hasPendingSettlement && pendingSettlementItems.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Existing pending settlement */}
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Existing settlement</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pendingSettlementItems.map((t, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', background: '#fafafa', borderRadius: 8,
                    border: '1px solid #f0f0f0',
                  }}>
                    <Text strong style={{ color: '#cf1322' }}>{t.fromName}</Text>
                    <ArrowRightOutlined style={{ color: '#d9d9d9', fontSize: 11 }} />
                    <Text strong style={{ color: '#4361EE' }}>{t.toName}</Text>
                    <Text style={{ marginLeft: 'auto' }} strong>${Number(t.amount).toFixed(2)}</Text>
                  </div>
                ))}
              </div>
            </div>

            {/* New expenses */}
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>New expenses</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {transactions.map((t, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', background: '#fafafa', borderRadius: 8,
                    border: '1px solid #f0f0f0',
                  }}>
                    <Text strong style={{ color: '#cf1322' }}>{t.fromName}</Text>
                    <ArrowRightOutlined style={{ color: '#d9d9d9', fontSize: 11 }} />
                    <Text strong style={{ color: '#4361EE' }}>{t.toName}</Text>
                    <Text style={{ marginLeft: 'auto' }} strong>${t.amount.toFixed(2)}</Text>
                  </div>
                ))}
              </div>
            </div>

            {/* Merged total */}
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Updated settlement</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {finalTransactions.map((t, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', background: '#f0f5ff', borderRadius: 8,
                    border: '1px solid #d6e4ff',
                  }}>
                    <Text strong style={{ color: '#cf1322' }}>{t.fromName}</Text>
                    <ArrowRightOutlined style={{ color: '#d9d9d9', fontSize: 11 }} />
                    <Text strong style={{ color: '#4361EE' }}>{t.toName}</Text>
                    <Text style={{ marginLeft: 'auto' }} strong>${t.amount.toFixed(2)}</Text>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {transactions.map((t, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', background: '#fafafa', borderRadius: 8,
                border: '1px solid #f0f0f0',
              }}>
                <Text strong style={{ color: '#cf1322' }}>{t.fromName}</Text>
                <ArrowRightOutlined style={{ color: '#d9d9d9', fontSize: 11 }} />
                <Text strong style={{ color: '#4361EE' }}>{t.toName}</Text>
                <Text style={{ marginLeft: 'auto' }} strong>${t.amount.toFixed(2)}</Text>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  )
}
