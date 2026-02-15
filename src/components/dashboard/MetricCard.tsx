import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  variant?: "default" | "danger" | "warning" | "success" | "primary";
}

const variantStyles = {
  default: "text-foreground",
  danger: "text-destructive",
  warning: "text-warning",
  success: "text-success",
  primary: "text-primary",
};

export function MetricCard({ title, value, subtitle, icon: Icon, trend, variant = "default" }: MetricCardProps) {
  return (
    <div className="bg-card rounded-lg p-5 card-shadow border border-border">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className={`text-2xl font-bold ${variantStyles[variant]}`}>{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="p-2 rounded-md bg-secondary">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1">
          <span className={`text-xs font-medium ${trend.value >= 0 ? "text-destructive" : "text-success"}`}>
            {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
          </span>
          <span className="text-xs text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
