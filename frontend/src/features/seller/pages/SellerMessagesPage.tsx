import { Navigate } from 'react-router'

/**
 * Conversations live inside their negotiation thread. The seller "Messages"
 * entry points at the seller-side negotiation inbox so unread chat is one
 * click away without duplicating the thread UI.
 */
export default function SellerMessagesPage() {
  return <Navigate to="/seller/negotiations" replace />
}
