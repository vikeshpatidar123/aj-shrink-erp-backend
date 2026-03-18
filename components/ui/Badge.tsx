type BadgeVariant = "green" | "red" | "yellow" | "blue" | "purple" | "gray" | "orange";

const variants: Record<BadgeVariant, string> = {
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-700",
  yellow: "bg-yellow-100 text-yellow-700",
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
  gray: "bg-gray-100 text-gray-600",
  orange: "bg-orange-100 text-orange-700",
};

export function Badge({ label, variant }: { label: string; variant: BadgeVariant }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {label}
    </span>
  );
}

export function statusBadge(status: string) {
  const map: Record<string, BadgeVariant> = {
    Active: "green", Inactive: "red",
    Running: "green", Idle: "gray", Maintenance: "yellow",
    Pending: "yellow", Estimated: "blue", Converted: "green", Rejected: "red",
    Confirmed: "blue", "In Production": "yellow", Ready: "purple", Dispatched: "green",
    Open: "gray", "In Progress": "yellow", Completed: "green", "On Hold": "red",
    Draft: "gray", Approved: "green",
    "In Transit": "blue", Delivered: "green",
    A: "blue", B: "purple", C: "orange",
  };
  return <Badge label={status} variant={map[status] ?? "gray"} />;
}
