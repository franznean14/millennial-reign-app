"use client";

import NumberFlow from '@number-flow/react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface NumberFlowInputProps {
  value?: number;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export function NumberFlowInput({ 
  value = 0, 
  min = -Infinity, 
  max = Infinity, 
  onChange,
  className,
  size = 'md',
  disabled = false
}: NumberFlowInputProps) {
  const defaultValue = useRef(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const [animated, setAnimated] = useState(true);
  const [showCaret, setShowCaret] = useState(true);

  const handleInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAnimated(false);
    let next = value;
    const el = event.currentTarget;
    
    if (el.value === '') {
      next = defaultValue.current;
    } else {
      const num = el.valueAsNumber;
      if (!isNaN(num) && min <= num && num <= max) next = num;
    }
    
    el.value = String(next);
    onChange?.(next);
  };

  const handlePointerDown = (diff: number) => (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    
    setAnimated(true);
    if (event.pointerType === 'mouse') {
      event?.preventDefault();
      inputRef.current?.focus();
    }
    const newVal = Math.min(Math.max(value + diff, min), max);
    onChange?.(newVal);
  };

  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-5xl',
    lg: 'text-7xl'
  };

  const buttonSizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  };

  return (
    <div className={cn(
      "flex items-center justify-center",
      className
    )}>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "flex items-center justify-center rounded-full border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800",
          buttonSizeClasses[size]
        )}
        disabled={disabled || (min != null && value <= min)}
        onPointerDown={handlePointerDown(-1)}
      >
        <Minus className="size-4 text-zinc-600 dark:text-zinc-400" absoluteStrokeWidth strokeWidth={3.5} />
      </Button>
      
      <div className="relative text-center mx-8 flex items-center justify-center py-2">
        <Input
          ref={inputRef}
          className={cn(
            showCaret ? 'caret-primary' : 'caret-transparent',
            'w-[1.5em] bg-transparent border-0 text-center font-[inherit] text-transparent outline-none shadow-none focus-visible:ring-0',
            sizeClasses[size]
          )}
          style={{ fontKerning: 'none' }}
          type="number"
          min={min}
          step={1}
          autoComplete="off"
          inputMode="numeric"
          max={max}
          value={value}
          onInput={handleInput}
          disabled={disabled}
        />
        <NumberFlow
          value={value}
          locales="en-US"
          format={{ useGrouping: false }}
          aria-hidden="true"
          animated={animated}
          onAnimationsStart={() => setShowCaret(false)}
          onAnimationsFinish={() => setShowCaret(true)}
          className="pointer-events-none text-7xl font-extrabold tracking-tight text-foreground absolute inset-0 flex items-center justify-center"
          willChange
        />
      </div>
      
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "flex items-center justify-center rounded-full border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800",
          buttonSizeClasses[size]
        )}
        disabled={disabled || (max != null && value >= max)}
        onPointerDown={handlePointerDown(1)}
      >
        <Plus className="size-4 text-zinc-600 dark:text-zinc-400" absoluteStrokeWidth strokeWidth={3.5} />
      </Button>
    </div>
  );
}
