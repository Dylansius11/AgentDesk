'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'

export function FaucetButton({ className }: { className?: string }) {
  const { address, isConnected } = useAccount()
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  if (!isConnected || !address) return null

  const claim = async () => {
    setState('loading')
    try {
      const res = await fetch(`${API_BASE}/v1/faucet`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      const json = (await res.json()) as {
        success?: boolean
        error?: string
        usdAmount?: string
        bnbAmount?: string
      }
      if (json.success) {
        setState('done')
        setMessage(`+${json.usdAmount} $U · +${json.bnbAmount} tBNB`)
      } else {
        setState('error')
        setMessage(json.error === 'rate_limited' ? 'Already claimed — try later' : 'Faucet unavailable')
      }
    } catch {
      setState('error')
      setMessage('Faucet unreachable')
    }
    setTimeout(() => {
      setState('idle')
      setMessage('')
    }, 5000)
  }

  return (
    <button
      className={className}
      disabled={state === 'loading'}
      onClick={claim}
      title={message || undefined}
      type="button"
    >
      {state === 'loading' ? 'Dripping…' : state === 'done' ? message : state === 'error' ? message : 'Get test tokens'}
    </button>
  )
}
