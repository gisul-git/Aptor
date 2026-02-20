"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface AccordionContextValue {
  value: string[]
  onValueChange: (value: string[]) => void
  type: "single" | "multiple"
}

const AccordionContext = React.createContext<AccordionContextValue | undefined>(undefined)
const AccordionItemContext = React.createContext<{ value: string } | undefined>(undefined)

interface AccordionProps {
  type?: "single" | "multiple"
  defaultValue?: string[]
  value?: string[]
  onValueChange?: (value: string[]) => void
  className?: string
  children: React.ReactNode
}

export function Accordion({
  type = "single",
  defaultValue = [],
  value: controlledValue,
  onValueChange,
  className,
  children,
}: AccordionProps) {
  const [internalValue, setInternalValue] = React.useState<string[]>(defaultValue)
  const value = controlledValue ?? internalValue
  const handleValueChange = onValueChange ?? setInternalValue

  const contextValue = React.useMemo(
    () => ({
      value,
      onValueChange: handleValueChange,
      type,
    }),
    [value, handleValueChange, type]
  )

  return (
    <AccordionContext.Provider value={contextValue}>
      <div className={cn("space-y-2", className)}>{children}</div>
    </AccordionContext.Provider>
  )
}

interface AccordionItemProps {
  value: string
  className?: string
  children: React.ReactNode
}

export function AccordionItem({ value, className, children }: AccordionItemProps) {
  return (
    <AccordionItemContext.Provider value={{ value }}>
      <div className={cn("border rounded-lg", className)}>{children}</div>
    </AccordionItemContext.Provider>
  )
}

interface AccordionTriggerProps {
  className?: string
  children: React.ReactNode
}

export function AccordionTrigger({ className, children }: AccordionTriggerProps) {
  const context = React.useContext(AccordionContext)
  if (!context) throw new Error("AccordionTrigger must be used within Accordion")

  const itemContext = React.useContext(AccordionItemContext)
  if (!itemContext) throw new Error("AccordionTrigger must be used within AccordionItem")

  const isOpen = context.value.includes(itemContext.value)

  const handleClick = () => {
    if (context.type === "single") {
      context.onValueChange(isOpen ? [] : [itemContext.value])
    } else {
      context.onValueChange(
        isOpen
          ? context.value.filter((v) => v !== itemContext.value)
          : [...context.value, itemContext.value]
      )
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full items-center justify-between transition-all [&[data-state=open]>svg]:rotate-180",
        className
      )}
      data-state={isOpen ? "open" : "closed"}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
    </button>
  )
}

interface AccordionContentProps {
  className?: string
  children: React.ReactNode
}

export function AccordionContent({ className, children }: AccordionContentProps) {
  const context = React.useContext(AccordionContext)
  if (!context) throw new Error("AccordionContent must be used within Accordion")

  const itemContext = React.useContext(AccordionItemContext)
  if (!itemContext) throw new Error("AccordionContent must be used within AccordionItem")

  const isOpen = context.value.includes(itemContext.value)

  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-200",
        isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0",
        className
      )}
    >
      {children}
    </div>
  )
}
