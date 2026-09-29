import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export const COLORS = {
  bg: '#0E1117',
  card: '#1B1F2B',
  accent: '#00D4AA',
  accent2: '#7B61FF',
  accent3: '#FF6B6B',
  text: '#FAFAFA',
  muted: '#8B8FA3',
  positive: '#00D4AA',
  negative: '#FF6B6B',
  neutral: '#FFD93D',
};

export const CHART_COLORS = [
  '#00D4AA', '#7B61FF', '#FF6B6B', '#FFD93D', '#54A0FF',
  '#FF9F43', '#A29BFE', '#FD79A8', '#00B894', '#E17055'
];

export const SEGMENT_COLORS = {
  'HIGH Risk + HIGH Exposure': '#FF6B6B',
  'HIGH Risk + LOW Exposure': '#FF9F43',
  'LOW Risk + HIGH Exposure': '#54A0FF',
  'LOW Risk + LOW Exposure': '#00D4AA',
};