interface ProgressSectionProps {
  progress: number
  currentTest: string
}

export function ProgressSection({ progress, currentTest }: ProgressSectionProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <h2 className="text-xl font-semibold text-blue-600 border-b-2 border-blue-600 pb-2 mb-4">⏳ Test Progress</h2>
      <div className="h-6 bg-gray-200 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-center text-gray-600">
        {progress.toFixed(1)}% complete
      </div>
      {currentTest && (
        <div className="text-center text-blue-600 font-mono text-sm mt-2">
          {currentTest}
        </div>
      )}
    </div>
  )
}
