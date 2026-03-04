import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`
}

export function formatMemory(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function getDifficultyLabel(level: number): string {
  if (level <= 2) return 'Beginner'
  if (level <= 5) return 'Intermediate'
  if (level <= 7) return 'Advanced'
  return 'Expert'
}

export function getDifficultyColor(level: number): string {
  if (level <= 2) return 'text-green-600 bg-green-100'
  if (level <= 5) return 'text-yellow-600 bg-yellow-100'
  if (level <= 7) return 'text-orange-600 bg-orange-100'
  return 'text-red-600 bg-red-100'
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

export function parseDataFrame(data: any): any[] {
  if (!data) return []
  
  // Handle different DataFrame formats
  if (Array.isArray(data)) {
    return data
  }
  
  if (data.data && Array.isArray(data.data)) {
    return data.data
  }
  
  if (data.rows && Array.isArray(data.rows)) {
    return data.rows
  }
  
  return []
}

export function formatDataFrameColumns(data: any): string[] {
  if (!data) return []
  
  if (data.columns && Array.isArray(data.columns)) {
    return data.columns
  }
  
  if (Array.isArray(data) && data.length > 0) {
    return Object.keys(data[0])
  }
  
  return []
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function isValidPySparkCode(code: string): boolean {
  // Basic validation for PySpark code
  const requiredImports = /from pyspark|import pyspark/
  const sparkContext = /spark\.|sc\./
  
  return requiredImports.test(code) || sparkContext.test(code)
}