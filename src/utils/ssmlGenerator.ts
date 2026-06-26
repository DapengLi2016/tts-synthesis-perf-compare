export interface SsmlData {
  index: number
  ssml: string
  primaryText: string
  secondaryText: string
}

export interface SsmlGeneratorOptions {
  count: number
  voiceName: string
  useMultiVoice?: boolean  // true = 2 voice elements, false = 1 voice element
  backgroundAudioUrl?: string  // optional background audio URL
  inlineAudioUrl?: string  // optional inline audio URL for <audio> tag (plays sequentially)
  bgmSasToken?: string  // SAS token for background audio URL
  inlineAudioSasToken?: string  // SAS token for inline audio URL
}

const TEST_SENTENCES_PRIMARY = [
  "The aurora borealis illuminated the Arctic sky with ribbons of green and purple light dancing across the horizon.",
  "Quantum entanglement challenges our understanding of locality and information transfer in the universe.",
  "The ancient library of Alexandria housed scrolls containing knowledge from civilizations across the Mediterranean world.",
  "Bioluminescent organisms create their own light through chemical reactions in the deepest parts of the ocean.",
  "Renaissance artists developed perspective techniques that revolutionized how we represent three-dimensional space.",
  "The human brain contains approximately eighty-six billion neurons connected by trillions of synapses.",
  "Volcanic islands form over millions of years as tectonic plates shift and magma rises from the mantle.",
  "Jazz musicians improvise complex harmonies and rhythms that evolve spontaneously during live performances.",
  "The migration patterns of monarch butterflies span thousands of miles across multiple generations.",
  "Cryptographic algorithms protect digital communications through mathematical transformations of data.",
  "Traditional Japanese gardens incorporate principles of asymmetry, simplicity, and natural materials.",
  "The Hubble Space Telescope has captured images of galaxies billions of light-years away from Earth.",
  "Fermentation processes transform simple sugars into complex flavors in foods like cheese and sourdough.",
  "The circulatory system pumps approximately five liters of blood through the body every minute.",
  "Gothic architecture features pointed arches, ribbed vaults, and flying buttresses to support tall structures.",
  "Machine learning models identify patterns in datasets that would be impossible for humans to detect manually.",
  "The Great Barrier Reef supports an ecosystem with over fifteen hundred species of fish and coral.",
  "Neuroscientists study how memories form and consolidate during different phases of sleep.",
  "The invention of the printing press democratized access to knowledge and accelerated scientific progress.",
  "Renewable energy sources now provide a growing percentage of global electricity generation.",
  "The architect designed a sustainable building with solar panels integrated into every window surface.",
  "Autonomous vehicles navigate complex urban environments using sensor fusion and real-time decision making.",
  "Blockchain technology enables decentralized record keeping across distributed networks without central authority.",
  "The documentary filmmaker spent three years capturing wildlife behavior in the African savanna.",
  "Precision agriculture uses satellite imagery and sensors to optimize crop yields sustainably.",
  "Geothermal power plants extract heat from underground reservoirs to generate electricity continuously.",
  "The opera singer trained for fifteen years to develop her remarkable vocal range and breath control.",
  "Edge computing reduces latency by processing data closer to where it originates.",
  "The botanical garden houses over three thousand plant species from six continents.",
  "Spectroscopy reveals chemical composition by analyzing how matter interacts with electromagnetic radiation.",
  "Climate scientists monitor ice core samples to understand historical patterns of temperature change.",
  "The symphony orchestra performed a challenging new composition that pushed the boundaries of classical music.",
  "Artificial neural networks can now generate realistic images and text that are difficult to distinguish from human work.",
  "Marine biologists discovered a new species of fish living in the deepest trenches of the Pacific Ocean.",
  "The ancient Egyptians developed sophisticated mathematical techniques to construct the pyramids with remarkable precision.",
  "Solar flares can disrupt satellite communications and power grids across entire continents.",
  "The chef combined traditional techniques with modern molecular gastronomy to create innovative dishes.",
  "Quantum computers leverage superposition and entanglement to solve problems exponentially faster than classical machines.",
  "Archaeological excavations revealed artifacts that changed our understanding of early human civilization.",
  "The rainforest canopy creates a unique microclimate that supports countless species found nowhere else on Earth.",
  "Electric vehicles are becoming increasingly popular as battery technology improves and charging infrastructure expands.",
  "The astronomer discovered a potentially habitable exoplanet orbiting a star in the Goldilocks zone.",
  "Nanotechnology enables engineers to manipulate matter at the atomic scale for medical and industrial applications.",
  "The historian uncovered documents that shed new light on pivotal events in world history.",
  "Ocean currents play a crucial role in regulating global climate and distributing heat around the planet.",
  "The software engineer developed an algorithm that significantly improved the efficiency of data processing.",
  "Paleontologists assembled fossil evidence to reconstruct the appearance and behavior of extinct dinosaurs.",
  "Urban planners are redesigning cities to be more walkable and less dependent on automobiles.",
  "The philosopher argued that consciousness remains one of the greatest unsolved mysteries of science.",
  "Genetic sequencing technology has revolutionized our ability to diagnose and treat inherited diseases.",
]

