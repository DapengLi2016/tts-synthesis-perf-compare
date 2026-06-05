export interface LogEntry {
  timestamp: Date
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

export interface Statistics {
  avg: number
  min: number
  max: number
  p50: number
  p95: number
  p99: number
}
