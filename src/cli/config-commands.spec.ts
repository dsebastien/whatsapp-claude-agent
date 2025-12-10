import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Test utilities - we'll test the underlying functions rather than CLI parsing
import {
    loadConfigFile,
    saveConfigFile,
    getLocalConfigPath,
    generateConfigTemplate
} from './config.ts'
import type { Config } from '../types.ts'

describe('config file utilities', () => {
    let testDir: string

    beforeEach(() => {
        // Create a unique temp directory for each test
        testDir = join(
            tmpdir(),
            `whatsapp-claude-agent-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
        )
        mkdirSync(testDir, { recursive: true })
    })

    afterEach(() => {
        // Clean up test directory
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true })
        }
    })

    describe('getLocalConfigPath', () => {
        test('returns .whatsapp-claude-agent.json in specified directory', () => {
            const path = getLocalConfigPath('/some/path')
            expect(path).toBe('/some/path/.whatsapp-claude-agent.json')
        })

        test('returns .whatsapp-claude-agent.json in cwd when no directory specified', () => {
            const path = getLocalConfigPath()
            expect(path).toEndWith('/.whatsapp-claude-agent.json')
        })
    })

    describe('generateConfigTemplate', () => {
        test('generates valid JSON with whitelist', () => {
            const template = generateConfigTemplate(['+1234567890'])
            const parsed = JSON.parse(template)

            expect(parsed.whitelist).toEqual(['+1234567890'])
            expect(parsed.mode).toBe('default')
            expect(parsed.model).toBe('sonnet')
            expect(parsed.verbose).toBe(false)
        })

        test('handles multiple phone numbers', () => {
            const template = generateConfigTemplate(['+111', '+222', '+333'])
            const parsed = JSON.parse(template)

            expect(parsed.whitelist).toEqual(['+111', '+222', '+333'])
        })
    })

    describe('loadConfigFile', () => {
        test('returns empty object when file does not exist', () => {
            const result = loadConfigFile(join(testDir, 'nonexistent.json'))
            expect(result).toEqual({})
        })

        test('loads valid config file', () => {
            const configPath = join(testDir, 'config.json')
            const config = { whitelist: ['+123'], model: 'opus' }
            writeFileSync(configPath, JSON.stringify(config))

            const result = loadConfigFile(configPath)
            expect(result).toEqual(config)
        })

        test('returns empty object for invalid JSON', () => {
            const configPath = join(testDir, 'config.json')
            writeFileSync(configPath, 'not valid json {{{')

            const result = loadConfigFile(configPath)
            expect(result).toEqual({})
        })
    })

    describe('saveConfigFile', () => {
        test('saves config to specified path', () => {
            const configPath = join(testDir, 'config.json')
            const config: Config = {
                whitelist: ['+1234567890'],
                directory: testDir,
                mode: 'default',
                sessionPath: '/tmp/session',
                model: 'claude-sonnet-4-20250514',
                processMissed: true,
                missedThresholdMins: 60,
                verbose: false,
                forkSession: false,
                agentName: 'Test Agent',
                agentIdentity: { name: 'Test Agent', host: 'testhost', folder: 'testdir' },
                allowAllGroupParticipants: false
            }

            const savedPath = saveConfigFile(config, configPath)

            expect(savedPath).toBe(configPath)
            expect(existsSync(configPath)).toBe(true)

            const content = JSON.parse(readFileSync(configPath, 'utf-8'))
            expect(content.whitelist).toEqual(['+1234567890'])
            expect(content.model).toBe('claude-sonnet-4-20250514')
        })

        test('saves to directory/.whatsapp-claude-agent.json when no path specified', () => {
            const config: Config = {
                whitelist: ['+1234567890'],
                directory: testDir,
                mode: 'default',
                sessionPath: '/tmp/session',
                model: 'claude-sonnet-4-20250514',
                processMissed: true,
                missedThresholdMins: 60,
                verbose: false,
                forkSession: false,
                agentName: 'Test Agent',
                agentIdentity: { name: 'Test Agent', host: 'testhost', folder: 'testdir' },
                allowAllGroupParticipants: false
            }

            const savedPath = saveConfigFile(config)

            expect(savedPath).toBe(join(testDir, '.whatsapp-claude-agent.json'))
            expect(existsSync(savedPath)).toBe(true)
        })

        test('creates parent directories if needed', () => {
            const nestedPath = join(testDir, 'deep', 'nested', 'config.json')
            const config: Config = {
                whitelist: ['+1234567890'],
                directory: testDir,
                mode: 'default',
                sessionPath: '/tmp/session',
                model: 'claude-sonnet-4-20250514',
                processMissed: true,
                missedThresholdMins: 60,
                verbose: false,
                forkSession: false,
                agentName: 'Test Agent',
                agentIdentity: { name: 'Test Agent', host: 'testhost', folder: 'testdir' },
                allowAllGroupParticipants: false
            }

            saveConfigFile(config, nestedPath)

            expect(existsSync(nestedPath)).toBe(true)
        })

        test('excludes runtime-only properties', () => {
            const configPath = join(testDir, 'config.json')
            const config: Config = {
                whitelist: ['+1234567890'],
                directory: testDir,
                mode: 'default',
                sessionPath: '/tmp/session',
                model: 'claude-sonnet-4-20250514',
                processMissed: true,
                missedThresholdMins: 60,
                verbose: false,
                forkSession: true, // runtime-only
                resumeSessionId: 'some-session-id', // runtime-only
                agentName: 'Test Agent',
                agentIdentity: { name: 'Test Agent', host: 'testhost', folder: 'testdir' },
                allowAllGroupParticipants: true // runtime-only
            }

            saveConfigFile(config, configPath)

            const content = JSON.parse(readFileSync(configPath, 'utf-8'))
            expect(content.forkSession).toBeUndefined()
            expect(content.resumeSessionId).toBeUndefined()
            expect(content.allowAllGroupParticipants).toBeUndefined()
        })

        test('formats JSON with indentation', () => {
            const configPath = join(testDir, 'config.json')
            const config: Config = {
                whitelist: ['+1234567890'],
                directory: testDir,
                mode: 'default',
                sessionPath: '/tmp/session',
                model: 'claude-sonnet-4-20250514',
                processMissed: true,
                missedThresholdMins: 60,
                verbose: false,
                forkSession: false,
                agentName: 'Test Agent',
                agentIdentity: { name: 'Test Agent', host: 'testhost', folder: 'testdir' },
                allowAllGroupParticipants: false
            }

            saveConfigFile(config, configPath)

            const content = readFileSync(configPath, 'utf-8')
            expect(content).toContain('\n')
            expect(content).toContain('    ') // 4-space indentation
        })
    })
})

describe('config value parsing', () => {
    // Test the value parsing logic used in config set command

    test('parses comma-separated values as arrays', () => {
        const input = '+111,+222,+333'
        const result = input.split(',').map((s) => s.trim())
        expect(result).toEqual(['+111', '+222', '+333'])
    })

    test('parses JSON array syntax', () => {
        const input = '["+111", "+222"]'
        const result = JSON.parse(input)
        expect(result).toEqual(['+111', '+222'])
    })

    test('parses boolean strings', () => {
        const parseBoolean = (val: string) => val === 'true' || val === '1'
        expect(parseBoolean('true')).toBe(true)
        expect(parseBoolean('false')).toBe(false)
        expect(parseBoolean('1')).toBe(true)
        expect(parseBoolean('0')).toBe(false)
    })

    test('parses integer strings', () => {
        expect(parseInt('60', 10)).toBe(60)
        expect(parseInt('100', 10)).toBe(100)
    })
})

describe('config commands integration', () => {
    let testDir: string
    let configPath: string

    beforeEach(() => {
        testDir = join(
            tmpdir(),
            `whatsapp-claude-agent-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
        )
        mkdirSync(testDir, { recursive: true })
        configPath = join(testDir, 'config.json')
    })

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true })
        }
    })

    test('full workflow: init, set, get, unset', () => {
        // Init
        const template = generateConfigTemplate(['+1234567890'])
        writeFileSync(configPath, template)

        // Verify init
        let config = loadConfigFile(configPath)
        expect(config.whitelist).toEqual(['+1234567890'])

        // Set a value
        config.model = 'opus'
        writeFileSync(configPath, JSON.stringify(config, null, 4))

        // Get the value
        config = loadConfigFile(configPath)
        expect(config.model).toBe('opus')

        // Unset a value
        delete config.model
        writeFileSync(configPath, JSON.stringify(config, null, 4))

        // Verify unset
        config = loadConfigFile(configPath)
        expect(config.model).toBeUndefined()
    })

    test('import with merge', () => {
        // Create initial config
        const initial = { whitelist: ['+111'], model: 'sonnet', verbose: false }
        writeFileSync(configPath, JSON.stringify(initial))

        // Import with merge
        const imported = { model: 'opus', verbose: true }
        const existing = loadConfigFile(configPath)
        const merged = { ...existing, ...imported }
        writeFileSync(configPath, JSON.stringify(merged, null, 4))

        // Verify merge
        const result = loadConfigFile(configPath)
        expect(result.whitelist).toEqual(['+111']) // preserved
        expect(result.model).toBe('opus') // updated
        expect(result.verbose).toBe(true) // updated
    })

    test('import without merge (replace)', () => {
        // Create initial config
        const initial = { whitelist: ['+111'], model: 'sonnet', verbose: false }
        writeFileSync(configPath, JSON.stringify(initial))

        // Import without merge (replace)
        const imported = { whitelist: ['+999'], model: 'opus' }
        writeFileSync(configPath, JSON.stringify(imported, null, 4))

        // Verify replace
        const result = loadConfigFile(configPath)
        expect(result.whitelist).toEqual(['+999'])
        expect(result.model).toBe('opus')
        expect(result.verbose).toBeUndefined() // not in imported
    })

    test('export produces valid JSON', () => {
        const config = { whitelist: ['+123'], model: 'haiku', verbose: true }
        writeFileSync(configPath, JSON.stringify(config, null, 4))

        const exported = loadConfigFile(configPath)
        const jsonString = JSON.stringify(exported, null, 2)

        // Should be valid JSON
        const reparsed = JSON.parse(jsonString)
        expect(reparsed).toEqual(config)
    })
})
