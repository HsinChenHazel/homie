'use client'

import { useState, useRef, useEffect } from 'react'
import { App, Button, Table, Tag, Grid, Typography, Modal } from 'antd'
import { PlusOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Profile } from '@/lib/types'
import AddExpenseModal from './AddExpenseModal'
import { deleteExpenseAction } from '@/app/actions'

const { Text } = Typography
const DELETE_WIDTH = 72

type Props = {
  expenses: any[]
  members: Pick<Profile, 'id' | 'display_name'>[]
  currentUserId: string
  householdId: string | null
  defaultCurrency?: string
}

function getStatus(r: any) {
  const splits = r.splits ?? []
  const allSettled = splits.length > 0 && splits.every((s: any) => s.settled)
  const inSettlement = !allSettled && splits.some((s: any) => s.settlement_id)
  if (allSettled) return <Tag color="success">Settled</Tag>
  if (inSettlement) return <Tag color="processing">In Settlement</Tag>
  return <Tag>Unsettled</Tag>
}

function SwipeableRow({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const [offsetX, setOffsetX] = useState(0)
  const startXRef = useRef(0)
  const isOpenRef = useRef(false)
  const animatingRef = useRef(true)

  function onTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0].clientX
    animatingRef.current = false
  }

  function onTouchMove(e: React.TouchEvent) {
    const diff = e.touches[0].clientX - startXRef.current
    const base = isOpenRef.current ? -DELETE_WIDTH : 0
    const next = Math.min(0, Math.max(-DELETE_WIDTH, base + diff))
    setOffsetX(next)
  }

  function onTouchEnd() {
    animatingRef.current = true
    if (offsetX < -DELETE_WIDTH / 2) {
      setOffsetX(-DELETE_WIDTH)
      isOpenRef.current = true
    } else {
      setOffsetX(0)
      isOpenRef.current = false
    }
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 10 }}>
      {/* Delete area */}
      <div
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: DELETE_WIDTH,
          background: '#ff4d4f', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer',
        }}
        onClick={onDelete}
      >
        <DeleteOutlined style={{ color: '#fff', fontSize: 18 }} />
      </div>
      {/* Sliding content */}
      <div
        style={{ transform: `translateX(${offsetX}px)`, transition: animatingRef.current ? 'transform 0.2s ease' : 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (isOpenRef.current) { setOffsetX(0); isOpenRef.current = false } }}
      >
        {children}
      </div>
    </div>
  )
}

export default function ExpenseList({ expenses, members, currentUserId, householdId, defaultCurrency = 'USD' }: Props) {
  const { message } = App.useApp()
  const router = useRouter()
  const searchParams = useSearchParams()
  const screens = Grid.useBreakpoint()
  const isMobile = screens.md === false
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; inSettlement: boolean } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (searchParams.get('new') === '1' && householdId) {
      setOpen(true)
      router.replace('/expenses')
    }
  }, [searchParams, householdId])

  function promptDelete(r: any) {
    if (r.paid_by !== currentUserId) {
      message.error('Only the payer can delete this expense')
      return
    }
    const inSettlement = (r.splits ?? []).some((s: any) => s.settlement_id && !s.settled)
    setDeleteTarget({ id: r.id, inSettlement })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await deleteExpenseAction(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    router.refresh()
  }

  const columns = [
    { title: 'Date', dataIndex: 'date', key: 'date', width: 110 },
    { title: 'Description', dataIndex: 'title', key: 'title' },
    { title: 'Paid by', key: 'paid_by', render: (_: any, r: any) => r.paid_by_profile?.display_name ?? '—' },
    {
      title: 'Amount', dataIndex: 'amount', key: 'amount',
      render: (v: number, r: any) => `${r.currency ?? defaultCurrency} ${Number(v).toFixed(2)}`,
    },
    { title: 'Status', key: 'status', width: 130, render: (_: any, r: any) => getStatus(r) },
    {
      title: '', key: 'actions', width: 60,
      render: (_: any, r: any) =>
        r.paid_by === currentUserId ? (
          <Button icon={<DeleteOutlined />} type="text" danger size="small" onClick={() => promptDelete(r)} />
        ) : null,
    },
  ]

  return (
    <>
      {!isMobile && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)} disabled={!householdId}>
            Add Expense
          </Button>
        </div>
      )}

      {isMobile ? (
        <div>
          <Text strong style={{ display: 'block', marginBottom: 10, fontSize: 15 }}>All Expenses</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {expenses.length === 0 ? (
              <Text type="secondary" style={{ textAlign: 'center', display: 'block', padding: '32px 0' }}>
                No expenses yet
              </Text>
            ) : (
              expenses.map((r: any) => (
                <SwipeableRow
                  key={r.id}
                  onDelete={() => promptDelete(r)}
                >
                  <div style={{
                    background: '#fff',
                    border: '1px solid #f0f0f0',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <Text strong style={{ fontSize: 15, flex: 1, marginRight: 8 }}>{r.title}</Text>
                      <Text strong style={{ fontSize: 15, whiteSpace: 'nowrap' }}>
                        {r.currency ?? defaultCurrency} {Number(r.amount).toFixed(2)}
                      </Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {r.paid_by_profile?.display_name ?? '—'} · {r.date}
                      </Text>
                      {getStatus(r)}
                    </div>
                  </div>
                </SwipeableRow>
              ))
            )}
          </div>
        </div>
      ) : (
        <Table
          dataSource={expenses}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 600 }}
        />
      )}

      {householdId && (
        <AddExpenseModal
          open={open}
          onClose={() => setOpen(false)}
          members={members}
          currentUserId={currentUserId}
          householdId={householdId}
          defaultCurrency={defaultCurrency}
        />
      )}

      <Modal
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onOk={confirmDelete}
        okText="Delete"
        okButtonProps={{ danger: true, loading: deleting }}
        cancelButtonProps={{ disabled: deleting }}
        title="Delete expense?"
        centered
      >
        {deleteTarget?.inSettlement && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
            <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 16, marginTop: 2 }} />
            <Text>This expense is part of a pending settlement. Deleting it will update the settlement amount.</Text>
          </div>
        )}
        <Text>This action cannot be undone.</Text>
      </Modal>
    </>
  )
}
