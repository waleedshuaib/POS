import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { currency, dateTime } from '../../lib/format';
import { Modal } from '../../components/Modal';
import { useCart } from './cartStore';

interface HeldSale {
  id: number;
  invoiceNo: string;
  heldName: string | null;
  grandTotal: number;
  customerId: number | null;
  createdAt: number;
}

export function HeldSalesModal({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const cart = useCart();
  const held = useQuery({
    queryKey: ['sales.held'],
    queryFn: () => api<HeldSale[]>('sales.listHeld', {}),
  });

  const resume = useMutation({
    mutationFn: async (id: number) => {
      const data = await api<{
        lines: Array<{ productId: number; qty: number; unitPrice: number; lineDiscount: number }>;
        customerId: number | null;
      }>('sales.resumeHeld', { id });
      // Enrich with product names by fetching products and matching
      const products = await api<Array<{ id: number; nameAr: string; nameEn: string; taxRate: number }>>('products.list', {});
      const lang = i18n.language as 'ar' | 'en';
      const lines = data.lines.map((l) => {
        const p = products.find((pp) => pp.id === l.productId);
        return {
          productId: l.productId,
          name: p ? (lang === 'ar' ? p.nameAr : p.nameEn) : String(l.productId),
          qty: l.qty,
          unitPrice: l.unitPrice,
          lineDiscount: l.lineDiscount,
          taxRate: p?.taxRate ?? 0,
        };
      });
      cart.loadFromHeld(lines, data.customerId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales.held'] });
      onClose();
    },
  });

  return (
    <Modal open={true} onClose={onClose} title={t('pos.heldSales')}>
      {(held.data ?? []).length === 0 && <div className="text-center text-slate-400 py-6">—</div>}
      <ul className="divide-y divide-slate-200">
        {(held.data ?? []).map((h) => (
          <li key={h.id} className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium">{h.heldName ?? h.invoiceNo}</div>
              <div className="text-xs text-slate-500">{dateTime(h.createdAt)}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold">{currency(h.grandTotal)}</span>
              <button className="btn-primary" onClick={() => resume.mutate(h.id)}>
                {t('pos.resumeHold')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
