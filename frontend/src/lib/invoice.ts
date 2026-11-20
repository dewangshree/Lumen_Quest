import type { Bill } from './api'
import { PAYMENT_METHOD_LABELS } from './api'

// Generates and downloads a PDF invoice for a bill (jsPDF loaded on demand).
export async function downloadInvoice(bill: Bill, customer: { name: string; email: string }) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF()
  const rs = (n: number) => `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  doc.setFontSize(20)
  doc.text('SubsPro', 14, 20)
  doc.setFontSize(10)
  doc.setTextColor(110)
  doc.text('Subscription Management Platform', 14, 26)

  doc.setTextColor(0)
  doc.setFontSize(14)
  doc.text(bill.payment_status === 'paid' ? 'INVOICE' : 'BILL (UNPAID)', 196, 20, { align: 'right' })
  doc.setFontSize(10)
  doc.text(`Invoice #INV-${String(bill.billing_id).padStart(5, '0')}`, 196, 26, { align: 'right' })
  doc.text(`Date: ${new Date(bill.billing_date).toLocaleDateString('en-IN')}`, 196, 31, { align: 'right' })

  doc.text('Billed to:', 14, 44)
  doc.setFont('helvetica', 'bold')
  doc.text(customer.name, 14, 50)
  doc.setFont('helvetica', 'normal')
  doc.text(customer.email, 14, 55)

  const discount = bill.discount_applied ? (bill.amount * bill.discount_applied) / 100 : 0
  autoTable(doc, {
    startY: 64,
    head: [['Description', 'Validity', 'Amount']],
    body: [[`${bill.plan_name} subscription`, `${bill.validity_days} days`, rs(bill.amount)]],
    foot: [
      ...(discount ? [['', `Discount (${bill.discount_applied}%)`, `- ${rs(discount)}`]] : []),
      ['', 'Total', rs(bill.amount - discount)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] },
    footStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: 'bold' },
  })

  const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12
  doc.text(`Status: ${bill.payment_status.toUpperCase()}`, 14, y)
  doc.text(`Payment method: ${PAYMENT_METHOD_LABELS[bill.payment_method] || bill.payment_method}`, 14, y + 6)
  if (bill.transaction_id) doc.text(`Transaction ID: ${bill.transaction_id}`, 14, y + 12)
  doc.setTextColor(120)
  doc.setFontSize(9)
  doc.text('This is a computer-generated invoice.', 14, 285)

  doc.save(`invoice-INV-${String(bill.billing_id).padStart(5, '0')}.pdf`)
}
