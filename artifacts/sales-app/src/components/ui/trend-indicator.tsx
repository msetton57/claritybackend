import React from "react";
import { formatPercent } from "@/lib/format";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";

interface TrendIndicatorProps {
  value: number;
  className?: string;
  inverted?: boolean; // If true, negative is green, positive is red
}

export function TrendIndicator({ value, className, inverted = false }: TrendIndicatorProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isNeutral = value === 0;

  const colorClass = isNeutral
    ? "text-muted-foreground"
    : (isPositive && !inverted) || (isNegative && inverted)
    ? "text-emerald-600 dark:text-emerald-500"
    : "text-destructive";

  return (
    <span className={`inline-flex items-center font-mono font-medium ${colorClass} ${className || ""}`}>
      {isPositive ? (
        <ArrowUpIcon className="mr-1 size-3.5" />
      ) : isNegative ? (
        <ArrowDownIcon className="mr-1 size-3.5" />
      ) : (
        <MinusIcon className="mr-1 size-3.5" />
      )}
      {formatPercent(Math.abs(value))}
    </span>
  );
}
