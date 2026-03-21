export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; positive: boolean };
  color: "blue" | "green" | "yellow" | "purple" | "red" | "orange";
}

const colorMap = {
  blue: { bg: "bg-blue-50", icon: "bg-blue-600", text: "text-blue-600" },
  green: { bg: "bg-green-50", icon: "bg-green-600", text: "text-green-600" },
  yellow: { bg: "bg-yellow-50", icon: "bg-yellow-500", text: "text-yellow-600" },
  purple: { bg: "bg-purple-50", icon: "bg-purple-600", text: "text-purple-600" },
  red: { bg: "bg-red-50", icon: "bg-red-600", text: "text-red-600" },
  orange: { bg: "bg-orange-50", icon: "bg-orange-600", text: "text-orange-600" },
};

export function StatCard({ title, value, subtitle, icon, trend, color }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
      <div className={`${c.bg} p-3 rounded-xl`}>
        <div className={`${c.text}`}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-800 mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        {trend && (
          <p className={`text-xs font-medium mt-1 ${trend.positive ? "text-green-600" : "text-red-500"}`}>
            {trend.positive ? "↑" : "↓"} {trend.value}% vs last month
          </p>
        )}
      </div>
    </div>
  );
}
