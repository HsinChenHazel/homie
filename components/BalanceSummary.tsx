'use client'

import { useState } from 'react'
import { App, Card, Button, Typography, Modal } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
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
        extra={compact ? null : settleButton}
      >
        {/* Two-column: Gets back | Owes */}
        {(() => {
          const getsBack = balances.filter(b => b.net > 0)
          const owes = balances.filter(b => b.net < 0)
          const colStyle: React.CSSProperties = { flex: 1, minWidth: 0 }
          const rowStyle: React.CSSProperties = {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 0',
          }
          return (
            <div style={{ display: 'flex', gap: 0 }}>
              <div style={colStyle}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>Gets back</Text>
                {getsBack.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
                ) : getsBack.map(b => (
                  <div key={b.userId} style={rowStyle}>
                    <Text style={{ fontSize: 13 }}>{b.name}</Text>
                    <Text strong style={{ fontSize: 13, color: '#389e0d', marginLeft: 8 }}>
                      ${b.net.toFixed(2)}
                    </Text>
                  </div>
                ))}
              </div>

              <div style={{ width: 1, background: '#f0f0f0', margin: '0 16px', alignSelf: 'stretch' }} />

              <div style={colStyle}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>Owes</Text>
                {owes.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
                ) : owes.map(b => (
                  <div key={b.userId} style={rowStyle}>
                    <Text style={{ fontSize: 13 }}>{b.name}</Text>
                    <Text strong style={{ fontSize: 13, color: '#DC3545', marginLeft: 8 }}>
                      ${Math.abs(b.net).toFixed(2)}
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

      </Card>

      <Modal
        title="Confirm Settlement"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalOpen(false)}>Cancel</Button>,
          <Button key="confirm" type="primary" loading={loading} onClick={handleSettle}>
            Start Settlement
          </Button>,
        ]}
      >
        {hasPendingSettlement && pendingSettlementItems.length > 0 && (
          <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
            Merging {pendingSettlementItems.length} existing + {transactions.length} new transaction{transactions.length !== 1 ? 's' : ''} into a single settlement.
          </Text>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {finalTransactions.map((t, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', background: '#fafafa', borderRadius: 8,
              border: '1px solid #f0f0f0',
            }}>
              <Text strong style={{ color: '#DC3545' }}>{t.fromName}</Text>
              <ArrowRightOutlined style={{ color: '#d9d9d9', fontSize: 11 }} />
              <Text strong style={{ color: '#82957F' }}>{t.toName}</Text>
              <Text style={{ marginLeft: 'auto' }} strong>
                {typeof (t as any).currency === 'string' ? (t as any).currency + ' ' : ''}${t.amount.toFixed(2)}
              </Text>
            </div>
          ))}
        </div>

        <Text type="secondary" style={{ display: 'block', marginTop: 14, fontSize: 12 }}>
          Each person confirms after they&apos;ve sent the money. Expenses lock once all payments are confirmed.
        </Text>
      </Modal>
    </>
  )
}
