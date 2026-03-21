import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success";
type Size    = "sm" | "md" | "lg";

const variantStyles: Record<Variant, string> = {
  primary:   "erp-btn-primary text-white",
  secondary: "bg-white text-gray-700 hover:bg-gray-50 border-gray-300 shadow-sm",
  danger:    "bg-[#dc3545] text-white hover:bg-[#b02a37] border-[#b02a37] shadow-sm",
  ghost:     "bg-transparent text-gray-600 hover:bg-gray-100 border-transparent",
  success:   "bg-[#1e6b45] text-white hover:bg-[#165436] border-[#165436] shadow-sm",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

export default function Button({
  variant = "primary", size = "md", loading, icon, children,
  className = "", disabled, ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 font-medium rounded-md border transition-all
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
