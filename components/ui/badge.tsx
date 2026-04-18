import * as React from 'react';
import { View, Text, type ViewProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'items-center rounded-full border px-2.5 py-0.5',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-accent',
        secondary: 'border-transparent bg-muted/20',
        destructive: 'border-transparent bg-red-500',
        outline: 'border-accent/20 bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends ViewProps,
    VariantProps<typeof badgeVariants> {
  label: string;
  labelClassName?: string;
}

function Badge({ className, variant, label, labelClassName, ...props }: BadgeProps) {
  return (
    <View className={cn(badgeVariants({ variant }), className)} {...props}>
      <Text className={cn('text-xs font-semibold text-white', labelClassName)}>{label}</Text>
    </View>
  );
}

export { Badge, badgeVariants };
