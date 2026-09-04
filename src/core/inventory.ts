import type { Inventory, Pattern } from './types';
import { summarizeUsage } from './engine';

export type InventoryShortage = { code: string; need: number; stock: number; shortage: number };
export type InventorySettlement = {
  ok: boolean;
  inventory: Inventory;
  shortages: InventoryShortage[];
  deducted: number;
};

export function deductPatternFromInventory(pattern: Pattern, inventory: Inventory): InventorySettlement {
  const usage = summarizeUsage(pattern.cells);
  const shortages = usage
    .map(({ code, count }) => {
      const stock = Math.max(0, Math.floor(Number(inventory[code]) || 0));
      return { code, need: count, stock, shortage: Math.max(0, count - stock) };
    })
    .filter((row) => row.shortage > 0);

  if (shortages.length) {
    return { ok: false, inventory: { ...inventory }, shortages, deducted: 0 };
  }

  const next = { ...inventory };
  let deducted = 0;
  for (const { code, count } of usage) {
    next[code] = Math.max(0, Math.floor(Number(next[code]) || 0) - count);
    deducted += count;
  }
  return { ok: true, inventory: next, shortages: [], deducted };
}

export function restorePatternToInventory(pattern: Pattern, inventory: Inventory): Inventory {
  const next = { ...inventory };
  for (const { code, count } of summarizeUsage(pattern.cells)) {
    next[code] = Math.max(0, Math.floor(Number(next[code]) || 0)) + count;
  }
  return next;
}
