import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border-2 border-border bg-transparent text-foreground hover:border-primary/50 hover:bg-primary/5",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-md",
        ghost: "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
        link: "text-primary underline-offset-4 hover:underline",
        premium: "bg-primary text-primary-foreground hover:bg-primary/80 shadow-lg hover:shadow-xl hover:-translate-y-1 glow-sm hover:glow-md",
        "premium-outline": "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground hover:-translate-y-0.5",
        gold: "bg-primary text-primary-foreground hover:bg-primary/80 shadow-lg hover:-translate-y-1 glow-md",
        "gold-outline": "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground",
        hero: "bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow-xl hover:-translate-y-1 hover:shadow-2xl glow-md hover:glow-lg",
        "hero-outline": "border-2 border-foreground/30 text-foreground hover:bg-foreground/10 hover:border-foreground/50 hover:-translate-y-0.5",
        nav: "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
        dark: "bg-card text-foreground border border-border hover:border-primary/30 hover:bg-secondary",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 rounded-md px-4",
        lg: "h-12 rounded-lg px-8",
        xl: "h-14 rounded-xl px-10 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
