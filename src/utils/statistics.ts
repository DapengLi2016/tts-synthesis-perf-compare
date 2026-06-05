import { Statistics } from '../types'
import { TestResult } from './synthesizer'

export function calcStats(arr: TestResult[], key: keyof TestResult): Statistics {
  const values = arr
    .filter(r => r.success && typeof r[key] === 'number')
    .map(r => r[key] as number)
    .sort((a, b) => a - b)

  if (values.length === 0) {
    return { avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 }
  }

  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const p50 = values[Math.floor(values.length * 0.5)]
  const p95 = values[Math.floor(values.length * 0.95)]
  const p99 = values[Math.floor(values.length * 0.99)]

  return {
    avg,
    min: values[0],
    max: values[values.length - 1],
    p50,
    p95,
    p99,
  }
}

export function downloadJson(data: object, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadCsv(results: TestResult[], filename: string): void {
  const headers = ['ssmlIndex', 'iteration', 'provenanceEnabled', 'firstByteLatencyMs', 'lastByteLatencyMs', 'totalBytes', 'chunkCount', 'success', 'error', 'timestamp']
  const rows = results.map(r => headers.map(h => (r as any)[h] ?? '').join(','))
  const csv = [headers.join(','), ...rows].join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
