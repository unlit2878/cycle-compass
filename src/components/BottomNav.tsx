import { NavLink } from 'react-router-dom';
import { Home, Calendar, Plus, BarChart3, Settings } from 'lucide-react';
import { zh } from '@/lib/i18n';

interface BottomNavProps {
  onLogClick: () => void;
}

export function BottomNav({ onLogClick }: BottomNavProps) {
  const navItems = [
    { to: '/', icon: Home, label: zh.nav.home },
    { to: '/calendar', icon: Calendar, label: zh.nav.calendar },
    { to: '/insights', icon: BarChart3, label: zh.nav.insights },
    { to: '/settings', icon: Settings, label: zh.nav.settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass border-t border-border pb-safe">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.slice(0, 2).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="text-xs">{item.label}</span>
          </NavLink>
        ))}

        {/* Center Log Button */}
        <button
          onClick={onLogClick}
          className="flex flex-col items-center gap-1 -mt-4"
        >
          <div className="w-14 h-14 rounded-full gradient-primary shadow-lg flex items-center justify-center">
            <Plus className="w-7 h-7 text-white" />
          </div>
          <span className="text-xs text-muted-foreground">{zh.nav.log}</span>
        </button>

        {navItems.slice(2).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="text-xs">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
