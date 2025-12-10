import { basename } from 'path'
import { hostname } from 'os'
import { randomSuperhero } from 'superheroes'

/**
 * Get a random superhero name from the superheroes package
 */
export function getRandomSuperheroName(): string {
    return randomSuperhero()
}

/**
 * Convert a string to Title Case
 * Example: "my-project-name" -> "My Project Name"
 * Example: "spider-man" -> "Spider Man"
 */
export function toTitleCase(str: string): string {
    return str
        .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
        .replace(/\s+/g, ' ') // Normalize multiple spaces
        .trim()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
}

/**
 * Generate a default agent name based on the hostname, directory name, and a random superhero
 * Format: "Hostname Directory Name Superhero" (Title Case)
 * Example: "Mypc My Project Spider Man", "Server01 Knowii Voice AI Jarvis"
 */
export function generateDefaultAgentName(directory: string): string {
    const host = hostname()
    const dirName = basename(directory)
    const superhero = getRandomSuperheroName()
    // Convert all parts to title case and combine
    const titleCaseHost = toTitleCase(host)
    const titleCaseDirName = toTitleCase(dirName)
    const titleCaseSuperhero = toTitleCase(superhero)
    return `${titleCaseHost} ${titleCaseDirName} ${titleCaseSuperhero}`
}

/**
 * Validate and normalize an agent name
 * - Trims whitespace
 * - Returns the name if valid, undefined if empty
 */
export function normalizeAgentName(name: string | undefined): string | undefined {
    if (!name) return undefined
    const trimmed = name.trim()
    return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Format a message with the agent name prefix
 * Format: "[robot emoji AgentName] message"
 */
export function formatMessageWithAgentName(agentName: string, message: string): string {
    return `[🤖 ${agentName}] ${message}`
}
