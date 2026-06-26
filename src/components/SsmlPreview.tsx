import { SsmlData } from '../utils/ssmlGenerator'

interface SsmlPreviewProps {
  ssmls: SsmlData[]
}

export function SsmlPreview({ ssmls }: SsmlPreviewProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <h2 className="text-xl font-semibold text-blue-600 border-b-2 border-blue-600 pb-2 mb-4">📄 Generated SSML Preview</h2>
      <div className="text-gray-600 mb-3">
        {ssmls.length > 0 ? `${ssmls.length} SSMLs generated` : 'No SSMLs generated yet'}
      </div>
      <textarea
        readOnly
        rows={8}
        className="w-full p-3 font-mono text-sm bg-gray-50 border border-gray-300 rounded-md"
        placeholder="Click 'Generate SSMLs' to create test scripts..."
        value={
          ssmls.length > 0
            ? ssmls.slice(0, 3).map((s, i) => `=== SSML ${i + 1} ===\n${s.ssml}`).join('\n\n') + 
              (ssmls.length > 3 ? '\n\n... and more ...' : '')
            : ''
        }
      />
    </div>
  )
}
