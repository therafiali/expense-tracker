import {
  Utensils,
  Fuel,
  Wrench,
  ShoppingBag,
  BookOpen,
  GraduationCap,
  CircleEllipsis,
  Tag,
  PlusCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  type LucideIcon,
} from 'lucide-react-native';
import type { Category } from '@/lib/types';

/** Matches default color for custom categories in `addCategory`. */
export const FALLBACK_CATEGORY_COLOR = '#8B5CF6';

const BUILTIN_CATEGORY_ICONS: Record<string, LucideIcon> = {
  Food: Utensils,
  Petrol: Fuel,
  Repair: Wrench,
  Shopping: ShoppingBag,
  Course: BookOpen,
  Education: GraduationCap,
  Other: CircleEllipsis,
};

const BUILTIN_CATEGORY_COLORS: Record<string, string> = {
  Food: '#F59E0B',
  Petrol: '#3B82F6',
  Repair: '#6366F1',
  Shopping: '#EC4899',
  Course: '#8B5CF6',
  Education: '#C14EE4',
  Other: '#6B7280',
};

/** Known icons/colors for default categories (custom names resolve via helpers below). */
export const CATEGORY_ICONS = BUILTIN_CATEGORY_ICONS as Record<Category, LucideIcon>;
export const CATEGORY_COLORS = BUILTIN_CATEGORY_COLORS as Record<Category, string>;

export function iconForCategory(category: string): LucideIcon {
  return BUILTIN_CATEGORY_ICONS[category] ?? Tag;
}

export function colorForCategory(category: string): string {
  return BUILTIN_CATEGORY_COLORS[category] ?? FALLBACK_CATEGORY_COLOR;
}

export { PlusCircle, ArrowDownCircle, ArrowUpCircle };
