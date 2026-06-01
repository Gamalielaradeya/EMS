import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import type { ButtonHTMLAttributes } from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
      },
      size: {
        default: "h-10",
        sm: "h-9 px-3",
        icon: "size-10 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ asChild = false, className, variant, size, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button"
  return <Component className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
