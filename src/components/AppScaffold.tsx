import { ReactNode } from 'react';
import { Sprout } from 'lucide-react';

interface PageShellProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  decor?: 'home' | 'calendar' | 'insights' | 'record' | 'settings';
}

function DecorativeBackground({ variant = 'home' }: { variant?: PageShellProps['decor'] }) {
  return (
    <div className={`decor-layer decor-${variant}`} aria-hidden="true">
      <span className="decor-blob decor-blob-green" />
      <span className="decor-blob decor-blob-orange" />
      <span className="decor-blob decor-blob-blue" />
      <span className="decor-dot decor-dot-one" />
      <span className="decor-dot decor-dot-two" />
      <span className="decor-dot decor-dot-three" />
      <span className="decor-leaf decor-leaf-one" />
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: Pick<PageShellProps, 'title' | 'subtitle' | 'action'>) {
  return (
    <header className="page-header">
      <div>
        <div className="page-title-row">
          <h1>{title}</h1>
          <Sprout className="title-sprout" strokeWidth={2.2} />
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="page-action">{action}</div>}
    </header>
  );
}

export function PageShell({ title, subtitle, action, children, className = '', decor = 'home' }: PageShellProps) {
  return (
    <main className={`app-screen page-enter ${className}`}>
      <DecorativeBackground variant={decor} />
      <div className="page-content">
        <PageHeader title={title} subtitle={subtitle} action={action} />
        {children}
      </div>
    </main>
  );
}
