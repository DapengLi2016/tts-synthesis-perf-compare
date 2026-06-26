import { LogEntry } from '../types'

interface LogSectionProps {
  logs: LogEntry[]
  onClear: () => void
}

const LOG_COLORS = {
  info: 'text-blue-300',
  success: 'text-green-400',
  warning: 'text-yellow-300',
  error: 'text-red-400',
}

export function LogSection({ logs, onClear }: LogSectionProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-semibold text-blue-600 border-b-2 border-blue-600 pb-2 mb-4">📜 Log</h2>
      <div className="h-48 overflow-y-auto bg-gray-900 rounded-md p-3 mb-3 font-mono text-sm">
        {logs.length === 0 ? (
          <div className="text-gray-500">No logs yet...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={`py-0.5 border-b border-gray-800 ${LOG_COLORS[log.type]}`}>
              [{log.timestamp.toLocaleTimeString()}] {log.message}
            </div>
          ))
        )}
      </div>
      <button
        onClick={onClear}
        className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
      >
        Clear Log
      </button>
    </div>
  )
}
