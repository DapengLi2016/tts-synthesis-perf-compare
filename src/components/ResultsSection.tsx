import { TestResult } from '../utils/synthesizer'
import { calcStats, downloadJson, downloadCsv } from '../utils/statistics'
import { DetectResult } from '../utils/detect'

interface ResultsSectionProps {
  results: TestResult[]
  autoDetectResults?: Record<string, DetectResult>
}

export function ResultsSection({ results, autoDetectResults = {} }: ResultsSectionProps) {
  const successfulResults = results.filter(r => r.success)
  const baseResults = successfulResults.filter(r => !r.isTargetEndpoint)
  const targetResults = successfulResults.filter(r => r.isTargetEndpoint)

  // Calculate detect statistics
  const detectValues = Object.values(autoDetectResults)
  const detectTotal = detectValues.length
  const detectStats = detectValues.reduce((acc, r) => {
    const status = r.status || 'Unknown'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Categorize detect results
  const detectSuccessStatuses = ['Detected', 'Success', 'SuccessByWatermarkExtraction']
  const detectSuccessCount = detectSuccessStatuses.reduce((sum, s) => sum + (detectStats[s] || 0), 0)
  const detectFailCount = (detectStats['NotDetected'] || 0) + (detectStats['NotFound'] || 0)
  const detectErrorCount = detectStats['Error'] || 0

  const statsBase = {
    firstByte: calcStats(baseResults, 'firstByteLatencyMs'),
    lastByte: calcStats(baseResults, 'lastByteLatencyMs'),
    maxRtf: calcStats(baseResults, 'maxRtf'),
  }

  const statsTarget = {
    firstByte: calcStats(targetResults, 'firstByteLatencyMs'),
    lastByte: calcStats(targetResults, 'lastByteLatencyMs'),
    maxRtf: calcStats(targetResults, 'maxRtf'),
  }

  const deltaFirstByte = statsTarget.firstByte.avg - statsBase.firstByte.avg
  const deltaLastByte = statsTarget.lastByte.avg - statsBase.lastByte.avg
  const pctChange = statsBase.lastByte.avg > 0 ? (deltaLastByte / statsBase.lastByte.avg * 100) : 0

  let impactText: string
  let impactColor: string
  if (Math.abs(pctChange) < 5) {
    impactText = '✅ Minimal (<5%)'
    impactColor = 'text-green-600'
  } else if (Math.abs(pctChange) < 15) {
    impactText = '⚠️ Moderate (5-15%)'
    impactColor = 'text-yellow-600'
  } else {
    impactText = '❌ Significant (>15%)'
    impactColor = 'text-red-600'
  }

  const metrics = [
    { name: 'First Byte Avg', baseVal: statsBase.firstByte.avg, targetVal: statsTarget.firstByte.avg, unit: 'ms' },
    { name: 'First Byte P50', baseVal: statsBase.firstByte.p50, targetVal: statsTarget.firstByte.p50, unit: 'ms' },
    { name: 'First Byte P95', baseVal: statsBase.firstByte.p95, targetVal: statsTarget.firstByte.p95, unit: 'ms' },
    { name: 'First Byte P99', baseVal: statsBase.firstByte.p99, targetVal: statsTarget.firstByte.p99, unit: 'ms' },
    { name: 'First Byte Min', baseVal: statsBase.firstByte.min, targetVal: statsTarget.firstByte.min, unit: 'ms' },
    { name: 'First Byte Max', baseVal: statsBase.firstByte.max, targetVal: statsTarget.firstByte.max, unit: 'ms' },
    { name: 'Last Byte Avg', baseVal: statsBase.lastByte.avg, targetVal: statsTarget.lastByte.avg, unit: 'ms' },
    { name: 'Last Byte P50', baseVal: statsBase.lastByte.p50, targetVal: statsTarget.lastByte.p50, unit: 'ms' },
    { name: 'Last Byte P95', baseVal: statsBase.lastByte.p95, targetVal: statsTarget.lastByte.p95, unit: 'ms' },
    { name: 'Last Byte P99', baseVal: statsBase.lastByte.p99, targetVal: statsTarget.lastByte.p99, unit: 'ms' },
    { name: 'Last Byte Min', baseVal: statsBase.lastByte.min, targetVal: statsTarget.lastByte.min, unit: 'ms' },
    { name: 'Last Byte Max', baseVal: statsBase.lastByte.max, targetVal: statsTarget.lastByte.max, unit: 'ms' },
    { name: 'Max RTF Avg', baseVal: statsBase.maxRtf.avg, targetVal: statsTarget.maxRtf.avg, unit: '' },
    { name: 'Max RTF P50', baseVal: statsBase.maxRtf.p50, targetVal: statsTarget.maxRtf.p50, unit: '' },
    { name: 'Max RTF P95', baseVal: statsBase.maxRtf.p95, targetVal: statsTarget.maxRtf.p95, unit: '' },
    { name: 'Max RTF P99', baseVal: statsBase.maxRtf.p99, targetVal: statsTarget.maxRtf.p99, unit: '' },
    { name: 'Max RTF Max', baseVal: statsBase.maxRtf.max, targetVal: statsTarget.maxRtf.max, unit: '' },
  ]

  const handleDownloadJson = () => {
    const data = {
      metadata: {
        timestamp: new Date().toISOString(),
        totalResults: results.length,
        successfulResults: successfulResults.length,
      },
      summary: {
        base: statsBase,
        target: statsTarget,
        delta: { firstByte: deltaFirstByte, lastByte: deltaLastByte },
        pctChange,
      },
      detect: detectTotal > 0 ? {
        total: detectTotal,
        detected: detectSuccessCount,
        notDetected: detectFailCount,
        error: detectErrorCount,
        detectedRate: detectTotal > 0 ? ((detectSuccessCount / detectTotal) * 100).toFixed(1) + '%' : '0%',
        statusBreakdown: detectStats,
        details: autoDetectResults,
      } : undefined,
      results,
    }
    downloadJson(data, `fe-perf-compare-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  }

  const handleDownloadCsv = () => {
    downloadCsv(results, `fe-perf-compare-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`)
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <h2 className="text-xl font-semibold text-blue-600 border-b-2 border-blue-600 pb-2 mb-4">📊 Results</h2>

      {/* Detect Summary */}
      {detectTotal > 0 && (
        <div className="bg-purple-50 rounded-lg p-4 border-l-4 border-purple-500 mb-6">
          <h3 className="font-semibold text-purple-600 mb-3">🔍 Watermark Detection Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex flex-col">
              <span className="text-gray-500">Total Verified:</span>
              <span className="font-mono font-semibold text-lg">{detectTotal}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500">✅ Detected:</span>
              <span className="font-mono font-semibold text-lg text-green-600">
                {detectSuccessCount} ({detectTotal > 0 ? ((detectSuccessCount / detectTotal) * 100).toFixed(1) : 0}%)
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500">❌ Not Detected:</span>
              <span className="font-mono font-semibold text-lg text-yellow-600">
                {detectFailCount} ({detectTotal > 0 ? ((detectFailCount / detectTotal) * 100).toFixed(1) : 0}%)
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500">⚠️ Error:</span>
              <span className="font-mono font-semibold text-lg text-red-600">
                {detectErrorCount} ({detectTotal > 0 ? ((detectErrorCount / detectTotal) * 100).toFixed(1) : 0}%)
              </span>
            </div>
          </div>
          {Object.keys(detectStats).length > 0 && (
            <div className="mt-3 pt-3 border-t border-purple-200">
              <span className="text-gray-500 text-xs">Status Breakdown: </span>
              <span className="font-mono text-xs">
                {Object.entries(detectStats).map(([status, count]) => 
                  `${status}: ${count}`
                ).join(' | ')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Base */}
        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-gray-500">
          <h3 className="font-semibold text-gray-600 mb-3">🏠 Base FE</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Avg First Byte:</span>
              <span className="font-mono font-semibold">{statsBase.firstByte.avg.toFixed(1)} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Avg Last Byte:</span>
              <span className="font-mono font-semibold">{statsBase.lastByte.avg.toFixed(1)} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Max RTF P95:</span>
              <span className={`font-mono font-semibold ${statsBase.maxRtf.p95 > 0.8 ? 'text-red-600' : 'text-green-600'}`}>
                {statsBase.maxRtf.p95.toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Samples:</span>
              <span className="font-mono font-semibold">{baseResults.length}</span>
            </div>
          </div>
        </div>

        {/* Target */}
        <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
          <h3 className="font-semibold text-blue-600 mb-3">🎯 Target FE</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Avg First Byte:</span>
              <span className="font-mono font-semibold">{statsTarget.firstByte.avg.toFixed(1)} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Avg Last Byte:</span>
              <span className="font-mono font-semibold">{statsTarget.lastByte.avg.toFixed(1)} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Max RTF P95:</span>
              <span className={`font-mono font-semibold ${statsTarget.maxRtf.p95 > 0.8 ? 'text-red-600' : 'text-green-600'}`}>
                {statsTarget.maxRtf.p95.toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Samples:</span>
              <span className="font-mono font-semibold">{targetResults.length}</span>
            </div>
          </div>
        </div>

        {/* Delta */}
        <div className="bg-purple-50 rounded-lg p-4 border-l-4 border-purple-500">
          <h3 className="font-semibold text-purple-600 mb-3">Delta (Target - Base)</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Δ First Byte:</span>
              <span className={`font-mono font-semibold ${deltaFirstByte > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {deltaFirstByte >= 0 ? '+' : ''}{deltaFirstByte.toFixed(1)} ms
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Δ Last Byte:</span>
              <span className={`font-mono font-semibold ${deltaLastByte > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {deltaLastByte >= 0 ? '+' : ''}{deltaLastByte.toFixed(1)} ms
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Impact:</span>
              <span className={`font-semibold ${impactColor}`}>
                {impactText} ({pctChange.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Stats Table */}
      <h3 className="font-semibold text-gray-800 mb-3">📈 Detailed Statistics</h3>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-left border-b">Metric</th>
              <th className="p-2 text-left border-b">🏠 Base</th>
              <th className="p-2 text-left border-b">🎯 Target</th>
              <th className="p-2 text-left border-b">Delta</th>
              <th className="p-2 text-left border-b">% Change</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(m => {
              const delta = m.targetVal - m.baseVal
              const pct = m.baseVal > 0 ? (delta / m.baseVal * 100) : 0
              const unit = m.unit || ''
              const isRtf = m.name.includes('RTF')
              const precision = isRtf ? 3 : 1
              return (
                <tr key={m.name} className="hover:bg-gray-50">
                  <td className="p-2 border-b">{m.name}</td>
                  <td className="p-2 border-b font-mono">{m.baseVal.toFixed(precision)}{unit ? ` ${unit}` : ''}</td>
                  <td className="p-2 border-b font-mono">{m.targetVal.toFixed(precision)}{unit ? ` ${unit}` : ''}</td>
                  <td className={`p-2 border-b font-mono ${delta > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {delta >= 0 ? '+' : ''}{delta.toFixed(precision)}{unit ? ` ${unit}` : ''}
                  </td>
                  <td className={`p-2 border-b font-mono ${Math.abs(pct) > 5 ? 'text-red-600 font-semibold' : 'text-green-600'}`}>
                    {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Download Buttons */}
      <h3 className="font-semibold text-gray-800 mb-3">📋 Raw Results</h3>
      <div className="flex gap-3 mb-4">
        <button
          onClick={handleDownloadJson}
          className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 transition-colors"
        >
          ⬇️ Download JSON
        </button>
        <button
          onClick={handleDownloadCsv}
          className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 transition-colors"
        >
          ⬇️ Download CSV
        </button>
      </div>
      <textarea
        readOnly
        rows={10}
        className="w-full p-3 font-mono text-xs bg-gray-50 border border-gray-300 rounded-md"
        value={JSON.stringify(results, null, 2)}
      />
    </div>
  )
}
