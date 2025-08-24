import { describe, it, expect, beforeEach } from 'vitest';
import { getDefaultConfig, validateConfig, ConfigManager } from '../../../src/adapters/config/index.js';

describe('Config Utilities', () => {
    describe('getDefaultConfig', () => {
        it('should return valid default configuration', () => {
            const config = getDefaultConfig();

            expect(config.database.path).toBeDefined();
            expect(config.database.autoMigrate).toBe(true);
            expect(config.database.walMode).toBe(true);

            expect(config.display.format).toBe('tree');
            expect(config.display.colors).toBe(true);
            expect(config.display.showCompleted).toBe(false);

            expect(config.defaults.status).toBe('pending');
            expect(config.defaults.priority).toBe(0);
        });

        it('should return database path in working directory', () => {
            const config = getDefaultConfig();

            expect(config.database.path).toContain('.todoq');
            expect(config.database.path).toContain('todoq.db');
        });
    });

    describe('validateConfig', () => {
        it('should validate correct configuration', () => {
            const validConfig = {
                database: {
                    path: '/path/to/db.sqlite',
                    autoMigrate: true,
                    walMode: true
                },
                display: {
                    format: 'tree' as const,
                    colors: true,
                    showCompleted: false
                },
                defaults: {
                    status: 'pending' as const,
                    priority: 0
                }
            };

            expect(validateConfig(validConfig)).toBe(true);
        });

        it('should reject invalid configuration', () => {
            expect(validateConfig(null)).toBe(false);
            expect(validateConfig({})).toBe(false);
            expect(validateConfig('string' as any)).toBe(false);
            expect(validateConfig(123 as any)).toBe(false);
        });

        it('should reject config with invalid database section', () => {
            const invalidConfig = {
                database: {
                    path: 123, // should be string
                    autoMigrate: 'yes', // should be boolean
                    walMode: true
                },
                display: {
                    format: 'tree' as const,
                    colors: true,
                    showCompleted: false
                },
                defaults: {
                    status: 'pending' as const,
                    priority: 0
                }
            };

            expect(validateConfig(invalidConfig)).toBe(false);
        });

        it('should reject config with invalid display format', () => {
            const invalidConfig = {
                database: {
                    path: '/path/to/db.sqlite',
                    autoMigrate: true,
                    walMode: true
                },
                display: {
                    format: 'invalid' as any,
                    colors: true,
                    showCompleted: false
                },
                defaults: {
                    status: 'pending' as const,
                    priority: 0
                }
            };

            expect(validateConfig(invalidConfig)).toBe(false);
        });

        it('should reject config with invalid status', () => {
            const invalidConfig = {
                database: {
                    path: '/path/to/db.sqlite',
                    autoMigrate: true,
                    walMode: true
                },
                display: {
                    format: 'tree' as const,
                    colors: true,
                    showCompleted: false
                },
                defaults: {
                    status: 'invalid' as any,
                    priority: 0
                }
            };

            expect(validateConfig(invalidConfig)).toBe(false);
        });
    });
});

describe('ConfigManager', () => {
    let configManager: ConfigManager;
    const testConfig = getDefaultConfig();

    beforeEach(() => {
        configManager = new ConfigManager(testConfig);
    });

    describe('get', () => {
        it('should return copy of configuration', () => {
            const config = configManager.get();

            expect(config).toEqual(testConfig);
            expect(config).not.toBe(testConfig); // Should be a copy
        });
    });

    describe('set', () => {
        it('should set nested configuration values', () => {
            configManager.set('database.path', '/new/path/db.sqlite');

            expect(configManager.getDatabasePath()).toBe('/new/path/db.sqlite');
        });

        it('should set top-level configuration values', () => {
            configManager.set('display.format', 'table');

            expect(configManager.getDisplayFormat()).toBe('table');
        });

        it('should create nested objects if they do not exist', () => {
            configManager.set('newSection.newKey', 'newValue');

            expect(configManager.getKey('newSection.newKey')).toBe('newValue');
        });
    });

    describe('getKey', () => {
        it('should retrieve nested configuration values', () => {
            expect(configManager.getKey('database.path')).toBe(testConfig.database.path);
            expect(configManager.getKey('display.format')).toBe(testConfig.display.format);
            expect(configManager.getKey('defaults.status')).toBe(testConfig.defaults.status);
        });

        it('should return undefined for non-existent keys', () => {
            expect(configManager.getKey('nonexistent')).toBeUndefined();
            expect(configManager.getKey('database.nonexistent')).toBeUndefined();
            expect(configManager.getKey('nonexistent.nested.key')).toBeUndefined();
        });
    });

    describe('convenience methods', () => {
        it('should return database path', () => {
            expect(configManager.getDatabasePath()).toBe(testConfig.database.path);
        });

        it('should return auto-migrate setting', () => {
            expect(configManager.shouldAutoMigrate()).toBe(testConfig.database.autoMigrate);
        });

        it('should return display format', () => {
            expect(configManager.getDisplayFormat()).toBe(testConfig.display.format);
        });

        it('should return colors setting', () => {
            expect(configManager.shouldShowColors()).toBe(testConfig.display.colors);
        });

        it('should return show completed setting', () => {
            expect(configManager.shouldShowCompleted()).toBe(testConfig.display.showCompleted);
        });

        it('should return default status', () => {
            expect(configManager.getDefaultStatus()).toBe(testConfig.defaults.status);
        });

        it('should return default priority', () => {
            expect(configManager.getDefaultPriority()).toBe(testConfig.defaults.priority);
        });
    });
});