import { describe, test, expect } from 'bun:test'
import {
    normalizePhone,
    phoneFromJid,
    isWhitelisted,
    normalizeWhitelistEntry,
    extractGroupInviteCode
} from './phone.ts'

describe('phone utils', () => {
    describe('normalizePhone', () => {
        test('removes formatting characters', () => {
            expect(normalizePhone('+1 (234) 567-8901')).toBe('12345678901')
        })

        test('removes leading zeros', () => {
            expect(normalizePhone('001234567890')).toBe('1234567890')
        })
    })

    describe('phoneFromJid', () => {
        test('extracts phone from @s.whatsapp.net JID', () => {
            expect(phoneFromJid('1234567890@s.whatsapp.net')).toBe('1234567890')
        })

        test('extracts ID from @lid JID', () => {
            expect(phoneFromJid('214787086672091@lid')).toBe('214787086672091')
        })

        test('extracts ID from @g.us JID', () => {
            expect(phoneFromJid('123456789-123345@g.us')).toBe('123456789-123345')
        })
    })

    describe('normalizeWhitelistEntry', () => {
        test('normalizes phone number', () => {
            expect(normalizeWhitelistEntry('+1234567890')).toBe('1234567890')
        })

        test('strips @lid suffix', () => {
            expect(normalizeWhitelistEntry('214787086672091@lid')).toBe('214787086672091')
        })

        test('handles lid without suffix', () => {
            expect(normalizeWhitelistEntry('214787086672091')).toBe('214787086672091')
        })

        test('trims whitespace', () => {
            expect(normalizeWhitelistEntry('  214787086672091@lid  ')).toBe('214787086672091')
        })
    })

    describe('isWhitelisted', () => {
        test('matches phone number in whitelist', () => {
            expect(isWhitelisted('1234567890@s.whatsapp.net', ['+1234567890'])).toBe(true)
        })

        test('matches lid in whitelist (without @lid suffix)', () => {
            expect(isWhitelisted('214787086672091@lid', ['214787086672091'])).toBe(true)
        })

        test('matches lid in whitelist (with @lid suffix)', () => {
            expect(isWhitelisted('214787086672091@lid', ['214787086672091@lid'])).toBe(true)
        })

        test('rejects non-whitelisted participant', () => {
            expect(isWhitelisted('999999999@lid', ['214787086672091'])).toBe(false)
        })

        test('handles country code variations', () => {
            // Without country code in whitelist, with in JID
            expect(isWhitelisted('11234567890@s.whatsapp.net', ['1234567890'])).toBe(true)
            // With country code in whitelist, without in JID
            expect(isWhitelisted('1234567890@s.whatsapp.net', ['+11234567890'])).toBe(true)
        })

        test('handles mixed whitelist (phones and lids)', () => {
            const whitelist = ['+1234567890', '214787086672091@lid']
            expect(isWhitelisted('1234567890@s.whatsapp.net', whitelist)).toBe(true)
            expect(isWhitelisted('214787086672091@lid', whitelist)).toBe(true)
            expect(isWhitelisted('999999999@lid', whitelist)).toBe(false)
        })
    })

    describe('extractGroupInviteCode', () => {
        test('extracts code from full URL', () => {
            expect(extractGroupInviteCode('https://chat.whatsapp.com/ABC123xyz')).toBe('ABC123xyz')
        })

        test('returns code as-is if not a URL', () => {
            expect(extractGroupInviteCode('ABC123xyz')).toBe('ABC123xyz')
        })

        test('trims whitespace', () => {
            expect(extractGroupInviteCode('  ABC123xyz  ')).toBe('ABC123xyz')
        })
    })
})
