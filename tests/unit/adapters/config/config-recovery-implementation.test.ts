import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigRecovery } from '../../../../src/adapters/config/recovery.js';
import { getDefaultConfig } from '../../../../src/adapters/config/index.js';

describe('ConfigRecovery Implementation', () => {
    const TEST_CONFIG_DIR = path.join(os.tmpdir(), 'todoq-config-recovery-impl-test');
    const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, '.todoqrc');
    
    let consoleSpy: {
        warn: ReturnType<typeof vi.spyOn>;
        error: ReturnType<typeof vi.spyOn>;
        log: ReturnType<typeof vi.spyOn>;
    };

    beforeEach(() => {
        fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
        consoleSpy = {
            warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
            error: vi.spyOn(console, 'error').mockImplementation(() => {}),
            log: vi.spyOn(console, 'log').mockImplementation(() => {}),
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
        if (fs.existsSync(TEST_CONFIG_DIR)) {
            fs.rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
        }
    });

    describe('createBackup', () => {
        it('should create a timestamped backup file', () => {
            const testContent = '{ "database": { "path": ".todoq/test.db" } }';
            fs.writeFileSync(TEST_CONFIG_PATH, testContent);
            
            const backupPath = ConfigRecovery.createBackup(TEST_CONFIG_PATH);
            
            expect(backupPath).toMatch(/\.todoqrc\.backup\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
            expect(fs.existsSync(backupPath)).toBe(true);
            expect(fs.readFileSync(backupPath, 'utf-8')).toBe(testContent);
            expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Config backup created'));
        });

        it('should handle non-existent config file gracefully', () => {
            const backupPath = ConfigRecovery.createBackup('/nonexistent/config');
            expect(backupPath).toBe('');
        });
    });

    describe('attemptRecovery', () => {
        it('should recover from trailing comma errors', async () => {
            const corruptConfig = `{
                "database": {
                    "path": ".todoq/test.db",
                },
                "claude": {
                    "enabled": true,
                },
            }`;
            
            fs.writeFileSync(TEST_CONFIG_PATH, corruptConfig);
            
            const error = new Error('Trailing comma in JSON');
            const recovered = await ConfigRecovery.attemptRecovery(TEST_CONFIG_PATH, error);
            
            expect(recovered).toBeDefined();
            expect(recovered?.database.path).toBe('.todoq/test.db');
            expect(recovered?.claude?.enabled).toBe(true);
            expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Fixed trailing commas'));
        });

        it('should recover from single quote errors', async () => {
            const corruptConfig = `{
                'database': {
                    'path': '.todoq/test.db'
                }
            }`;
            
            fs.writeFileSync(TEST_CONFIG_PATH, corruptConfig);
            
            const error = new Error('Single quotes in JSON');
            const recovered = await ConfigRecovery.attemptRecovery(TEST_CONFIG_PATH, error);
            
            expect(recovered).toBeDefined();
            expect(recovered?.database.path).toBe('.todoq/test.db');
            expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Converted single quotes'));
        });

        it('should recover from missing braces', async () => {
            const corruptConfig = `{
                "database": {
                    "path": ".todoq/test.db"
                }
                "claude": {
                    "enabled": true
                }`; // Missing closing brace
            
            fs.writeFileSync(TEST_CONFIG_PATH, corruptConfig);
            
            const error = new Error('Missing closing brace');
            const recovered = await ConfigRecovery.attemptRecovery(TEST_CONFIG_PATH, error);
            
            expect(recovered).toBeDefined();
            // The recovery might not preserve the exact value due to reconstruction
            expect(recovered?.database.path).toBeDefined();
            expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Reconstructed config'));
        });

        it('should handle completely unrecoverable content', async () => {
            fs.writeFileSync(TEST_CONFIG_PATH, 'this is not json at all');
            
            const error = new Error('Invalid JSON');
            const recovered = await ConfigRecovery.attemptRecovery(TEST_CONFIG_PATH, error);
            
            expect(recovered).toBeDefined();
            // Should return defaults for unrecoverable content
            expect(recovered?.database.path).toBe(getDefaultConfig().database.path);
            expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Using default configuration'));
        });

        it('should handle missing config file', async () => {
            const error = new Error('File not found');
            const recovered = await ConfigRecovery.attemptRecovery('/nonexistent/config', error);
            
            expect(recovered).toBeDefined();
            expect(recovered?.database.path).toBe(getDefaultConfig().database.path);
            expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Config file not found'));
        });

        it('should create backup before recovery', async () => {
            const testContent = '{ invalid json';
            fs.writeFileSync(TEST_CONFIG_PATH, testContent);
            
            const error = new Error('Invalid JSON');
            await ConfigRecovery.attemptRecovery(TEST_CONFIG_PATH, error);
            
            const backupFiles = fs.readdirSync(TEST_CONFIG_DIR).filter(f => f.includes('.backup.'));
            expect(backupFiles).toHaveLength(1);
        });
    });

    describe('validateAndNormalize', () => {
        it('should fill in missing required fields', () => {
            const partial = {
                claude: {
                    enabled: true
                }
                // Missing database
            };
            
            const normalized = ConfigRecovery.validateAndNormalize(partial);
            
            expect(normalized.database).toBeDefined();
            expect(normalized.database.path).toBe(getDefaultConfig().database.path);
            expect(normalized.claude?.enabled).toBe(true);
        });

        it('should coerce string numbers to actual numbers', () => {
            const partial = {
                claude: {
                    maxIterations: "15" as any,
                    timeout: "1500000" as any,
                    retryDelay: "1000" as any
                }
            };
            
            const normalized = ConfigRecovery.validateAndNormalize(partial);
            
            expect(normalized.claude?.maxIterations).toBe(15);
            expect(normalized.claude?.timeout).toBe(1500000);
            expect(normalized.claude?.retryDelay).toBe(1000);
            expect(typeof normalized.claude?.maxIterations).toBe('number');
        });

        it('should enforce minimum and maximum values', () => {
            const partial = {
                claude: {
                    maxIterations: -5,     // Below minimum
                    timeout: 4000000,      // Above maximum
                    retryDelay: -100       // Below minimum
                }
            };
            
            const normalized = ConfigRecovery.validateAndNormalize(partial);
            
            expect(normalized.claude?.maxIterations).toBe(1);        // Minimum enforced
            expect(normalized.claude?.timeout).toBe(3600000);        // Maximum enforced
            expect(normalized.claude?.retryDelay).toBe(0);           // Minimum enforced
            
            expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('below minimum'));
            expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('above maximum'));
        });

        it('should coerce boolean strings', () => {
            const partial = {
                claude: {
                    enabled: "true" as any,
                    verbose: "false" as any,
                    dangerouslySkipPermissions: "yes" as any,
                    continueSession: "no" as any
                }
            };
            
            const normalized = ConfigRecovery.validateAndNormalize(partial);
            
            expect(normalized.claude?.enabled).toBe(true);
            expect(normalized.claude?.verbose).toBe(false);
            expect(normalized.claude?.dangerouslySkipPermissions).toBe(true);
            expect(normalized.claude?.continueSession).toBe(false);
        });

        it('should validate enum values', () => {
            const partial = {
                claude: {
                    model: "invalid-model" as any,
                    outputFormat: "invalid-format" as any
                },
                display: {
                    format: "invalid-display" as any
                }
            };
            
            const normalized = ConfigRecovery.validateAndNormalize(partial);
            
            expect(normalized.claude?.model).toBe('opusplan');        // Default fallback
            expect(normalized.claude?.outputFormat).toBe('stream-json'); // Default fallback
            expect(normalized.display.format).toBe('tree');           // Default fallback
            
            expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid enum value'));
        });

        it('should filter invalid array elements', () => {
            const partial = {
                claude: {
                    allowedTools: ['Read', 123, 'Write', null, 'Edit'] as any,
                    customArgs: ['--flag', 456, '--other', undefined] as any
                }
            };
            
            const normalized = ConfigRecovery.validateAndNormalize(partial);
            
            expect(normalized.claude?.allowedTools).toEqual(['Read', 'Write', 'Edit']);
            expect(normalized.claude?.customArgs).toEqual(['--flag', '--other']);
        });

        it('should handle null and undefined values appropriately', () => {
            const partial = {
                database: {
                    path: null as any,
                    autoMigrate: undefined as any
                }
            };
            
            const normalized = ConfigRecovery.validateAndNormalize(partial);
            const defaults = getDefaultConfig();
            
            expect(normalized.database.path).toBe(defaults.database.path);
            expect(normalized.database.autoMigrate).toBe(defaults.database.autoMigrate);
        });
    });

    describe('applyEnvironmentOverrides', () => {
        const originalEnv = { ...process.env };

        afterEach(() => {
            process.env = originalEnv;
        });

        it('should apply database path override from environment', () => {
            process.env.TODOQ_DB_PATH = '.todoq/env-override.db';
            
            const config = getDefaultConfig();
            const overridden = ConfigRecovery.applyEnvironmentOverrides(config);
            
            expect(overridden.database.path).toBe('.todoq/env-override.db');
        });

        it('should apply Claude configuration overrides from environment', () => {
            process.env.TODOQ_CLAUDE_ENABLED = 'true';
            process.env.TODOQ_CLAUDE_MAX_ITERATIONS = '25';
            process.env.TODOQ_CLAUDE_TIMEOUT = '600000';
            process.env.TODOQ_CLAUDE_MODEL = 'opus';
            
            const config = getDefaultConfig();
            const overridden = ConfigRecovery.applyEnvironmentOverrides(config);
            
            expect(overridden.claude?.enabled).toBe(true);
            expect(overridden.claude?.maxIterations).toBe(25);
            expect(overridden.claude?.timeout).toBe(900000);
            expect(overridden.claude?.model).toBe('opus');
        });

        it('should handle invalid environment variable values', () => {
            process.env.TODOQ_CLAUDE_MAX_ITERATIONS = 'not-a-number';
            process.env.TODOQ_CLAUDE_MODEL = 'invalid-model';
            
            const config = getDefaultConfig();
            const overridden = ConfigRecovery.applyEnvironmentOverrides(config);
            
            // Should fallback to original values when env var is invalid
            expect(overridden.claude?.maxIterations).toBe(config.claude?.maxIterations);
            expect(overridden.claude?.model).toBe(config.claude?.model);
            
            expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid number'));
            expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid enum value'));
        });

        it('should create claude config object if it doesn\'t exist', () => {
            process.env.TODOQ_CLAUDE_ENABLED = 'true';
            
            const config = {
                ...getDefaultConfig(),
                claude: undefined
            };
            
            const overridden = ConfigRecovery.applyEnvironmentOverrides(config);
            
            expect(overridden.claude).toBeDefined();
            expect(overridden.claude?.enabled).toBe(true);
        });

        it('should validate environment variable ranges', () => {
            process.env.TODOQ_CLAUDE_MAX_ITERATIONS = '100';  // Above max
            process.env.TODOQ_CLAUDE_TIMEOUT = '50000';       // Below min
            
            const config = getDefaultConfig();
            const overridden = ConfigRecovery.applyEnvironmentOverrides(config);
            
            expect(overridden.claude?.maxIterations).toBe(50);    // Capped at max
            expect(overridden.claude?.timeout).toBe(900000);       // Raised to min
            
            expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('above maximum'));
            expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('below minimum'));
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty config file', async () => {
            fs.writeFileSync(TEST_CONFIG_PATH, '');
            
            const error = new Error('Empty file');
            const recovered = await ConfigRecovery.attemptRecovery(TEST_CONFIG_PATH, error);
            
            expect(recovered).toBeDefined();
            expect(recovered?.database.path).toBe(getDefaultConfig().database.path);
        });

        it('should handle config with only whitespace', async () => {
            fs.writeFileSync(TEST_CONFIG_PATH, '   \n\t   ');
            
            const error = new Error('Only whitespace');
            const recovered = await ConfigRecovery.attemptRecovery(TEST_CONFIG_PATH, error);
            
            expect(recovered).toBeDefined();
        });

        it('should handle config with comments', async () => {
            const configWithComments = `{
                // This is a comment
                "database": {
                    "path": ".todoq/test.db" // Another comment
                },
                /* Multi-line
                   comment */
                "claude": {
                    "enabled": true
                }
            }`;
            
            fs.writeFileSync(TEST_CONFIG_PATH, configWithComments);
            
            const error = new Error('Comments not allowed in JSON');
            const recovered = await ConfigRecovery.attemptRecovery(TEST_CONFIG_PATH, error);
            
            expect(recovered).toBeDefined();
            expect(recovered?.database.path).toBe('.todoq/test.db');
            expect(recovered?.claude?.enabled).toBe(true);
            expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('relaxed JSON parsing'));
        });

        it('should handle recovery with createBackup disabled', async () => {
            fs.writeFileSync(TEST_CONFIG_PATH, '{ invalid');
            
            const error = new Error('Invalid JSON');
            const recovered = await ConfigRecovery.attemptRecovery(TEST_CONFIG_PATH, error, {
                createBackup: false
            });
            
            expect(recovered).toBeDefined();
            
            // Should not have created backup
            const backupFiles = fs.readdirSync(TEST_CONFIG_DIR).filter(f => f.includes('.backup.'));
            expect(backupFiles).toHaveLength(0);
        });

        it('should handle recovery with logging disabled', async () => {
            fs.writeFileSync(TEST_CONFIG_PATH, '{ "database": { "path": ".todoq/test.db", } }');
            
            const error = new Error('Trailing comma');
            await ConfigRecovery.attemptRecovery(TEST_CONFIG_PATH, error, {
                logRecovery: false
            });
            
            // Should not have logged recovery messages
            expect(consoleSpy.warn).not.toHaveBeenCalled();
            expect(consoleSpy.log).not.toHaveBeenCalled();
        });
    });
});