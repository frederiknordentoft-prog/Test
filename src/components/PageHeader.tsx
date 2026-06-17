import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cx } from '../lib/ui';

export interface Crumb {
  label: string;
  to?: string;
}

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export default function PageHeader({ title, subtitle, crumbs, actions, icon, className }: Props) {
  return (
    <div className={cx('mb-5', className)}>
      {crumbs && crumbs.length > 0 && (
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-sm text-ink-muted">
          {crumbs.map((c, i) => (
            <Fragment key={i}>
              {i > 0 && <ChevronRight size={14} className="opacity-60" />}
              {c.to ? (
                <Link to={c.to} className="truncate transition-colors hover:text-ink">
                  {c.label}
                </Link>
              ) : (
                <span className="truncate font-medium text-ink-soft">{c.label}</span>
              )}
            </Fragment>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="page-title truncate">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
