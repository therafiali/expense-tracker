import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<View, ViewProps>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn('rounded-2xl bg-card border border-white/5 p-4 shadow-sm', className)}
    {...props}
  />
));
Card.displayName = 'Card';

export { Card };
