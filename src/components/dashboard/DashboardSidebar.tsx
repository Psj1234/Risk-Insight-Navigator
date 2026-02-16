import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  UserSearch,
  TrendingUp,
  AlertTriangle,
  Brain,
  Shield,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", path: "/", icon: LayoutDashboard },
  { title: "Risk Prediction", path: "/prediction", icon: Zap },
  { title: "Behavioural Risk Explorer", path: "/risk-explorer", icon: UserSearch },
  { title: "Portfolio Drift Analytics", path: "/portfolio-drift", icon: TrendingUp },
  { title: "Alerts & Interventions", path: "/alerts", icon: AlertTriangle },
  { title: "Model Explainability", path: "/explainability", icon: Brain },
];

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-64"
      } bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-200 min-h-screen`}
    >
      <div className="flex items-center gap-2 px-4 py-5 border-b border-sidebar-border">
        <Shield className="h-6 w-6 text-sidebar-primary shrink-0" />
        {!collapsed && (
          <span className="font-semibold text-sm tracking-tight">
            Pre-Delinquency<br />Early Warning
          </span>
        )}
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
              title={collapsed ? item.title : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </button>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-3 border-t border-sidebar-border text-sidebar-muted hover:text-sidebar-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