const TEST_SENTENCES_SECONDARY = [
  "That's a fascinating perspective on the natural world and its complex interactions.",
  "Indeed, the interconnectedness of scientific disciplines continues to amaze researchers worldwide.",
  "The implications for future technologies are truly remarkable when you consider the possibilities.",
  "I couldn't agree more with that assessment of how these systems work together.",
  "This understanding opens new avenues for exploration and innovation in multiple fields.",
  "The elegance of these natural phenomena inspires both artists and scientists alike.",
  "Your observations highlight the importance of continued research in this area.",
  "These discoveries remind us how much we still have to learn about our world.",
  "The collaboration between different scientific fields has led to remarkable breakthroughs.",
  "I find it incredible how nature has evolved such sophisticated solutions to complex problems.",
]

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function generateSsmls(options: SsmlGeneratorOptions | number, voiceName?: string): SsmlData[] {
  // Support legacy call signature: generateSsmls(count, voiceName)
  const opts: SsmlGeneratorOptions = typeof options === 'number'
    ? { count: options, voiceName: voiceName || 'en-US-AvaNeural' }
    : options

  const {
    count,
    voiceName: voice,
    useMultiVoice = true,
    backgroundAudioUrl,
    inlineAudioUrl,
    bgmSasToken,
    inlineAudioSasToken,
  } = opts

  // Helper to append SAS token to blob URL if needed
  const appendSas = (url: string | undefined, sasToken: string | undefined): string | undefined => {
    if (!url) return undefined
    // If URL already has query params, don't append
    if (url.includes('?')) return url
    // If no SAS token provided, return as-is
    if (!sasToken) return url
    // Append SAS token
    return `${url}?${sasToken}`
  }

  const bgmUrlWithSas = appendSas(backgroundAudioUrl, bgmSasToken)
  const inlineUrlWithSas = appendSas(inlineAudioUrl, inlineAudioSasToken)

  // BGM defaults (hardcoded)
  const bgmVolume = 0.3
  const bgmFadeInMs = 2000
  const bgmFadeOutMs = 2000

  const result: SsmlData[] = []

  for (let i = 0; i < count; i++) {
    const primaryText = TEST_SENTENCES_PRIMARY[i % TEST_SENTENCES_PRIMARY.length]
    const secondaryText = TEST_SENTENCES_SECONDARY[i % TEST_SENTENCES_SECONDARY.length]

    // Build background audio element if URL provided
    const bgmElement = bgmUrlWithSas
      ? `<mstts:backgroundaudio src="${escapeXml(bgmUrlWithSas)}" volume="${bgmVolume}" fadein="${bgmFadeInMs}" fadeout="${bgmFadeOutMs}"/>`
      : ''

    // Build inline audio element if URL provided (plays sequentially before speech)
    const inlineAudioElement = inlineUrlWithSas
      ? `<audio src="${escapeXml(inlineUrlWithSas)}"/>`
      : ''

    // Build voice elements based on useMultiVoice setting
    const voiceContent = useMultiVoice
      ? `<voice name="${voice}">${inlineAudioElement}${escapeXml(primaryText)}</voice>
    <voice name="${voice}">${escapeXml(secondaryText)}</voice>`
      : `<voice name="${voice}">${inlineAudioElement}${escapeXml(primaryText)}</voice>`

    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
    ${bgmElement}${bgmElement ? '\n    ' : ''}${voiceContent}
</speak>`

    result.push({
      index: i + 1,
      ssml,
      primaryText,
      secondaryText: useMultiVoice ? secondaryText : '',
    })
  }

  return result
}
