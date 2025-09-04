import { cosmiconfigSync } from 'cosmiconfig';
import path from 'path';
import os from 'os';
import { TodoqConfig, TodoqError } from '../../core/types.js';

export function getDefaultConfig(): TodoqConfig {
    return {
        database: {
            path: path.join(process.cwd(), '.todoq', 'todoq.db'),
            autoMigrate: true,
            walMode: true
        },
        display: {
            format: 'tree',
            colors: true,
            showCompleted: false
        },
        defaults: {
            status: 'pending',
            priority: 0
        },
        claude: {
            enabled: false,
            maxIterations: 3,
            timeout: 180000, // 3 minutes
            model: 'sonnet-4',
            verbose: false,
            streaming: false,
            allowedTools: ['Read', 'Edit', 'Bash', 'Grep', 'WebFetch', 'WebSearch', 'TodoWrite'],
            customArgs: []
        }
    };
}

export async function loadConfig(configPath?: string): Promise<TodoqConfig> {
    const explorer = cosmiconfigSync('todoq', {
        searchPlaces: [
            '.todoqrc',
            '.todoqrc.json',
            '.todoqrc.js',
            'todoq.config.js',
            'todoq.config.json',
            'package.json'
        ],
        stopDir: os.homedir()
    });

    try {
        const result = configPath 
            ? explorer.load(configPath)
            : explorer.search();

        const config = result?.config || {};
        
        // Deep merge with defaults
        return deepMerge(getDefaultConfig(), config);
    } catch (error) {
        throw new TodoqError(
            `Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'CONFIG_LOAD_ERROR',
            { configPath, error }
        );
    }
}

export function validateConfig(config: any): config is TodoqConfig {
    if (!config || typeof config !== 'object') {
        return false;
    }

    // Basic validation - could be enhanced with Zod
    const hasValidDatabase = !!(config.database && 
        typeof config.database.path === 'string' &&
        typeof config.database.autoMigrate === 'boolean' &&
        typeof config.database.walMode === 'boolean');

    const hasValidDisplay = !!(config.display &&
        ['tree', 'list', 'table'].includes(config.display.format) &&
        typeof config.display.colors === 'boolean' &&
        typeof config.display.showCompleted === 'boolean');

    const hasValidDefaults = !!(config.defaults &&
        ['pending', 'in_progress', 'completed', 'cancelled'].includes(config.defaults.status) &&
        typeof config.defaults.priority === 'number');

    // Claude config is optional, but if present, validate it
    const hasValidClaude = !config.claude || (
        typeof config.claude === 'object' &&
        typeof config.claude.enabled === 'boolean' &&
        (!config.claude.claudePath || typeof config.claude.claudePath === 'string') &&
        (!config.claude.maxIterations || (typeof config.claude.maxIterations === 'number' && config.claude.maxIterations > 0)) &&
        (!config.claude.timeout || (typeof config.claude.timeout === 'number' && config.claude.timeout > 0)) &&
        (!config.claude.model || typeof config.claude.model === 'string') &&
        (!config.claude.verbose || typeof config.claude.verbose === 'boolean') &&
        (!config.claude.streaming || typeof config.claude.streaming === 'boolean') &&
        (!config.claude.allowedTools || Array.isArray(config.claude.allowedTools)) &&
        (!config.claude.customArgs || Array.isArray(config.claude.customArgs))
    );

    return hasValidDatabase && hasValidDisplay && hasValidDefaults && hasValidClaude;
}

function deepMerge(target: any, source: any): any {
    if (!source || typeof source !== 'object') {
        return target;
    }

    const result = { ...target };

    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
    }

    return result;
}

export class ConfigManager {
    private config: TodoqConfig;

    constructor(config: TodoqConfig) {
        this.config = config;
    }

    public get(): TodoqConfig {
        return { ...this.config };
    }

    public set(key: string, value: any): void {
        const keys = key.split('.');
        let current = this.config as any;

        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!current[k] || typeof current[k] !== 'object') {
                current[k] = {};
            }
            current = current[k];
        }

        current[keys[keys.length - 1]] = value;
    }

    public getKey(key: string): any {
        const keys = key.split('.');
        let current = this.config as any;

        for (const k of keys) {
            if (current && typeof current === 'object' && k in current) {
                current = current[k];
            } else {
                return undefined;
            }
        }

        return current;
    }

    public getDatabasePath(): string {
        return this.config.database.path;
    }

    public shouldAutoMigrate(): boolean {
        return this.config.database.autoMigrate;
    }

    public getDisplayFormat(): 'tree' | 'list' | 'table' {
        return this.config.display.format;
    }

    public shouldShowColors(): boolean {
        return this.config.display.colors;
    }

    public shouldShowCompleted(): boolean {
        return this.config.display.showCompleted;
    }

    public getDefaultStatus(): 'pending' | 'in_progress' | 'completed' | 'cancelled' {
        return this.config.defaults.status;
    }

    public getDefaultPriority(): number {
        return this.config.defaults.priority;
    }

    // Claude configuration methods
    public getClaudeConfig(): NonNullable<TodoqConfig['claude']> {
        return this.config.claude || {
            enabled: false,
            maxIterations: 3,
            timeout: 180000,
            model: 'sonnet-4',
            verbose: false,
            streaming: false,
            allowedTools: ['Read', 'Edit', 'Bash', 'Grep', 'WebFetch', 'WebSearch', 'TodoWrite'],
            customArgs: []
        };
    }

    public isClaudeEnabled(): boolean {
        return this.config.claude?.enabled || false;
    }

    public getClaudePath(): string | undefined {
        return this.config.claude?.claudePath;
    }

    public getClaudeMaxIterations(): number {
        return this.config.claude?.maxIterations || 3;
    }

    public getClaudeTimeout(): number {
        return this.config.claude?.timeout || 180000;
    }

    public getClaudeModel(): string {
        return this.config.claude?.model || 'sonnet-4';
    }

    public isClaudeVerbose(): boolean {
        return this.config.claude?.verbose || false;
    }

    public isClaudeStreaming(): boolean {
        return this.config.claude?.streaming || false;
    }

    public getClaudeAllowedTools(): string[] {
        return this.config.claude?.allowedTools || ['Read', 'Edit', 'Bash', 'Grep', 'WebFetch', 'WebSearch', 'TodoWrite'];
    }

    public getClaudeCustomArgs(): string[] {
        return this.config.claude?.customArgs || [];
    }
}