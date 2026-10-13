import type { ButtonHTMLAttributes } from 'react'

const VARIANTS = {
  primary: 'bg-accent text-white hover:bg-accent/85',
  danger: 'bg-danger/90 text-white hover:bg-danger',
  default: 'border border-line bg-raised hover:bg-hover'
}

export function Button({ variant = 'default', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded px-3 py-1.5 font-medium disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
