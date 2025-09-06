import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { Command } from 'commander';
import { registerConfigCommands } from '../../../../src/cli/commands/config.js';
import { TodoqConfig } from '../../../../src/core/types.js';
import * as fs from 'fs';
import * as child_process from 'child_process';
import path from 'path';
import { setupSubcommand, setupAllCommands, addGlobalOptions } from './test-helpers.js';

// Mock modules
vi.mock('fs');
vi.mock('child_process');
vi.mock('chalk', () => ({
    default: {
        red: (text: string) => text,
        green: (text: string) => text,
        yellow: (text: string) => text,
        blue: (text: string) => text,
        cyan: (text: string) => text,
        white: (text: string) => text,
        bold: (text: string) => text,
        dim: (text: string) => text
    }
}));

vi.mock('inquirer', () => ({
    default: {
        prompt: vi.fn()
    }
}));

vi.mock('../../../../src/adapters/config/index.js', () => ({
    getDefaultConfig: vi.fn(() => ({
        database: {
            path: '~/.todoq/tasks.db'
        },
        display: {
            showFileLinks: true,
            showDependencies: true,
            relativePaths: true,
            compactMode: false
        },
        defaults: {
            priority: 1,
            status: 'pending'
        }
    }))
}));

describe('Config Commands', () => {
    let program: Command;
    let consoleLogSpy: Mock;
    let consoleErrorSpy: Mock;
    const mockFs = fs as any;
    const mockChildProcess = child_process as any;

    beforeEach(() => {
        program = new Command();
        program.exitOverride(); // Prevent process.exit during tests
        
        // Mock console methods
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // Reset mocks
        vi.clearAllMocks();
        
        // Setup default fs mock behaviors
        mockFs.existsSync.mockReturnValue(false);
        mockFs.readFileSync.mockReturnValue('{}');
        mockFs.writeFileSync.mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('config get', () => {
        let config: TodoqConfig;

        beforeEach(() => {
            config = {
                database: { path: '/test/path.db' },
                display: { showFileLinks: true, showDependencies: false, relativePaths: true, compactMode: false },
                defaults: { priority: 2, status: 'pending' }
            };
            
            registerConfigCommands(program);
            addGlobalOptions(program);
            setupSubcommand(program, 'config', 'get', { _config: config });
        });

        it('should get a simple config value', async () => {
            await program.parseAsync(['node', 'test', 'config', 'get', 'database.path']);
            expect(consoleLogSpy).toHaveBeenCalledWith('/test/path.db');
        });

        it('should handle nested config values', async () => {
            await program.parseAsync(['node', 'test', 'config', 'get', 'display.showFileLinks']);
            expect(consoleLogSpy).toHaveBeenCalledWith(true);
        });

        it('should show error for non-existent key', async () => {
            await program.parseAsync(['node', 'test', 'config', 'get', 'nonexistent.key']);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration key "nonexistent.key" not found'));
        });

        it('should output JSON format when requested', async () => {
            await program.parseAsync(['node', 'test', 'config', 'get', 'database.path', '--json']);
            expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ key: 'database.path', value: '/test/path.db' }, null, 2));
        });
    });

    describe('config set', () => {
        beforeEach(() => {
            registerConfigCommands(program);
            addGlobalOptions(program);
            setupSubcommand(program, 'config', 'set', {});
        });

        it('should set a string value', async () => {
            mockFs.existsSync.mockReturnValue(false);

            await program.parseAsync(['node', 'test', 'config', 'set', 'database.path=/new/path.db']);

            expect(mockFs.writeFileSync).toHaveBeenCalled();
            const [filePath, content] = mockFs.writeFileSync.mock.calls[0];
            const writtenConfig = JSON.parse(content);
            expect(writtenConfig.database.path).toBe('/new/path.db');
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Set database.path = /new/path.db'));
        });

        it('should set a boolean value (true)', async () => {
            await program.parseAsync(['node', 'test', 'config', 'set', 'display.showFileLinks=true']);

            const [, content] = mockFs.writeFileSync.mock.calls[0];
            const writtenConfig = JSON.parse(content);
            expect(writtenConfig.display.showFileLinks).toBe(true);
        });

        it('should set a boolean value (false)', async () => {
            await program.parseAsync(['node', 'test', 'config', 'set', 'display.showFileLinks=false']);

            const [, content] = mockFs.writeFileSync.mock.calls[0];
            const writtenConfig = JSON.parse(content);
            expect(writtenConfig.display.showFileLinks).toBe(false);
        });

        it('should set an integer value', async () => {
            await program.parseAsync(['node', 'test', 'config', 'set', 'defaults.priority=5']);

            const [, content] = mockFs.writeFileSync.mock.calls[0];
            const writtenConfig = JSON.parse(content);
            expect(writtenConfig.defaults.priority).toBe(5);
        });

        it('should set a float value', async () => {
            await program.parseAsync(['node', 'test', 'config', 'set', 'some.value=3.14']);

            const [, content] = mockFs.writeFileSync.mock.calls[0];
            const writtenConfig = JSON.parse(content);
            expect(writtenConfig.some.value).toBe(3.14);
        });

        it('should handle values with equals signs', async () => {
            await program.parseAsync(['node', 'test', 'config', 'set', 'some.key=value=with=equals']);

            const [, content] = mockFs.writeFileSync.mock.calls[0];
            const writtenConfig = JSON.parse(content);
            expect(writtenConfig.some.key).toBe('value=with=equals');
        });

        it('should merge with existing config', async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify({
                custom: { field: 'value' }
            }));

            await program.parseAsync(['node', 'test', 'config', 'set', 'database.path=/new/path.db']);

            const [, content] = mockFs.writeFileSync.mock.calls[0];
            const writtenConfig = JSON.parse(content);
            expect(writtenConfig.custom.field).toBe('value');
            expect(writtenConfig.database.path).toBe('/new/path.db');
        });

        it('should show error for invalid format', async () => {
            await program.parseAsync(['node', 'test', 'config', 'set', 'invalidformat']);

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid format. Use: key=value'));
            expect(mockFs.writeFileSync).not.toHaveBeenCalled();
        });
    });

    describe('config list', () => {
        let config: TodoqConfig;
        
        beforeEach(() => {
            config = {
                database: { path: '/test/path.db' },
                display: { showFileLinks: true, showDependencies: false, relativePaths: true, compactMode: false },
                defaults: { priority: 2, status: 'pending' }
            };
            
            registerConfigCommands(program);
            addGlobalOptions(program);
            setupSubcommand(program, 'config', 'list', { _config: config });
            setupSubcommand(program, 'config', 'show', { _config: config });
        });

        it('should display all configuration', async () => {

            await program.parseAsync(['node', 'test', 'config', 'list']);

            expect(consoleLogSpy).toHaveBeenCalledWith('TodoQ Configuration:');
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Database:'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Display:'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Defaults:'));
        });

        it('should display Claude config when present', async () => {
            // Add claude config
            config.claude = { enabled: true, model: 'sonnet' };
            setupSubcommand(program, 'config', 'list', { _config: config });
            
            await program.parseAsync(['node', 'test', 'config', 'list']);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Claude:'));
        });

        it('should output JSON format when requested', async () => {

            await program.parseAsync(['node', 'test', 'config', 'list', '--json']);

            expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(config, null, 2));
        });

        it('should work with show alias', async () => {

            await program.parseAsync(['node', 'test', 'config', 'show']);

            expect(consoleLogSpy).toHaveBeenCalledWith('TodoQ Configuration:');
        });
    });

    describe('config edit', () => {
        beforeEach(() => {
            registerConfigCommands(program);
            addGlobalOptions(program);
            setupSubcommand(program, 'config', 'edit', {});
        });

        it('should open existing config file in editor', async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockChildProcess.execSync.mockImplementation(() => {});
            process.env.EDITOR = 'nano';

            await program.parseAsync(['node', 'test', 'config', 'edit']);

            expect(mockChildProcess.execSync).toHaveBeenCalledWith(
                expect.stringContaining('nano'),
                expect.objectContaining({ stdio: 'inherit' })
            );
        });

        it('should create config file if it does not exist', async () => {
            mockFs.existsSync.mockReturnValue(false);
            mockChildProcess.execSync.mockImplementation(() => {});

            await program.parseAsync(['node', 'test', 'config', 'edit']);

            expect(mockFs.writeFileSync).toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Created config file:'));
            expect(mockChildProcess.execSync).toHaveBeenCalled();
        });

        it('should use VISUAL env variable if EDITOR is not set', async () => {
            delete process.env.EDITOR;
            process.env.VISUAL = 'emacs';
            mockChildProcess.execSync.mockImplementation(() => {});

            await program.parseAsync(['node', 'test', 'config', 'edit']);

            expect(mockChildProcess.execSync).toHaveBeenCalledWith(
                expect.stringContaining('emacs'),
                expect.anything()
            );
        });

        it('should fallback to vim if no editor env variables are set', async () => {
            delete process.env.EDITOR;
            delete process.env.VISUAL;
            mockChildProcess.execSync.mockImplementation(() => {});

            await program.parseAsync(['node', 'test', 'config', 'edit']);

            expect(mockChildProcess.execSync).toHaveBeenCalledWith(
                expect.stringContaining('vim'),
                expect.anything()
            );
        });

        it('should handle editor failure gracefully', async () => {
            mockChildProcess.execSync.mockImplementation(() => {
                throw new Error('Editor failed');
            });

            await program.parseAsync(['node', 'test', 'config', 'edit']);

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to open editor. Try setting EDITOR environment variable.')
            );
        });
    });

    describe('config reset', () => {
        let inquirerMock: any;

        beforeEach(async () => {
            registerConfigCommands(program);
            addGlobalOptions(program);
            setupSubcommand(program, 'config', 'reset', {});
            inquirerMock = await import('inquirer');
        });

        it('should reset config with force flag', async () => {
            await program.parseAsync(['node', 'test', 'config', 'reset', '--force']);

            expect(mockFs.writeFileSync).toHaveBeenCalled();
            const [, content] = mockFs.writeFileSync.mock.calls[0];
            const writtenConfig = JSON.parse(content);
            expect(writtenConfig).toMatchObject({
                database: { path: '~/.todoq/tasks.db' },
                display: expect.any(Object),
                defaults: expect.any(Object)
            });
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Reset configuration to defaults:'));
        });

        it('should prompt for confirmation without force flag', async () => {
            inquirerMock.default.prompt.mockResolvedValue({ confirmed: true });

            await program.parseAsync(['node', 'test', 'config', 'reset']);

            expect(inquirerMock.default.prompt).toHaveBeenCalledWith([
                expect.objectContaining({
                    type: 'confirm',
                    name: 'confirmed',
                    message: 'Reset configuration to defaults?',
                    default: false
                })
            ]);
            expect(mockFs.writeFileSync).toHaveBeenCalled();
        });

        it('should cancel reset when user declines', async () => {
            inquirerMock.default.prompt.mockResolvedValue({ confirmed: false });

            await program.parseAsync(['node', 'test', 'config', 'reset']);

            expect(inquirerMock.default.prompt).toHaveBeenCalled();
            expect(mockFs.writeFileSync).not.toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith('Cancelled');
        });

        it('should find existing config file for reset', async () => {
            mockFs.existsSync.mockImplementation((path: string) => {
                return path.endsWith('.todoqrc.json');
            });

            await program.parseAsync(['node', 'test', 'config', 'reset', '--force']);

            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('.todoqrc.json'),
                expect.any(String)
            );
        });
    });

    describe('config file discovery', () => {
        beforeEach(() => {
            registerConfigCommands(program);
            addGlobalOptions(program);
            setupSubcommand(program, 'config', 'edit', {});
        });

        it('should find .todoqrc.json first', async () => {
            mockFs.existsSync.mockImplementation((p: string) => {
                return p.endsWith('.todoqrc.json');
            });

            await program.parseAsync(['node', 'test', 'config', 'edit']);

            expect(mockChildProcess.execSync).toHaveBeenCalledWith(
                expect.stringContaining('.todoqrc.json'),
                expect.anything()
            );
        });

        it('should find .todoqrc if .todoqrc.json does not exist', async () => {
            mockFs.existsSync.mockImplementation((p: string) => {
                return p.endsWith('.todoqrc') && !p.endsWith('.json');
            });

            await program.parseAsync(['node', 'test', 'config', 'edit']);

            expect(mockChildProcess.execSync).toHaveBeenCalledWith(
                expect.stringContaining('.todoqrc'),
                expect.anything()
            );
        });

        it('should find todoq.config.json', async () => {
            mockFs.existsSync.mockImplementation((p: string) => {
                return p.endsWith('todoq.config.json');
            });

            await program.parseAsync(['node', 'test', 'config', 'edit']);

            expect(mockChildProcess.execSync).toHaveBeenCalledWith(
                expect.stringContaining('todoq.config.json'),
                expect.anything()
            );
        });

        it('should find todoq.config.js', async () => {
            mockFs.existsSync.mockImplementation((p: string) => {
                return p.endsWith('todoq.config.js');
            });

            await program.parseAsync(['node', 'test', 'config', 'edit']);

            expect(mockChildProcess.execSync).toHaveBeenCalledWith(
                expect.stringContaining('todoq.config.js'),
                expect.anything()
            );
        });
    });
});