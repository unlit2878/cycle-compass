import { ReactNode } from 'react';

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
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: Pick<PageShellProps, 'title' | 'subtitle' | 'action'>) {
  return (
    <header className="page-header">
      <div>
        <div className="page-title-row">
          <h1>{title}</h1>
          <img className="title-sprout" src="/decor/01_leaf_sprout.png" alt="" aria-hidden="true" />
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="page-action">{action}</div>}
    </header>
  );
}

export function PageShell({ title, subtitle, action, children, className = '', decor = 'home' }: PageShellProps) {
  return (
    <main className={`app-screen ${className}`}>
      <DecorativeBackground variant={decor} />
      <div className="page-content">
        <PageHeader title={title} subtitle={subtitle} action={action} />
        {children}
      </div>
    </main>
  );
}
