import React, { type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'ghost' | 'outline' | 'icon' | 'icon-secondary' | 'icon-ghost' | 'ghost-text';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'none';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  className = '',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  ...props
}, ref) => {
  const baseClasses = 'inline-flex justify-center items-center transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-[#4a6b46] hover:bg-[#395336] text-white font-bold shadow-md transform active:scale-[0.98]',
    secondary: 'bg-[#f0ece1] hover:bg-[#e6dfcf] text-[#4a6b46] font-bold shadow-sm',
    dark: 'bg-gray-800 hover:bg-gray-900 text-white font-bold shadow',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-500 hover:text-gray-900 font-semibold shadow-none',
    'ghost-text': 'bg-transparent text-gray-600 hover:text-[#4a6b46] font-medium shadow-none cursor-pointer',
    outline: 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold shadow-lg',
    icon: 'bg-white hover:bg-gray-50 text-gray-700 shadow-lg border border-gray-200',
    'icon-secondary': 'bg-[#f0ece1] hover:bg-[#e5decb] text-[#4a6b46]',
    'icon-ghost': 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
  };

  const sizes = {
    sm: 'py-2 px-3 text-sm rounded-full gap-1.5',
    md: 'py-2.5 px-4 rounded-full gap-2',
    lg: 'py-3 px-6 rounded-full gap-2',
    icon: 'h-11 w-11 rounded-full',
    'icon-sm': 'h-9 w-9 rounded-full',
    none: ''
  };

  const isPrimary = variant === 'primary';
  const shadowClasses = isPrimary ? (size === 'lg' || size === 'md' ? 'shadow-lg hover:shadow-xl' : 'shadow') : '';

  const classes = [
    baseClasses,
    variants[variant],
    sizes[size],
    shadowClasses,
    fullWidth ? 'w-full' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <button ref={ref} className={classes} {...props}>
      {children}
    </button>
  );
});

Button.displayName = 'Button';
