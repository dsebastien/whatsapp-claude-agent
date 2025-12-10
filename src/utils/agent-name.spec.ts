import { describe, test, expect } from 'bun:test'
import { hostname } from 'os'
import superheroes from 'superheroes'
import {
    getRandomSuperheroName,
    toTitleCase,
    generateDefaultAgentName,
    normalizeAgentName,
    formatMessageWithAgentName
} from './agent-name.ts'

describe('getRandomSuperheroName', () => {
    test('returns a string', () => {
        const name = getRandomSuperheroName()
        expect(typeof name).toBe('string')
    })

    test('returns a non-empty string', () => {
        const name = getRandomSuperheroName()
        expect(name.length).toBeGreaterThan(0)
    })

    test('returns a name from the superheroes list', () => {
        const name = getRandomSuperheroName()
        expect(superheroes).toContain(name)
    })

    test('returns different names on multiple calls (statistical test)', () => {
        // Call 10 times and check that we don't always get the same name
        const names = new Set<string>()
        for (let i = 0; i < 10; i++) {
            names.add(getRandomSuperheroName())
        }
        // With 700+ heroes, getting the same name 10 times in a row is extremely unlikely
        expect(names.size).toBeGreaterThan(1)
    })
})

describe('toTitleCase', () => {
    test('converts lowercase to title case', () => {
        expect(toTitleCase('hello world')).toBe('Hello World')
    })

    test('converts uppercase to title case', () => {
        expect(toTitleCase('HELLO WORLD')).toBe('Hello World')
    })

    test('converts mixed case to title case', () => {
        expect(toTitleCase('hElLo WoRlD')).toBe('Hello World')
    })

    test('replaces dashes with spaces', () => {
        expect(toTitleCase('spider-man')).toBe('Spider Man')
        expect(toTitleCase('my-project-name')).toBe('My Project Name')
    })

    test('replaces underscores with spaces', () => {
        expect(toTitleCase('my_project_name')).toBe('My Project Name')
    })

    test('normalizes multiple spaces', () => {
        expect(toTitleCase('hello   world')).toBe('Hello World')
    })

    test('trims whitespace', () => {
        expect(toTitleCase('  hello world  ')).toBe('Hello World')
    })

    test('handles empty string', () => {
        expect(toTitleCase('')).toBe('')
    })

    test('handles single word', () => {
        expect(toTitleCase('batman')).toBe('Batman')
    })

    test('handles numbers in names', () => {
        expect(toTitleCase('3-d-man')).toBe('3 D Man')
    })
})

describe('generateDefaultAgentName', () => {
    const titleCaseHostname = toTitleCase(hostname())

    test('starts with hostname in Title Case', () => {
        const name = generateDefaultAgentName('/home/user/my-project')
        expect(name).toMatch(new RegExp(`^${titleCaseHostname} `))
    })

    test('includes directory basename in Title Case after hostname', () => {
        const name = generateDefaultAgentName('/home/user/my-project')
        expect(name).toMatch(new RegExp(`^${titleCaseHostname} My Project `))
    })

    test('handles nested directory paths', () => {
        const name = generateDefaultAgentName('/very/deep/nested/path/to/project-name')
        expect(name).toMatch(new RegExp(`^${titleCaseHostname} Project Name `))
    })

    test('converts directory name to Title Case', () => {
        const name = generateDefaultAgentName('/home/user/knowii-voice-ai')
        expect(name).toMatch(new RegExp(`^${titleCaseHostname} Knowii Voice Ai `))
    })

    test('appends a superhero name in Title Case', () => {
        const name = generateDefaultAgentName('/home/user/test')
        // Should have format: "{Hostname} Test {Superhero Name}"
        const parts = name.split(' ')
        expect(parts.length).toBeGreaterThanOrEqual(3)
        // All words should be title cased (first letter uppercase)
        for (const part of parts) {
            expect(part.charAt(0)).toBe(part.charAt(0).toUpperCase())
        }
    })

    test('generates different names on multiple calls', () => {
        const names = new Set<string>()
        for (let i = 0; i < 10; i++) {
            names.add(generateDefaultAgentName('/home/user/project'))
        }
        // Should get some variety in the generated names
        expect(names.size).toBeGreaterThan(1)
    })
})

describe('normalizeAgentName', () => {
    test('returns undefined for undefined input', () => {
        expect(normalizeAgentName(undefined)).toBeUndefined()
    })

    test('returns undefined for empty string', () => {
        expect(normalizeAgentName('')).toBeUndefined()
    })

    test('returns undefined for whitespace-only string', () => {
        expect(normalizeAgentName('   ')).toBeUndefined()
        expect(normalizeAgentName('\t\n')).toBeUndefined()
    })

    test('trims whitespace from valid names', () => {
        expect(normalizeAgentName('  My Agent  ')).toBe('My Agent')
        expect(normalizeAgentName('\tMy Agent\n')).toBe('My Agent')
    })

    test('returns valid names unchanged (after trim)', () => {
        expect(normalizeAgentName('My Agent')).toBe('My Agent')
        expect(normalizeAgentName('Knowii Voice AI Jarvis')).toBe('Knowii Voice AI Jarvis')
    })
})

describe('formatMessageWithAgentName', () => {
    test('formats message with robot emoji and agent name prefix', () => {
        const result = formatMessageWithAgentName('My Agent', 'Hello world')
        expect(result).toBe('[🤖 My Agent] Hello world')
    })

    test('handles empty message', () => {
        const result = formatMessageWithAgentName('My Agent', '')
        expect(result).toBe('[🤖 My Agent] ')
    })

    test('handles multiline messages', () => {
        const result = formatMessageWithAgentName('Agent', 'Line 1\nLine 2\nLine 3')
        expect(result).toBe('[🤖 Agent] Line 1\nLine 2\nLine 3')
    })

    test('handles messages with special characters', () => {
        const result = formatMessageWithAgentName('Bot', 'Code: `console.log()`')
        expect(result).toBe('[🤖 Bot] Code: `console.log()`')
    })

    test('handles agent names with spaces', () => {
        const result = formatMessageWithAgentName('My Project Spider Man', 'Hi!')
        expect(result).toBe('[🤖 My Project Spider Man] Hi!')
    })
})
