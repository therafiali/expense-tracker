import React from 'react';
import { 
  Utensils, 
  Fuel, 
  Wrench, 
  ShoppingBag, 
  BookOpen, 
  GraduationCap, 
  CircleEllipsis,
  PlusCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  type LucideIcon 
} from 'lucide-react-native';
import { type Category } from '@/lib/storage';

export const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  Food: Utensils,
  Petrol: Fuel,
  Repair: Wrench,
  Shopping: ShoppingBag,
  Course: BookOpen,
  Education: GraduationCap,
  Other: CircleEllipsis,
};

export const CATEGORY_COLORS: Record<Category, string> = {
  Food: '#F59E0B', // Amber
  Petrol: '#3B82F6', // Blue
  Repair: '#6366F1', // Indigo
  Shopping: '#EC4899', // Pink
  Course: '#8B5CF6', // Violet
  Education: '#10B981', // Emerald
  Other: '#6B7280', // Gray
};

export { PlusCircle, ArrowDownCircle, ArrowUpCircle };
