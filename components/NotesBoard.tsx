'use client'

import { useState, useEffect } from 'react'
import { App, Card, Button, Input } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { addNoteAction, deleteNoteAction } from '@/app/actions'
import { useRouter } from 'next/navigation'

const { TextArea } = Input

type Note = {
  id: string
  content: string
  created_at: string
  user_id: string
  profile: { display_name: string; avatar_color?: string | null; avatar_initials?: string | null } | null
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const chars = (s: string) => Array.from(s)
  if (parts.length === 1) return chars(parts[0]).slice(0, 2).join('').toUpperCase()
  return (chars(parts[0])[0] + chars(parts[1])[0]).toUpperCase()
}

function Avatar({ profile }: { profile: Note['profile'] }) {
  if (!profile) return null
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
      background: profile.avatar_color ?? '#d9d9d9',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: 0.5,
    }}>
      {profile.avatar_initials || getInitials(profile.display_name)}
    </div>
  )
}

type Props = {
  notes: Note[]
  householdId: string
  currentUserId: string
}

export default function NotesBoard({ notes: initialNotes, householdId, currentUserId }: Props) {
  const { message } = App.useApp()
  const router = useRouter()
  const [notes, setNotes] = useState(initialNotes)
  useEffect(() => { setNotes(initialNotes) }, [initialNotes])
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handlePost() {
    if (!text.trim()) return
    setPosting(true)
    const result = await addNoteAction(householdId, text)
    setPosting(false)
    if (result.error) { message.error(result.error); return }
    setText('')
    router.refresh()
  }

  async function handleDelete(noteId: string) {
    setDeletingId(noteId)
    const result = await deleteNoteAction(noteId)
    setDeletingId(null)
    if (result.error) { message.error(result.error); return }
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  function formatTime(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h ago`
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <Card title="Notes" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {notes.length === 0 && (
          <div style={{ color: '#bfbfbf', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
            No notes yet
          </div>
        )}

        {notes.map(note => (
          <div key={note.id} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '10px 12px', background: '#fafafa',
            borderRadius: 8, border: '1px solid #f0f0f0',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#3d3d3d', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {note.content}
              </div>
              <span style={{ fontSize: 11, color: '#bfbfbf', marginTop: 4, display: 'block' }}>
                {formatTime(note.created_at)}
              </span>
            </div>
            {note.user_id === currentUserId && (
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                loading={deletingId === note.id}
                onClick={() => handleDelete(note.id)}
                style={{ color: '#bfbfbf', flexShrink: 0 }}
              />
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 4 }}>
          <TextArea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Write a note..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handlePost() } }}
            style={{ flex: 1, fontSize: 13 }}
          />
          <Button
            type="primary"
            onClick={handlePost}
            loading={posting}
            disabled={!text.trim()}
            style={{ flexShrink: 0 }}
          >
            Post
          </Button>
        </div>
      </div>
    </Card>
  )
}
