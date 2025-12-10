/**
 * Model shorthand mappings
 * When in doubt, shorthands resolve to the most recent version of each model family
 */
const MODEL_SHORTHANDS: Record<string, string> = {
    // Opus 4.5 variants (most recent Opus)
    'opus-4.5': 'claude-opus-4-5-20251101',
    'opus4.5': 'claude-opus-4-5-20251101',
    'opus-4-5': 'claude-opus-4-5-20251101',
    'opus45': 'claude-opus-4-5-20251101',
    // Sonnet 4.5 variants (most recent Sonnet)
    'sonnet-4.5': 'claude-sonnet-4-5-20250929',
    'sonnet4.5': 'claude-sonnet-4-5-20250929',
    'sonnet-4-5': 'claude-sonnet-4-5-20250929',
    'sonnet45': 'claude-sonnet-4-5-20250929',
    // Opus 4 variants
    'opus-4': 'claude-opus-4-20250514',
    'opus4': 'claude-opus-4-20250514',
    // Sonnet 4 variants
    'sonnet-4': 'claude-sonnet-4-20250514',
    'sonnet4': 'claude-sonnet-4-20250514',
    // Claude 3.5 variants
    'sonnet-3.5': 'claude-3-5-sonnet-20241022',
    'sonnet3.5': 'claude-3-5-sonnet-20241022',
    'sonnet-3-5': 'claude-3-5-sonnet-20241022',
    'sonnet35': 'claude-3-5-sonnet-20241022',
    'haiku-3.5': 'claude-3-5-haiku-20241022',
    'haiku3.5': 'claude-3-5-haiku-20241022',
    'haiku-3-5': 'claude-3-5-haiku-20241022',
    'haiku35': 'claude-3-5-haiku-20241022',
    // Claude 3 variants
    'opus-3': 'claude-3-opus-20240229',
    'opus3': 'claude-3-opus-20240229',
    'haiku-3': 'claude-3-haiku-20240307',
    'haiku3': 'claude-3-haiku-20240307',
    // Simple names -> most recent version of each family
    'opus': 'claude-opus-4-5-20251101', // Most recent Opus
    'sonnet': 'claude-sonnet-4-5-20250929', // Most recent Sonnet
    'haiku': 'claude-3-5-haiku-20241022' // Most recent Haiku
}

/**
 * Available model IDs
 */
export const AVAILABLE_MODELS = [
    'claude-opus-4-5-20251101',
    'claude-sonnet-4-5-20250929',
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307'
]

/**
 * Preferred shorthand for each full model ID (used for display)
 */
const MODEL_PREFERRED_SHORTHANDS: Record<string, string> = {
    'claude-opus-4-5-20251101': 'opus-4-5',
    'claude-sonnet-4-5-20250929': 'sonnet-4-5',
    'claude-sonnet-4-20250514': 'sonnet-4',
    'claude-opus-4-20250514': 'opus-4',
    'claude-3-5-sonnet-20241022': 'sonnet-3-5',
    'claude-3-5-haiku-20241022': 'haiku-3-5',
    'claude-3-opus-20240229': 'opus-3',
    'claude-3-haiku-20240307': 'haiku-3'
}

/**
 * Get the preferred shorthand for a full model ID.
 * Returns the shorthand if found, or undefined if no shorthand exists.
 */
export function getModelShorthand(fullModelId: string): string | undefined {
    return MODEL_PREFERRED_SHORTHANDS[fullModelId]
}

/**
 * Resolve a model shorthand to the full model ID.
 * Supports shorthands like "opus", "sonnet", "haiku", "opus-4.5", "sonnet-4", etc.
 * Returns the full model ID if recognized, or undefined if not recognized.
 * When in doubt, resolves to the most recent version of the model family.
 */
export function resolveModelShorthand(shorthand: string): string | undefined {
    const input = shorthand.toLowerCase().trim()

    // Check for exact shorthand match
    if (MODEL_SHORTHANDS[input]) {
        return MODEL_SHORTHANDS[input]
    }

    // Check if it's already a valid full model ID
    if (AVAILABLE_MODELS.includes(shorthand)) {
        return shorthand
    }

    // No match found - return undefined so the model is not changed
    return undefined
}
