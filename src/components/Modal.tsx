import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cx } from '../lib/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

export default function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className={cx(
          'relative z-10 w-full bg-surface shadow-modal',
          'rounded-t-2xl sm:rounded-2xl',
          'animate-slide-up sm:animate-scale-in',
          'max-h-[92vh] overflow-y-auto',
          SIZE[size],
        )}
      >
        {(title || subtitle) && (
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-surface/95 px-5 py-4 backdrop-blur">
            <div>
              {title && <h2 className="text-lg font-bold leading-tight">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="btn-ghost -mr-2 -mt-1 rounded-full p-2" aria-label="Luk">
              <X size={20} />
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-100 bg-surface/95 px-5 py-3 backdrop-blur">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
