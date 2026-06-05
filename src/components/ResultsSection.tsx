import { TestResult } from '../utils/synthesizer'
import { calcStats, downloadJson, downloadCsv } from '../utils/statistics'

interface ResultsSectionProps {
  results: TestResult[]
}

export function ResultsSection({ results }: ResultsSectionProps) {
  const successfulResults = results.filter(r => r.success)
  const provOffResults = successfulResults.filter(r => !r.provenanceEnabled)
  const provOnResults = successfulResults.filter(r => r.provenanceEnabled)

  const statsOff = {
    firstByte: calcStats(provOffResults, 'firstByteLatencyMs'),
    lastByte: calcStats(provOffResults, 'lastByteLatencyMs'),
  }

  const statsOn = {
    firstByte: calcStats(provOnResults, 'firstByteLatencyMs'),
    lastByte: calcStats(provOnResults, 'lastByteLatencyMs'),
  }

  const deltaFirstByte = statsOn.firstByte.avg - statsOff.firstByte.avg
  const deltaLastByte = statsOn.lastByte.avg - statsOff.lastByte.avg
  const pctChange = statsOff.lastByte.avg > 0 ? (deltaLastByte / statsOff.lastByte.avg * 100) : 0

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
    { name: 'First Byte Avg', offVal: statsOff.firstByte.avg, onVal: statsOn.firstByte.avg },
    { name: 'First Byte P50', offVal: statsOff.firstByte.p50, onVal: statsOn.firstByte.p50 },
    { name: 'First Byte P95', offVal: statsOff.firstByte.p95, onVal: statsOn.firstByte.p95 },
    { name: 'First Byte P99', offVal: statsOff.firstByte.p99, onVal: statsOn.firstByte.p99 },
    { name: 'First Byte Min', offVal: statsOff.firstByte.min, onVal: statsOn.firstByte.min },
    { name: 'First Byte Max', offVal: statsOff.firstByte.max, onVal: statsOn.firstByte.max },
    { name: 'Last Byte Avg', offVal: statsOff.lastByte.avg, onVal: statsOn.lastByte.avg },
    { name: 'Last Byte P50', offVal: statsOff.lastByte.p50, onVal: statsOn.lastByte.p50 },
    { name: 'Last Byte P95', offVal: statsOff.lastByte.p95, onVal: statsOn.lastByte.p95 },
    { name: 'Last Byte P99', offVal: statsOff.lastByte.p99, onVal: statsOn.lastByte.p99 },
    { name: 'Last Byte Min', offVal: statsOff.lastByte.min, onVal: statsOn.lastByte.min },
    { name: 'Last Byte Max', offVal: statsOff.lastByte.max, onVal: statsOn.lastByte.max },
  ]

  const handleDownloadJson = () => {
    const data = {
      metadata: {
        timestamp: new Date().toISOString(),
        totalResults: results.length,
        successfulResults: successfulResults.length,
      },
      summary: {
        provOff: statsOff,
        provOn: statsOn,
        delta: { firstByte: deltaFirstByte, lastByte: deltaLastByte },
        pctChange,
      },
      results,
    }
    downloadJson(data, `provenance-perf-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  }

  const handleDownloadCsv = () => {
    downloadCsv(results, `provenance-perf-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`)
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <h2 className="text-xl font-semibold text-blue-600 border-b-2 border-blue-600 pb-2 mb-4">📊 Results</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Prov OFF */}
        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-gray-500">
          <h3 className="font-semibold text-gray-600 mb-3">Without Provenance</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Avg First Byte:</span>
              <span className="font-mono font-semibold">{statsOff.firstByte.avg.toFixed(1)} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Avg Last Byte:</span>
              <span className="font-mono font-semibold">{statsOff.lastByte.avg.toFixed(1)} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Samples:</span>
              <span className="font-mono font-semibold">{provOffResults.length}</span>
            </div>
          </div>
        </div>

        {/* Prov ON */}
        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-gray-500">
          <h3 className="font-semibold text-gray-600 mb-3">With Provenance</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Avg First Byte:</span>
              <span className="font-mono font-semibold">{statsOn.firstByte.avg.toFixed(1)} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Avg Last Byte:</span>
              <span className="font-mono font-semibold">{statsOn.lastByte.avg.toFixed(1)} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Samples:</span>
              <span className="font-mono font-semibold">{provOnResults.length}</span>
            </div>
          </div>
        </div>

        {/* Delta */}
        <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
          <h3 className="font-semibold text-blue-600 mb-3">Delta (ON - OFF)</h3>
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
              <th className="p-2 text-left border-b">Prov OFF</th>
              <th className="p-2 text-left border-b">Prov ON</th>
              <th className="p-2 text-left border-b">Delta</th>
              <th className="p-2 text-left border-b">% Change</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(m => {
              const delta = m.onVal - m.offVal
              const pct = m.offVal > 0 ? (delta / m.offVal * 100) : 0
              return (
                <tr key={m.name} className="hover:bg-gray-50">
                  <td className="p-2 border-b">{m.name}</td>
                  <td className="p-2 border-b font-mono">{m.offVal.toFixed(1)} ms</td>
                  <td className="p-2 border-b font-mono">{m.onVal.toFixed(1)} ms</td>
                  <td className={`p-2 border-b font-mono ${delta > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {delta >= 0 ? '+' : ''}{delta.toFixed(1)} ms
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
