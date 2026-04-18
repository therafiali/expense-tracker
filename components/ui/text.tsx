import * as React from 'react';
import { Text as RNText, TextProps } from 'react-native';
import { cn } from '@/lib/utils';

const Text = React.forwardRef<RNText, TextProps>(({ className, ...props }, ref) => {
  return (
    <RNText
      ref={ref}
      className={cn('text-text font-normal', className)}
      {...props}
    />
  );
});

Text.displayName = 'Text';

export { Text };
