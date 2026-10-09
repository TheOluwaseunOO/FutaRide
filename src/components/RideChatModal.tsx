import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface Message {
  id: string
  ride_id: string
  sender_id: string
  sender_role: 'rider' | 'driver' | 'admin'
  message: string
  created_at: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  rideId: string
  currentUserId: string
  currentUserRole: 'rider' | 'driver'
  otherPartyName: string
}

export default function RideChatModal({
  isOpen,
  onClose,
  rideId,
  currentUserId,
  currentUserRole,
  otherPartyName,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !rideId) return

    async function loadMessages() {
      const { data } = await supabase
        .from('ride_messages')
        .select('*')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: true })

      if (data) setMessages(data as Message[])
    }

    loadMessages()

    const channel = supabase
      .channel(`chat-ride-${rideId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ride_messages', filter: `ride_id=eq.${rideId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOpen, rideId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = inputText.trim()
    if (!text || sending) return

    setSending(true)
    setInputText('')

    const { error } = await supabase.from('ride_messages').insert({
      ride_id: rideId,
      sender_id: currentUserId,
      sender_role: currentUserRole,
      message: text,
    })

    setSending(false)
    if (error) console.error('Failed to send message:', error.message)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col h-[520px] overflow-hidden border border-neutral-200">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">{otherPartyName}</h3>
            <p className="text-[11px] text-neutral-400 capitalize">In-Ride Coordination · {currentUserRole === 'rider' ? 'Driver' : 'Passenger'}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-neutral-50/50">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400">
              <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-2 text-neutral-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-xs font-semibold">No messages yet</p>
              <p className="text-[11px] mt-0.5 max-w-xs text-neutral-400">
                Inform each other of pickup delays, specific junction landmarks, or questions.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.sender_id === currentUserId
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                      isMe
                        ? 'bg-neutral-900 text-white rounded-br-none'
                        : 'bg-white text-neutral-800 border border-neutral-200 rounded-bl-none'
                    }`}
                  >
                    {m.message}
                  </div>
                  <span className="text-[9px] text-neutral-400 mt-1 px-1">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-neutral-100 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-neutral-50 border border-neutral-200 focus:outline-none focus:border-amber-500 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            className="px-4 py-2.5 rounded-xl font-bold text-xs text-white hover:opacity-95 disabled:opacity-40 transition-all active:scale-95 shadow-sm"
            style={{ background: '#E6900E' }}
          >
            Send
          </button>
        </div>

      </div>
    </div>
  )
}