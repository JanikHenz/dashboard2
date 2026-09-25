import * as React from "react"
import { cn } from "cn"
import { Slider as SliderPrimitive } from "radix-ui"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbLabel,
  thumbValueText,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & { thumbLabel?: string; thumbValueText?: string }) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "group/slider relative flex w-full touch-none items-center select-none data-disabled:opacity-40 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-12 data-vertical:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative grow overflow-hidden rounded-full bg-well shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)] data-horizontal:h-1.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-1.5"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute bg-foreground select-none data-horizontal:h-full data-vertical:w-full"
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          aria-label={thumbLabel}
          aria-valuetext={thumbValueText}
          className={cn(
            "relative block shrink-0 rounded-sm border border-input bg-card shadow-[0_2px_0_var(--input),0_6px_14px_-6px_rgb(0_0_0/0.45)] transition-[box-shadow,transform] duration-150 select-none after:absolute after:-inset-3",
            "before:absolute before:inset-x-1.5 before:top-1/2 before:h-0.5 before:-translate-y-1/2 before:rounded-full before:bg-signal",
            "group-data-horizontal/slider:h-10 group-data-horizontal/slider:w-6 group-data-horizontal/slider:before:inset-x-auto group-data-horizontal/slider:before:inset-y-1.5 group-data-horizontal/slider:before:left-1/2 group-data-horizontal/slider:before:top-auto group-data-horizontal/slider:before:h-auto group-data-horizontal/slider:before:w-0.5 group-data-horizontal/slider:before:-translate-x-1/2 group-data-horizontal/slider:before:translate-y-0",
            "group-data-vertical/slider:h-7 group-data-vertical/slider:w-12",
            "hover:shadow-[0_2px_0_var(--input),0_10px_18px_-8px_rgb(0_0_0/0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98] disabled:pointer-events-none"
          )}
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
