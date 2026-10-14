import React from 'react';
import { StockStatus } from '../../types/inventory';

interface StockStatusBadgeProps {
  status: StockStatus;
  className?: string;
}

export const StockStatusBadge: React.FC<StockStatusBadgeProps> = ({ status, className = '' }) => {
  switch (status) {
    case 'IN STOCK':
      return (
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 ${className}`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
          <span>IN STOCK</span>
        </span>
      );
    case 'LOW STOCK':
      return (
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 ${className}`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse"></span>
          <span>LOW STOCK</span>
        </span>
      );
    case 'OUT OF STOCK':
      return (
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold text-rose-800 ${className}`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
          <span>OUT OF STOCK</span>
        </span>
      );
    default:
      return null;
  }
};
