import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfirm, useToast } from '../components/ui';
import { formatCurrency } from './format';

// One way to delete a payment from anywhere in the app (Payments log, account
// timelines, profile activity). Asks first, then the main process removes it
// and puts the balances back. Resolves true when the payment is gone.
//   deletePayment({ paymentId, amount, partyName })
export default function useDeletePayment() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();

  return useCallback(
    async ({ paymentId, amount, partyName }) => {
      if (!paymentId) return false;
      const ok = await confirm({
        title: 'Delete this payment?',
        message: `${formatCurrency(amount)}${partyName ? ` for ${partyName}` : ''} will be removed and the balance will go back to what it was before. This cannot be undone.`,
        confirmLabel: 'Delete',
        destructive: true,
      });
      if (!ok) return false;
      try {
        const res = await window.api.payments.delete({ paymentId, requestingUserId: user.id });
        if (!res?.success) {
          toast.error(res?.reason || 'Could not delete the payment.');
          return false;
        }
        toast.success('Payment deleted');
        return true;
      } catch {
        toast.error('Could not delete the payment.');
        return false;
      }
    },
    [confirm, toast, user.id]
  );
}
