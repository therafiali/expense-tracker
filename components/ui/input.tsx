import * as React from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';
import { cn } from '@/lib/utils';
import { Text } from './text';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<TextInput, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <View className="flex flex-col gap-1.5 w-full">
        {label && <Text className="text-sm font-medium text-muted">{label}</Text>}
        <TextInput
          ref={ref}
          className={cn(
            'h-12 w-full rounded-xl bg-card border border-white/10 px-4 text-text',
            error && 'border-red-500',
            className
          )}
          placeholderTextColor="#6B7280"
          {...props}
        />
        {error && <Text className="text-xs text-red-500">{error}</Text>}
      </View>
    );
  }
);

Input.displayName = 'Input';

export { Input };
