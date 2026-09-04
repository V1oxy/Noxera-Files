import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-apple-sm font-medium transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none no-drag whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover active:opacity-90",
  secondary:
    "bg-black/[0.05] text-label-primary hover:bg-black/[0.08] dark:bg-white/[0.08] dark:hover:bg-white/[0.12]",
  danger: "bg-danger text-white hover:bg-danger-hover active:opacity-90",
  ghost: "text-label-primary hover:bg-black/[0.05] dark:hover:bg-white/[0.08]",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[12px]",
  md: "h-8 px-3.5 text-[13px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", className = "", ...props }, ref) => (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  ),
);
Button.displayName = "Button";
