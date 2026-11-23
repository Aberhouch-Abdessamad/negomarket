import { useEffect, useRef, useState } from 'react'
import { getEcho, isRealtimeConfigured } from '@/services/realtime/echo'
import type { NegotiationMessage, NegotiationOffer, NegotiationStatus } from './types'

export interface RealtimeOfferPayload {
  negotiation_id: number
  negotiation_status: NegotiationStatus
  offer: {
    id: number
    amount: number
    status: NegotiationOffer['status']
    sender_role: NegotiationOffer['sender_role']
    sender: { id: number; name: string | null }
    parent_offer_id: number | null
    message: string | null
    expires_at: string | null
    created_at: string | null
  }
}

export interface RealtimeMessagePayload extends Omit<NegotiationMessage, 'sender'> {
  sender?: { id: number; name: string | null; avatar_url: string | null }
}

export interface NegotiationRealtimeHandlers {
  onMessage?: (message: RealtimeMessagePayload) => void
  onOffer?: (event: 'created' | 'accepted' | 'rejected' | 'countered', payload: RealtimeOfferPayload) => void
  onExpired?: () => void
  onReconnected?: () => void
}

/**
 * Subscribes to the private negotiation channel and forwards broadcast
 * payloads. The thread page re-fetches state after offers/expiry so it never
 * depends on broadcast payloads as the source of truth.
 */
export function useNegotiationRealtime(negotiationId: number | null, handlers: NegotiationRealtimeHandlers): { connected: boolean } {
  const [connected, setConnected] = useState(false)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!negotiationId || !isRealtimeConfigured()) {
      setConnected(false)
      return
    }

    const echo = getEcho()
    const channel = echo.private(`negotiations.${negotiationId}`)
    let first = true

    channel.subscribed(() => {
      setConnected(true)
      if (!first) handlersRef.current.onReconnected?.()
      first = false
    })

    channel.listen('.message.sent', (payload: RealtimeMessagePayload) => {
      handlersRef.current.onMessage?.(payload)
    })

    const offerHandler = (kind: 'created' | 'accepted' | 'rejected' | 'countered') => (payload: RealtimeOfferPayload) => {
      handlersRef.current.onOffer?.(kind, payload)
    }

    channel.listen('.offer.created', offerHandler('created'))
    channel.listen('.counter_offer.created', offerHandler('countered'))
    channel.listen('.offer.accepted', offerHandler('accepted'))
    channel.listen('.offer.rejected', offerHandler('rejected'))
    channel.listen('.negotiation.expired', () => handlersRef.current.onExpired?.())

    return () => {
      channel.stopListening('.message.sent')
      channel.stopListening('.offer.created')
      channel.stopListening('.counter_offer.created')
      channel.stopListening('.offer.accepted')
      channel.stopListening('.offer.rejected')
      channel.stopListening('.negotiation.expired')
      echo.leave(`negotiations.${negotiationId}`)
      setConnected(false)
    }
  }, [negotiationId])

  return { connected }
}
