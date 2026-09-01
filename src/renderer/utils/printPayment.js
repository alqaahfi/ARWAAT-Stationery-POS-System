// Shared by every place in the Ledgers module that offers a payment receipt
// print choice — the initial Record Payment flow on Customer/Supplier Ledger,
// and the Reprint action on Payment History. Same two underlying print paths
// either way (main process routes on `format`), just triggered from
// different UI moments.
export async function printPaymentReceipt(paymentId, format) {
  const res = await window.api.printing.printPaymentReceipt({ paymentId, format });
  if (!res.success && !res.canceled) {
    window.alert(res.reason || 'Could not print receipt.');
  }
  return res;
}
