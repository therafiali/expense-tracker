import * as React from 'react';
import { Pressable, type PressableProps, View } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Text } from './text';

const buttonVariants = cva(
  'flex-row items-center justify-center rounded-xl px-4 py-3 active:opacity-80',
  {
    variants: {
      variant: {
        default: 'bg-accent',
        outline: 'border border-accent bg-transparent',
        secondary: 'bg-card',
        ghost: 'bg-transparent',
        destructive: 'bg-red-500',
      },
      size: {
        default: 'h-12',
        sm: 'h-10 px-3',
        lg: 'h-14 px-8',
        icon: 'h-12 w-12 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface ButtonProps
  extends PressableProps,
    VariantProps<typeof buttonVariants> {
  label?: string;
  labelClasses?: string;
  children?: React.ReactNode;
}

const Button = React.forwardRef<View, ButtonProps>(
  ({ className, variant, size, label, labelClasses, children, ...props }, ref) => {
    return (
      <Pressable
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {label ? (
          <Text
            className={cn(
              'font-semibold text-center',
              variant === 'outline' ? 'text-accent' : 'text-white',
              labelClasses
            )}
          >
            {label}
          </Text>
        ) : (
          children
        )}
      </Pressable>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
