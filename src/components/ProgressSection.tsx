interface ProgressSectionProps {
  progress: number
  currentTest: string
  isVerifying?: boolean
}

export function ProgressSection({ progress, currentTest, isVerifying }: ProgressSectionProps) {
  const title = isVerifying ? '🔍 Verification Progress' : '⏳ Test Progress'
  const gradientClass = isVerifying 
    ? 'bg-gradient-to-r from-purple-600 to-pink-500'
    : 'bg-gradient-to-r from-blue-600 to-cyan-500'
  const titleColor = isVerifying ? 'text-purple-600 border-purple-600' : 'text-blue-600 border-blue-600'
  const textColor = isVerifying ? 'text-purple-600' : 'text-blue-600'

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <h2 className={`text-xl font-semibold ${titleColor} border-b-2 pb-2 mb-4`}>{title}</h2>
      <div className="h-6 bg-gray-200 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full ${gradientClass} transition-all duration-300`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-center text-gray-600">
        {progress.toFixed(1)}% complete
      </div>
      {currentTest && (
        <div className={`text-center ${textColor} font-mono text-sm mt-2`}>
          {currentTest}
        </div>
      )}
    </div>
  )
}
