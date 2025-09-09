import * as fs from 'fs';
import { TodoqConfig } from '../../core/types.js';
import { getDefaultConfig } from './index.js';

export interface ConfigValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    recoveredConfig?: TodoqConfig;
}

export interface ConfigRecoveryOptions {
    createBackup?: boolean;
    attemptAutoFix?: boolean;
    logRecovery?: boolean;
}

/**
 * Configuration recovery utilities for handling corrupted, invalid, or incomplete config files
 */
export class ConfigRecovery {
    private static readonly BACKUP_SUFFIX = '.backup';
    
    /**
     * Creates a timestamped backup of a config file
     */
    static createBackup(configPath: string, logBackup = true): string {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${configPath}${ConfigRecovery.BACKUP_SUFFIX}.${timestamp}`;
            
            if (fs.existsSync(configPath)) {
                fs.copyFileSync(configPath, backupPath);
                if (logBackup) {
                    console.log(`✓ Config backup created: ${backupPath}`);
                }
                return backupPath;
            }
            
            return '';
        } catch (error) {
            if (logBackup) {
                console.error('Failed to backup config file:', error);
            }
            return '';
        }
    }
    
    /**
     * Attempts to recover from a corrupted config file by trying various parsing strategies
     */
    static async attemptRecovery(
        configPath: string, 
        error: Error,
        options: ConfigRecoveryOptions = {}
    ): Promise<TodoqConfig | null> {
        const { createBackup = true, attemptAutoFix = true, logRecovery = true } = options;
        
        if (logRecovery) {
            console.warn(`⚠️  Config file error: ${error.message}`);
            console.warn(`🔧 Attempting recovery for: ${configPath}`);
        }
        
        // Create backup before attempting recovery
        if (createBackup) {
            ConfigRecovery.createBackup(configPath, logRecovery);
        }
        
        if (!fs.existsSync(configPath)) {
            if (logRecovery) {
                console.warn('Config file not found, using defaults');
            }
            return getDefaultConfig();
        }
        
        if (!attemptAutoFix) {
            return null;
        }
        
        try {
            const content = fs.readFileSync(configPath, 'utf-8');
            const recoveredConfig = ConfigRecovery.salvagePartialConfig(content, options);
            
            if (recoveredConfig) {
                if (logRecovery) {
                    console.log('✓ Partially recovered config from corrupted file');
                }
                return ConfigRecovery.validateAndNormalize(recoveredConfig);
            }
        } catch (recoveryError) {
            if (logRecovery) {
                console.warn('Auto-recovery failed:', recoveryError);
            }
        }
        
        // Complete failure - return defaults
        if (logRecovery) {
            console.warn('⚠️  Using default configuration due to unrecoverable config file');
            console.log('💡 Tip: Check the backup file or run `todoq config validate` for help');
        }
        
        return getDefaultConfig();
    }
    
    /**
     * Tries multiple strategies to salvage a partial config from corrupted content
     */
    private static salvagePartialConfig(
        content: string,
        options?: ConfigRecoveryOptions
    ): Partial<TodoqConfig> | null {
        const strategies = [
            ConfigRecovery.tryOriginalParse,
            (content: string) => ConfigRecovery.fixTrailingCommas(content, options),
            (content: string) => ConfigRecovery.fixQuotes(content, options),
            (content: string) => ConfigRecovery.extractValidLines(content, options),
            (content: string) => ConfigRecovery.tryRelaxedParse(content, options)
        ];
        
        for (const strategy of strategies) {
            try {
                const fixed = strategy(content);
                if (fixed !== null) {
                    const parsed = JSON.parse(fixed);
                    if (parsed && typeof parsed === 'object') {
                        return parsed as Partial<TodoqConfig>;
                    }
                }
            } catch {
                continue; // Try next strategy
            }
        }
        
        return null;
    }
    
    /**
     * Try parsing the content as-is first
     */
    private static tryOriginalParse(content: string): string | null {
        try {
            JSON.parse(content);
            return content;
        } catch {
            return null;
        }
    }
    
    /**
     * Fix common trailing comma issues
     */
    private static fixTrailingCommas(content: string, options?: ConfigRecoveryOptions): string | null {
        const fixed = content
            .replace(/,\s*}/g, '}')           // Remove trailing comma before }
            .replace(/,\s*]/g, ']')           // Remove trailing comma before ]
            .replace(/,(\s*[}\]])/g, '$1');   // Remove trailing comma before } or ]
        
        if (fixed !== content) {
            if (options?.logRecovery !== false) {
                console.log('🔧 Fixed trailing commas in config');
            }
            return fixed;
        }
        
        return null;
    }
    
    /**
     * Convert single quotes to double quotes
     */
    private static fixQuotes(content: string, options?: ConfigRecoveryOptions): string | null {
        // Simple quote conversion (doesn't handle escaped quotes)
        const fixed = content.replace(/'/g, '"');
        
        if (fixed !== content) {
            if (options?.logRecovery !== false) {
                console.log('🔧 Converted single quotes to double quotes');
            }
            return fixed;
        }
        
        return null;
    }
    
    /**
     * Try to extract valid JSON lines and reconstruct
     */
    private static extractValidLines(content: string, options?: ConfigRecoveryOptions): string | null {
        const lines = content.split('\n');
        const validLines: string[] = [];
        let depth = 0;
        let inObject = false;
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
                continue;
            }
            
            // Track nesting depth
            const openBraces = (trimmed.match(/\{/g) || []).length;
            const closeBraces = (trimmed.match(/\}/g) || []).length;
            
            // If it looks like a valid JSON line, include it
            if (trimmed.includes(':') || trimmed.match(/[{}[\]]/)) {
                validLines.push(line);
                depth += openBraces - closeBraces;
                
                if (openBraces > 0) {
                    inObject = true;
                }
            }
        }
        
        // Add missing closing braces
        while (depth > 0) {
            validLines.push('}');
            depth--;
        }
        
        // Add opening brace if we never found one
        if (!inObject && validLines.length > 0) {
            validLines.unshift('{');
        }
        
        const reconstructed = validLines.join('\n');
        
        if (reconstructed !== content) {
            if (options?.logRecovery !== false) {
                console.log('🔧 Reconstructed config from valid lines');
            }
            return reconstructed;
        }
        
        return null;
    }
    
    /**
     * Try more relaxed JSON parsing
     */
    private static tryRelaxedParse(content: string, options?: ConfigRecoveryOptions): string | null {
        // Remove common problematic elements
        const relaxed = content
            .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove /* */ comments
            .replace(/\/\/.*$/gm, '')          // Remove // comments
            .replace(/\b(\w+):/g, '"$1":')     // Quote unquoted keys
            .replace(/:\s*'([^']*)'/g, ': "$1"'); // Convert single-quoted values
        
        if (relaxed !== content) {
            if (options?.logRecovery !== false) {
                console.log('🔧 Applied relaxed JSON parsing');
            }
            return relaxed;
        }
        
        return null;
    }
    
    /**
     * Validates and normalizes a config object, applying defaults and type coercion
     */
    static validateAndNormalize(partialConfig: Partial<TodoqConfig>): TodoqConfig {
        const defaults = getDefaultConfig();
        
        // Deep merge with type validation and coercion
        const config: TodoqConfig = {
            database: {
                path: ConfigRecovery.coerceString(
                    partialConfig.database?.path,
                    defaults.database.path
                ) ?? defaults.database.path,
                autoMigrate: ConfigRecovery.coerceBoolean(
                    partialConfig.database?.autoMigrate,
                    defaults.database.autoMigrate
                ),
                walMode: ConfigRecovery.coerceBoolean(
                    partialConfig.database?.walMode,
                    defaults.database.walMode
                )
            },
            display: {
                format: ConfigRecovery.coerceEnum(
                    partialConfig.display?.format,
                    ['tree', 'list', 'table'] as const,
                    defaults.display.format
                ),
                colors: ConfigRecovery.coerceBoolean(
                    partialConfig.display?.colors,
                    defaults.display.colors
                ),
                showCompleted: ConfigRecovery.coerceBoolean(
                    partialConfig.display?.showCompleted,
                    defaults.display.showCompleted
                )
            },
            defaults: {
                status: ConfigRecovery.coerceEnum(
                    partialConfig.defaults?.status,
                    ['pending', 'in_progress', 'completed', 'cancelled'] as const,
                    defaults.defaults.status
                ),
                priority: ConfigRecovery.coerceNumber(
                    partialConfig.defaults?.priority,
                    defaults.defaults.priority,
                    0, 10
                )
            },
            claude: partialConfig.claude ? {
                enabled: ConfigRecovery.coerceBoolean(
                    partialConfig.claude.enabled,
                    defaults.claude?.enabled || false
                ),
                claudePath: ConfigRecovery.coerceString(
                    partialConfig.claude.claudePath,
                    defaults.claude?.claudePath
                ),
                maxIterations: ConfigRecovery.coerceNumber(
                    partialConfig.claude.maxIterations,
                    defaults.claude?.maxIterations || 10,
                    1, 50
                ),
                timeout: ConfigRecovery.coerceNumber(
                    partialConfig.claude.timeout,
                    defaults.claude?.timeout || 1800000,
                    900000, 3600000
                ),
                model: ConfigRecovery.coerceEnum(
                    partialConfig.claude.model,
                    ['sonnet', 'opus', 'opusplan', 'haiku'] as const,
                    (defaults.claude?.model as 'sonnet' | 'opus' | 'opusplan' | 'haiku') || 'opusplan'
                ) as 'sonnet' | 'opus' | 'opusplan' | 'haiku',
                verbose: ConfigRecovery.coerceBoolean(
                    partialConfig.claude.verbose,
                    defaults.claude?.verbose || false
                ),
                outputFormat: ConfigRecovery.coerceEnum(
                    partialConfig.claude.outputFormat,
                    ['text', 'json', 'stream-json'] as const,
                    defaults.claude?.outputFormat || 'stream-json'
                ),
                permissionMode: ConfigRecovery.coerceEnum(
                    partialConfig.claude.permissionMode,
                    ['acceptEdits', 'bypassPermissions', 'default', 'plan'] as const,
                    defaults.claude?.permissionMode || 'default'
                ) as 'acceptEdits' | 'bypassPermissions' | 'default' | 'plan',
                dangerouslySkipPermissions: ConfigRecovery.coerceBoolean(
                    partialConfig.claude.dangerouslySkipPermissions,
                    defaults.claude?.dangerouslySkipPermissions || false
                ),
                allowedTools: Array.isArray(partialConfig.claude.allowedTools)
                    ? partialConfig.claude.allowedTools.filter(tool => typeof tool === 'string')
                    : defaults.claude?.allowedTools || [],
                customArgs: Array.isArray(partialConfig.claude.customArgs)
                    ? partialConfig.claude.customArgs.filter(arg => typeof arg === 'string')
                    : defaults.claude?.customArgs || [],
                continueSession: ConfigRecovery.coerceBoolean(
                    partialConfig.claude.continueSession,
                    defaults.claude?.continueSession || true
                ),
                appendSystemPrompt: ConfigRecovery.coerceString(
                    partialConfig.claude.appendSystemPrompt,
                    defaults.claude?.appendSystemPrompt
                ),
                maxRetries: ConfigRecovery.coerceNumber(
                    partialConfig.claude.maxRetries,
                    defaults.claude?.maxRetries || 3,
                    0, 10
                ),
                retryDelay: ConfigRecovery.coerceNumber(
                    partialConfig.claude.retryDelay,
                    defaults.claude?.retryDelay || 2000,
                    0, 30000
                ),
                retryBackoffMultiplier: ConfigRecovery.coerceNumber(
                    partialConfig.claude.retryBackoffMultiplier,
                    defaults.claude?.retryBackoffMultiplier || 2,
                    1, 10
                ),
                maxRetryDelay: ConfigRecovery.coerceNumber(
                    partialConfig.claude.maxRetryDelay,
                    defaults.claude?.maxRetryDelay || 15000,
                    1000, 60000
                )
            } : defaults.claude
        };
        
        return config;
    }
    
    /**
     * Type coercion helpers
     */
    private static coerceString(value: any, defaultValue?: string): string | undefined {
        if (typeof value === 'string') return value;
        if (value === null || value === undefined) return defaultValue;
        return String(value);
    }
    
    private static coerceBoolean(value: any, defaultValue: boolean): boolean {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const lower = value.toLowerCase();
            if (['true', 'yes', '1', 'on'].includes(lower)) return true;
            if (['false', 'no', '0', 'off'].includes(lower)) return false;
        }
        if (typeof value === 'number') return value !== 0;
        return defaultValue;
    }
    
    private static coerceNumber(
        value: any,
        defaultValue: number,
        min?: number,
        max?: number
    ): number {
        let num: number;
        
        if (typeof value === 'number') {
            num = value;
        } else if (typeof value === 'string') {
            num = Number(value);
            if (isNaN(num)) {
                console.warn(`Invalid number "${value}", using default: ${defaultValue}`);
                return defaultValue;
            }
        } else {
            return defaultValue;
        }
        
        if (min !== undefined && num < min) {
            console.warn(`Value ${num} below minimum ${min}, using ${min}`);
            return min;
        }
        
        if (max !== undefined && num > max) {
            console.warn(`Value ${num} above maximum ${max}, using ${max}`);
            return max;
        }
        
        return num;
    }
    
    private static coerceEnum<T extends readonly string[]>(
        value: any,
        validValues: T,
        defaultValue: T[number]
    ): T[number] {
        if (typeof value === 'string' && validValues.includes(value as T[number])) {
            return value as T[number];
        }
        
        if (value !== undefined) {
            console.warn(`Invalid enum value "${value}", using default: ${defaultValue}`);
        }
        
        return defaultValue;
    }
    
    /**
     * Validates environment variables and applies overrides
     */
    static applyEnvironmentOverrides(config: TodoqConfig): TodoqConfig {
        const envConfig = { ...config };
        
        // Database overrides
        if (process.env.TODOQ_DB_PATH) {
            envConfig.database.path = process.env.TODOQ_DB_PATH;
        }
        
        // Claude overrides
        if (process.env.TODOQ_CLAUDE_ENABLED) {
            envConfig.claude = envConfig.claude || getDefaultConfig().claude!;
            envConfig.claude.enabled = ConfigRecovery.coerceBoolean(
                process.env.TODOQ_CLAUDE_ENABLED,
                envConfig.claude.enabled
            );
        }
        
        if (process.env.TODOQ_CLAUDE_MAX_ITERATIONS) {
            envConfig.claude = envConfig.claude || getDefaultConfig().claude!;
            envConfig.claude.maxIterations = ConfigRecovery.coerceNumber(
                process.env.TODOQ_CLAUDE_MAX_ITERATIONS,
                envConfig.claude?.maxIterations ?? 10,
                1, 50
            );
        }
        
        if (process.env.TODOQ_CLAUDE_TIMEOUT) {
            envConfig.claude = envConfig.claude || getDefaultConfig().claude!;
            envConfig.claude.timeout = ConfigRecovery.coerceNumber(
                process.env.TODOQ_CLAUDE_TIMEOUT,
                envConfig.claude?.timeout ?? 1800000,
                900000, 3600000
            );
        }
        
        if (process.env.TODOQ_CLAUDE_MODEL) {
            envConfig.claude = envConfig.claude || getDefaultConfig().claude!;
            envConfig.claude.model = ConfigRecovery.coerceEnum(
                process.env.TODOQ_CLAUDE_MODEL,
                ['sonnet', 'opus', 'opusplan', 'haiku'] as const,
                (envConfig.claude?.model as 'sonnet' | 'opus' | 'opusplan' | 'haiku') ?? 'opusplan'
            ) as 'sonnet' | 'opus' | 'opusplan' | 'haiku';
        }
        
        return envConfig;
    }
}