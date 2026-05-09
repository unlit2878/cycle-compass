import { NavLink } from 'react-router-dom';
import { MouseEvent } from 'react';
import { CalendarDays, ChartNoAxesColumn, Home, Plus, UserRound } from 'lucide-react';

interface BottomNavProps {
  onLogClick: () => void;
  onNavigate?: (to: string, event: MouseEvent<HTMLAnchorElement>) => void;
  active?: 'home' | 'calendar' | 'log' | 'insights' | 'settings';
}

const navItems = [
  { to: '/', id: 'home', icon: Home, label: '首页' },
  { to: '/calendar', id: 'calendar', icon: CalendarDays, label: '日历' },
  { to: '/insights', id: 'insights', icon: ChartNoAxesColumn, label: '趋势' },
  { to: '/settings', id: 'settings', icon: UserRound, label: '我的' },
] as const;

export function BottomNav({ onLogClick, onNavigate, active }: BottomNavProps) {
  const renderNav = (items: typeof navItems) =>
    items.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={(event) => onNavigate?.(item.to, event)}
        className={({ isActive }) =>
          `bottom-nav-item ${
            active === item.id || (!active && isActive) ? 'bottom-nav-item-active' : ''
          }`
        }
      >
        <item.icon className="bottom-nav-icon" strokeWidth={2.1} />
        <span>{item.label}</span>
      </NavLink>
    ));

  return (
    <nav className="bottom-nav" aria-label="主导航">
      <div className="bottom-nav-inner">
        {renderNav(navItems.slice(0, 2))}

        <button
          type="button"
          onClick={onLogClick}
          className={`bottom-log-button ${active === 'log' ? 'bottom-log-button-active' : ''}`}
          aria-label="记录"
        >
          <span className="bottom-log-circle">
            <Plus className="h-8 w-8" strokeWidth={2.8} />
          </span>
        </button>

        {renderNav(navItems.slice(2))}
      </div>
    </nav>
  );
}
