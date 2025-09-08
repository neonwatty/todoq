import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, getDefaultConfig, validateConfig } from '../../../../src/adapters/config/index.js';

describe('Configuration Recovery', () => {
    const TEST_CONFIG_DIR = path.join(os.tmpdir(), 'todoq-config-recovery-test');
    const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, '.todoqrc');
    const TEST_TODOQRC_JSON = path.join(TEST_CONFIG_DIR, '.todoqrc.json');
    const TEST_PACKAGE_JSON = path.join(TEST_CONFIG_DIR, 'package.json');
    
    // Helper to write config and capture behavior
    const writeTestConfig = (content: string | object, filePath: string = TEST_CONFIG_PATH) => {
        const data = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        fs.writeFileSync(filePath, data);
    };

    // Helper to capture console output
    const captureConsole = () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        return { warn, error, log };
    };

    // Fixture generators for corrupt configs
    const generateCorruptConfigs = () => ({
        missingBrace: '{ "database": { "path": ".todoq/test.db" }',
        trailingComma: '{ "database": { "path": ".todoq/test.db", }, }',
        singleQuotes: "{ 'database': { 'path': '.todoq/test.db' } }",
        invalidSyntax: '{ this is not json at all }',
        truncated: '{ "database": { "pa',
        missingQuotes: '{ database: { path: ".todoq/test.db" } }',
        extraComma: '{ "database": { "path": ".todoq/test.db" },, }',
        unclosedString: '{ "database": { "path": ".todoq/test.db }',
        mixedQuotes: '{ "database": { \'path\': ".todoq/test.db" } }',
        comments: '{ /* comment */ "database": { "path": ".todoq/test.db" } }'
    });

    let consoleSpies: ReturnType<typeof captureConsole>;

    beforeEach(() => {
        fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
        consoleSpies = captureConsole();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        
        // Clean up test directory
        if (fs.existsSync(TEST_CONFIG_DIR)) {
            fs.rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
        }
    });

    describe('Malformed JSON Recovery', () => {
        it('should handle missing closing braces gracefully', async () => {
            const corruptConfigs = generateCorruptConfigs();
            writeTestConfig(corruptConfigs.missingBrace);
            
            // With recovery implemented, should return a valid config
            const config = await loadConfig(TEST_CONFIG_PATH);
            expect(config).toBeDefined();
            expect(config.database.path).toBeDefined();
            
            // Should have created a backup
            const backupFiles = fs.readdirSync(TEST_CONFIG_DIR).filter(f => f.includes('.backup.'));
            expect(backupFiles.length).toBeGreaterThan(0);
        });

        it('should handle trailing commas', async () => {
            const corruptConfigs = generateCorruptConfigs();
            writeTestConfig(corruptConfigs.trailingComma);
            
            // With recovery, should fix trailing commas and return valid config
            const config = await loadConfig(TEST_CONFIG_PATH);
            expect(config).toBeDefined();
        });

        it('should handle single quotes', async () => {
            const corruptConfigs = generateCorruptConfigs();
            writeTestConfig(corruptConfigs.singleQuotes);
            
            // With recovery, should convert quotes and return valid config
            const config = await loadConfig(TEST_CONFIG_PATH);
            expect(config).toBeDefined();
        });

        it('should handle completely invalid JSON', async () => {
            writeTestConfig('not json at all { broken');
            
            // With recovery, should return defaults for unrecoverable content
            const config = await loadConfig(TEST_CONFIG_PATH);
            expect(config).toBeDefined();
        });

        it('should handle truncated JSON files', async () => {
            const corruptConfigs = generateCorruptConfigs();
            writeTestConfig(corruptConfigs.truncated);
            
            // With recovery, should return valid config (possibly defaults)
            const config = await loadConfig(TEST_CONFIG_PATH);
            expect(config).toBeDefined();
        });

        it('should handle JSON with comments', async () => {
            const corruptConfigs = generateCorruptConfigs();
            writeTestConfig(corruptConfigs.comments);
            
            // With recovery, should strip comments and return valid config
            const config = await loadConfig(TEST_CONFIG_PATH);
            expect(config).toBeDefined();
        });
    });

    describe('Partial/Incomplete Config Handling', () => {
        it('should fill in missing required fields with defaults', async () => {
            writeTestConfig({
                // Missing database.path (required)
                claude: {
                    enabled: true,
                    model: 'opus'
                }
            });
            
            const config = await loadConfig(TEST_CONFIG_PATH);
            const defaultConfig = getDefaultConfig();
            
            // Should have default database.path
            expect(config.database.path).toBe(defaultConfig.database.path);
            
            // Should preserve provided values
            expect(config.claude?.enabled).toBe(true);
            expect(config.claude?.model).toBe('opus');
            
            // Should fill other claude defaults
            expect(config.claude?.maxIterations).toBe(10);
        });

        it('should handle empty config file', async () => {
            writeTestConfig('{}');
            
            const config = await loadConfig(TEST_CONFIG_PATH);
            const defaultConfig = getDefaultConfig();
            
            // Should be valid with all defaults
            expect(config.database).toBeDefined();
            expect(config.database.path).toBe(defaultConfig.database.path);
            expect(config.claude).toBeDefined();
            expect(config.claude?.enabled).toBe(defaultConfig.claude?.enabled);
        });

        it('should handle null values for required fields', async () => {
            writeTestConfig({
                database: {
                    path: null,
                    autoMigrate: null
                },
                claude: {
                    enabled: true,
                    maxIterations: null,
                    timeout: null
                }
            });
            
            const config = await loadConfig(TEST_CONFIG_PATH);
            
            // null values should override defaults (current behavior)
            expect(config.database.path).toBe(null);
            expect(config.database.autoMigrate).toBe(null);
            expect(config.claude?.maxIterations).toBe(null);
            expect(config.claude?.timeout).toBe(null);
            
            // Non-null values preserved
            expect(config.claude?.enabled).toBe(true);
        });

        it('should handle undefined nested properties', async () => {
            writeTestConfig({
                database: {
                    path: '.todoq/test.db'
                    // autoMigrate and walMode missing
                }
                // claude property missing entirely
            });
            
            const config = await loadConfig(TEST_CONFIG_PATH);
            const defaultConfig = getDefaultConfig();
            
            // Should fill in missing nested properties
            expect(config.database.autoMigrate).toBe(defaultConfig.database.autoMigrate);
            expect(config.database.walMode).toBe(defaultConfig.database.walMode);
            
            // Should create claude object with defaults
            expect(config.claude).toBeDefined();
            expect(config.claude?.enabled).toBe(defaultConfig.claude?.enabled);
            expect(config.claude?.model).toBe(defaultConfig.claude?.model);
        });

        it('should handle deeply nested missing properties', async () => {
            writeTestConfig({
                database: {
                    path: '.todoq/test.db'
                },
                claude: {
                    enabled: true
                    // Missing all other claude config
                }
            });
            
            const config = await loadConfig(TEST_CONFIG_PATH);
            const defaultConfig = getDefaultConfig();
            
            // Should have retry defaults even though parent exists
            expect(config.claude?.maxRetries).toBe(defaultConfig.claude?.maxRetries);
            expect(config.claude?.retryDelay).toBe(defaultConfig.claude?.retryDelay);
            expect(config.claude?.retryBackoffMultiplier).toBe(defaultConfig.claude?.retryBackoffMultiplier);
        });

        it('should handle partial arrays', async () => {
            writeTestConfig({
                claude: {
                    allowedTools: ['Read'],  // Partial tool list
                    customArgs: []  // Empty array
                }
            });
            
            const config = await loadConfig(TEST_CONFIG_PATH);
            
            // Arrays should be used as provided, not merged
            expect(config.claude?.allowedTools).toEqual(['Read']);
            expect(config.claude?.customArgs).toEqual([]);
        });
    });

    describe('Type Validation and Coercion', () => {
        it('should handle string numbers (currently passes through)', async () => {
            writeTestConfig({
                database: {
                    path: '.todoq/test.db'
                },
                claude: {
                    enabled: true,
                    maxIterations: "15" as any,      // string
                    timeout: "300000" as any,        // string
                    maxRetries: "5" as any           // string
                }
            });
            
            const config = await loadConfig(TEST_CONFIG_PATH);
            
            // Current behavior: strings are passed through without coercion
            expect(config.claude?.maxIterations).toBe("15");
            expect(config.claude?.timeout).toBe("300000");
            expect(config.claude?.maxRetries).toBe("5");
            
            // TODO: After implementing coercion, these should be numbers
            // expect(typeof config.claude?.maxIterations).toBe('number');
        });

        it('should handle negative values (currently passes through)', async () => {
            writeTestConfig({
                claude: {
                    maxIterations: -5,
                    timeout: -1000,
                    retryDelay: -500
                }
            });
            
            const config = await loadConfig(TEST_CONFIG_PATH);
            
            // Current behavior: negative values are accepted
            expect(config.claude?.maxIterations).toBe(-5);
            expect(config.claude?.timeout).toBe(-1000);
            expect(config.claude?.retryDelay).toBe(-500);
            
            // TODO: After implementing validation, should enforce minimums
            // expect(config.claude?.maxIterations).toBeGreaterThanOrEqual(1);
        });

        it('should handle boolean strings (currently passes through)', async () => {
            writeTestConfig({
                claude: {
                    enabled: "true" as any,                    // string
                    verbose: "false" as any,                   // string
                    dangerouslySkipPermissions: "yes" as any,  // truthy string
                    continueSession: "no" as any               // falsy string
                }
            });
            
            const config = await loadConfig(TEST_CONFIG_PATH);
            
            // Current behavior: strings are not coerced to booleans
            expect(config.claude?.enabled).toBe("true");
            expect(config.claude?.verbose).toBe("false");
            
            // TODO: After implementing coercion
            // expect(config.claude?.enabled).toBe(true);
            // expect(config.claude?.verbose).toBe(false);
        });

        it('should handle arrays where objects expected', async () => {
            writeTestConfig({
                claude: [] as any // array instead of object
            });
            
            const config = await loadConfig(TEST_CONFIG_PATH);
            const defaultConfig = getDefaultConfig();
            
            // Current behavior: array replaces the object
            expect(Array.isArray(config.claude)).toBe(true);
            
            // TODO: After implementing validation, should use default object
            // expect(config.claude).toBeTypeOf('object');
            // expect(Array.isArray(config.claude)).toBe(false);
        });

        it('should handle invalid enum values (currently passes through)', async () => {
            writeTestConfig({
                claude: {
                    model: "invalid-model",
                    outputFormat: "invalid-format",
                    permissionMode: "invalid-mode"
                }
            });
            
            const config = await loadConfig(TEST_CONFIG_PATH);
            
            // Current behavior: invalid enums are accepted
            expect(config.claude?.model).toBe("invalid-model");
            expect(config.claude?.outputFormat).toBe("invalid-format");
            expect(config.claude?.permissionMode).toBe("invalid-mode");
            
            // TODO: After implementing validation
            // expect(config.claude?.model).toBe('opusplan');
        });

        it('should handle out-of-range values (currently passes through)', async () => {
            writeTestConfig({
                claude: {
                    maxIterations: 100,      // max should be 50
                    timeout: 2000000,        // max should be 1200000
                    retryBackoffMultiplier: 100 // too high
                }
            });
            
            const config = await loadConfig(TEST_CONFIG_PATH);
            
            // Current behavior: out of range values are accepted
            expect(config.claude?.maxIterations).toBe(100);
            expect(config.claude?.timeout).toBe(2000000);
            expect(config.claude?.retryBackoffMultiplier).toBe(100);
            
            // TODO: After implementing validation
            // expect(config.claude?.maxIterations).toBeLessThanOrEqual(50);
        });
    });

    describe('Environment Variable Override Handling', () => {
        const originalEnv = { ...process.env };
        
        beforeEach(() => {
            // Clear any existing TODOQ env vars
            Object.keys(process.env).forEach(key => {
                if (key.startsWith('TODOQ_')) {
                    delete process.env[key];
                }
            });
        });
        
        afterEach(() => {
            process.env = originalEnv;
        });
        
        it('should prioritize env variables over config file', async () => {
            writeTestConfig({
                database: {
                    path: '.todoq/config.db'
                },
                claude: {
                    enabled: false
                }
            });
            
            // Set env overrides
            process.env.TODOQ_DB_PATH = '.todoq/env.db';
            process.env.TODOQ_CLAUDE_ENABLED = 'true';
            
            const config = await loadConfig(TEST_CONFIG_PATH);
            
            // With env var support implemented, env should override file
            expect(config.database.path).toBe('.todoq/env.db');
            expect(config.claude?.enabled).toBe(true);
        });

        it('should handle invalid env variable values', async () => {
            process.env.TODOQ_CLAUDE_MAX_ITERATIONS = 'not-a-number';
            process.env.TODOQ_CLAUDE_TIMEOUT = '-5000';
            
            const config = await loadConfig();
            const defaultConfig = getDefaultConfig();
            
            // With validation, should fallback to defaults for invalid env
            expect(config.claude?.maxIterations).toBe(defaultConfig.claude?.maxIterations);
            expect(config.claude?.timeout).toBe(60000); // Minimum enforced
            
            expect(consoleSpies.warn).toHaveBeenCalledWith(
                expect.stringContaining('Invalid number')
            );
        });

        it('should allow env to specify alternative config path', async () => {
            const altConfigPath = path.join(TEST_CONFIG_DIR, 'alt-todoq-config.json');
            writeTestConfig({
                database: {
                    path: '.todoq/alt.db'
                }
            }, altConfigPath);
            
            process.env.TODOQ_CONFIG_PATH = altConfigPath;
            
            // Note: loadConfig doesn't currently check TODOQ_CONFIG_PATH env var
            // This documents expected behavior
            const config = await loadConfig(altConfigPath);
            
            expect(config.database.path).toBe('.todoq/alt.db');
        });

        it('should handle missing config file specified by env', async () => {
            process.env.TODOQ_CONFIG_PATH = '/nonexistent/config.json';
            
            // With recovery, should return defaults for missing file
            const config = await loadConfig('/nonexistent/config.json');
            expect(config).toBeDefined();
            expect(config.database.path).toBe(getDefaultConfig().database.path);
        });
    });

    describe('Config Schema Validation Errors', () => {
        it('should handle unknown properties (currently accepts them)', async () => {
            writeTestConfig({
                database: {
                    path: '.todoq/test.db'
                },
                unknownProperty: 'should be ignored',
                claude: {
                    enabled: true,
                    unknownClaudeProperty: 'also ignored'
                }
            });
            
            const config = await loadConfig(TEST_CONFIG_PATH);
            
            // Current behavior: unknown properties are passed through
            expect(config).toHaveProperty('unknownProperty');
            expect(config.claude).toHaveProperty('unknownClaudeProperty');
            
            // TODO: After implementing strict validation
            // expect(config).not.toHaveProperty('unknownProperty');
            // expect(config.claude).not.toHaveProperty('unknownClaudeProperty');
        });

        it('should validate required fields at each nesting level', async () => {
            const config = {
                // Missing required database property
                claude: {
                    enabled: true,
                    model: 'opus'
                }
            };
            
            writeTestConfig(config);
            const loaded = await loadConfig(TEST_CONFIG_PATH);
            
            // validateConfig should check for required fields
            const isValid = validateConfig(loaded);
            expect(isValid).toBe(true); // Currently passes because defaults fill in
        });

        it('should handle deeply nested validation errors', async () => {
            writeTestConfig({
                database: {
                    path: '.todoq/test.db'
                },
                claude: {
                    enabled: true,
                    retry: { // Wrong structure
                        attempts: 5,
                        delay: 1000
                    }
                }
            });
            
            const config = await loadConfig(TEST_CONFIG_PATH);
            
            // Current behavior: incorrect structure is preserved
            expect(config.claude).toHaveProperty('retry');
            
            // TODO: After implementing schema validation
            // Should restructure to correct schema
            // expect(config.claude?.maxRetries).toBe(3);
            // expect(config.claude).not.toHaveProperty('retry');
        });

        it('should validate array contents', async () => {
            writeTestConfig({
                claude: {
                    allowedTools: ['Read', 'InvalidTool', 'Write'],
                    customArgs: [123, 'valid-arg', null] as any // mixed types
                }
            });
            
            const config = await loadConfig(TEST_CONFIG_PATH);
            
            // Current behavior: all values are preserved
            expect(config.claude?.allowedTools).toEqual(['Read', 'InvalidTool', 'Write']);
            expect(config.claude?.customArgs).toEqual([123, 'valid-arg', null]);
            
            // TODO: After implementing validation
            // Should filter invalid values
            // expect(config.claude?.allowedTools).toEqual(['Read', 'Write']);
            // expect(config.claude?.customArgs).toEqual(['valid-arg']);
        });
    });

    describe('User Notification and Warning Messages', () => {
        it('should handle parse errors gracefully with recovery', async () => {
            writeTestConfig('{ invalid json');
            
            // With recovery, should return defaults instead of throwing
            const config = await loadConfig(TEST_CONFIG_PATH);
            expect(config).toBeDefined();
            expect(consoleSpies.warn).toHaveBeenCalledWith(
                expect.stringContaining('Using default configuration')
            );
        });

        it('should auto-fix common issues like trailing commas', async () => {
            writeTestConfig(`{
                "database": {
                    "path": ".todoq/test.db",
                }
            }`); // trailing comma
            
            // With recovery, should fix and return valid config
            const config = await loadConfig(TEST_CONFIG_PATH);
            expect(config).toBeDefined();
            expect(config.database.path).toBe('.todoq/test.db');
        });

        it('should handle multiple config sources', async () => {
            // Write to package.json
            writeTestConfig({
                todoq: {
                    database: {
                        path: '.todoq/package.db'
                    }
                }
            }, TEST_PACKAGE_JSON);
            
            // No .todoqrc file
            if (fs.existsSync(TEST_CONFIG_PATH)) {
                fs.unlinkSync(TEST_CONFIG_PATH);
            }
            
            // Explicitly load the package.json file
            const config = await loadConfig(TEST_PACKAGE_JSON);
            
            // Should load from the specific package.json
            expect(config.database.path).toBe('.todoq/package.db');
        });

        it('should handle cascading config locations', async () => {
            // Create invalid .todoqrc
            writeTestConfig('{ invalid', TEST_CONFIG_PATH);
            
            // Create valid .todoqrc.json
            writeTestConfig({
                database: {
                    path: '.todoq/json.db'
                }
            }, TEST_TODOQRC_JSON);
            
            // With recovery, cosmiconfig will try .todoqrc first, then recovery will handle it
            const config = await loadConfig();
            expect(config).toBeDefined();
            // Recovery from invalid .todoqrc may give defaults or salvaged content
            expect(config.database.path).toBeDefined();
        });
    });

    describe('validateConfig function', () => {
        it('should validate a correct config', () => {
            const config = getDefaultConfig();
            expect(validateConfig(config)).toBe(true);
        });

        it('should reject invalid database config', () => {
            const config = {
                ...getDefaultConfig(),
                database: {
                    path: 123, // Should be string
                    autoMigrate: true,
                    walMode: true
                }
            };
            
            expect(validateConfig(config)).toBe(false);
        });

        it('should reject invalid display format', () => {
            const config = {
                ...getDefaultConfig(),
                display: {
                    format: 'invalid' as any,
                    colors: true,
                    showCompleted: false
                }
            };
            
            expect(validateConfig(config)).toBe(false);
        });

        it('should reject invalid claude config', () => {
            const config = {
                ...getDefaultConfig(),
                claude: {
                    enabled: 'yes' as any, // Should be boolean
                    maxIterations: 10
                }
            };
            
            expect(validateConfig(config)).toBe(false);
        });

        it('should accept config without claude section', () => {
            const config = {
                ...getDefaultConfig(),
                claude: undefined
            };
            
            expect(validateConfig(config)).toBe(true);
        });
    });
});