import React, { useState } from 'react'

interface CancelRideModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
  role: 'rider' | 'driver'
  isSubmitting?: boolean
}

const RIDER_REASONS = [
  'Driver taking too long / not moving',
  'Change of plans / No longer needed',
  'Booked by mistake',
  'Price / fare disagreement',
  'Found alternative transport',
  'Other',
]

const DRIVER_REASONS = [
  'Rider not at pickup location',
  'Pickup location unreachable / road blocked',
  'Vehicle breakdown / flat tyre',
  'Rider requested cancellation',
  'Personal emergency',
  'Other',
]

export default function CancelRideModal({
  isOpen,
  onClose,
  onConfirm,
  role,
  isSubmitting = false,
}: CancelRideModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [customReason, setCustomReason] = useState<string>('')
  const [error, setError] = useState<string>('')

  if (!isOpen) return null

  const reasons = role === 'rider' ? RIDER_REASONS : DRIVER_REASONS
  const isOther = selectedReason === 'Other'
  const finalReason = isOther ? customReason.trim() : selectedReason

  async function handleConfirm() {
    if (!finalReason) {
      setError('Please select or specify a reason for cancellation.')
      return
    }
    setError('')
    await onConfirm(finalReason)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden p-6"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm">
              ✕
            </span>
            <h3 className="text-lg font-bold text-neutral-900">Cancel Ride Request</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-neutral-400 hover:text-neutral-600 text-lg leading-none p-1"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
          Please select a cancellation reason. This helps us maintain dispatch reliability on campus.
        </p>

        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-1">
          {reasons.map((reason) => {
            const isSelected = selectedReason === reason
            return (
              <button
                key={reason}
                type="button"
                onClick={() => {
                  setSelectedReason(reason)
                  setError('')
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                  isSelected
                    ? 'border-red-500 bg-red-50 text-red-900 font-semibold'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {reason}
              </button>
            )
          })}
        </div>

        {isOther && (
          <div className="mb-4">
            <textarea
              rows={2}
              value={customReason}
              onChange={(e) => {
                setCustomReason(e.target.value)
                setError('')
              }}
              placeholder="Please describe why you are cancelling..."
              className="w-full text-xs p-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:outline-none focus:border-red-500"
            />
          </div>
        )}

        {error && <p className="text-xs text-red-600 font-medium mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-all"
          >
            Keep Ride
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!finalReason || isSubmitting}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 transition-all"
          >
            {isSubmitting ? 'Cancelling...' : 'Confirm Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}