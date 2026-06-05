# TTS Provenance Performance Comparison Tool

A web-based tool to measure and compare the latency impact of Provenance watermarking on Azure Text-to-Speech synthesis.

## Features

- **WebSocket-based synthesis** using Azure Speech SDK (JavaScript)
- **Compare latency with/without Provenance** watermarking (`X-Microsoft-Provenance-Enabled` header)
- **Flexible endpoint configuration**:
  - Azure regions (eastus, westus, etc.)
  - Custom endpoints (local TTS Frontend for development)
- **Multi-segment SSML testing**: Each SSML contains 2 voice segments with the same voice
- **Comprehensive metrics**:
  - First byte latency
  - Last byte latency
  - P50, P95, P99 percentiles
  - Min/Max values
- **Statistical analysis**: Calculates delta and percentage impact
- **Export results**: JSON and CSV download

## Usage

### Quick Start

1. Open `index.html` in a modern browser (Chrome, Edge, Firefox)
2. Enter your Azure Speech subscription key
3. Select region or enter custom endpoint
4. Click "Generate SSMLs" to create test scripts
5. Click "Start Performance Test"
6. View results and download reports

### Custom Endpoint (Local Development)

To test against a local TTS Frontend:

1. Select "Custom Endpoint" from the dropdown
2. Enter WebSocket endpoint: `ws://localhost:12345/cognitiveservices/websocket/v1`
3. Use any valid subscription key format

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| Endpoint Type | Azure Region or Custom | Azure Region |
| Region | Azure region for TTS service | East US |
| Subscription Key | Azure Speech subscription key | - |
| Voice Name | Neural voice to use | en-US-AvaNeural |
| Output Format | Audio output format | RIFF 24kHz 16bit PCM |
| SSML Count | Number of unique SSMLs to generate | 50 |
| Iterations | Times to run each SSML | 1 |

## Test Methodology

1. **Generate unique SSMLs**: Creates N unique two-segment SSMLs to avoid TTS caching
2. **Sequential comparison**: For each SSML:
   - Synthesize WITHOUT Provenance (`X-Microsoft-Provenance-Enabled: false`)
   - Synthesize WITH Provenance (`X-Microsoft-Provenance-Enabled: true`)
3. **Track latencies**:
   - First byte latency: Time from request to first audio chunk
   - Last byte latency: Time from request to synthesis completion
4. **Calculate statistics**: Average, P50, P95, P99, Min, Max, Delta

## Metrics Explained

| Metric | Description |
|--------|-------------|
| First Byte Latency | Time until first audio chunk is received (TTFB) |
| Last Byte Latency | Total synthesis time until completion |
| Delta | Difference between Provenance ON and OFF (ON - OFF) |
| Impact % | Percentage increase in latency due to Provenance |

### Impact Assessment

| Impact | Range | Interpretation |
|--------|-------|----------------|
| ✅ Minimal | < 5% | Provenance overhead is negligible |
| ⚠️ Moderate | 5-15% | Provenance adds noticeable but acceptable overhead |
| ❌ Significant | > 15% | Provenance has substantial latency impact |

## Output Formats

The tool supports various audio output formats:

| Format | Description |
|--------|-------------|
| `raw-24khz-16bit-mono-pcm` | Raw PCM, 24kHz, 16-bit |
| `riff-24khz-16bit-mono-pcm` | WAV format, 24kHz, 16-bit |
| `audio-24khz-96kbitrate-mono-mp3` | MP3, 24kHz, 96kbps |
| `audio-24khz-160kbitrate-mono-mp3` | MP3, 24kHz, 160kbps |
| `riff-16khz-16bit-mono-pcm` | WAV format, 16kHz, 16-bit |
| `riff-48khz-16bit-mono-pcm` | WAV format, 48kHz, 16-bit |
| `audio-48khz-96kbitrate-mono-mp3` | MP3, 48kHz, 96kbps |
| `audio-48khz-192kbitrate-mono-mp3` | MP3, 48kHz, 192kbps |

## Export Options

- **JSON**: Complete test results with metadata
- **CSV**: Tabular format for spreadsheet analysis

## Browser Requirements

- Modern browser with ES6+ support
- WebSocket support
- Internet access (for Azure Speech SDK CDN and Azure TTS service)

## Development

The tool uses vanilla JavaScript with no build step required. Simply serve the files with any HTTP server:

```bash
# Python 3
python -m http.server 8080

# Node.js (with serve)
npx serve

# VS Code Live Server extension
# Right-click index.html -> Open with Live Server
```

## Related Tools

- **k6 HTTP Tests**: See `VideoTranslationSamples/Provenance/k6-perf-test/` for load testing via HTTP
- **.NET SDK Tests**: See `VideoTranslationSamples/Provenance/ApiTest/` for .NET-based testing

## Notes

- The Azure Speech SDK uses a proprietary binary WebSocket protocol
- Standard WebSocket clients cannot connect to the TTS WebSocket endpoint
- Always use the Speech SDK for WebSocket-based synthesis
- HTTP endpoint (`/cognitiveservices/v1`) can be tested with standard HTTP clients

## License

Internal Microsoft tool for TTS team.
