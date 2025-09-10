import { cosmiconfigSync } from 'cosmiconfig';
import path from 'path';
import os from 'os';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { TodoqConfig } from '../../core/types.js';

/**
 * Load the default prompt from task-execution.md and transform it for appendSystemPrompt
 */
function loadDefaultPrompt(): string {
    try {
        const currentFile = fileURLToPath(import.meta.url);
        const currentDir = path.dirname(currentFile);
        
        // Try multiple possible paths for the prompt file
        const possiblePaths = [
            // In dist directory (production)
            path.join(currentDir, '../../services/claude/prompts/task-execution.md'),
            // In src directory (development)
            path.join(currentDir, '../../../src/services/claude/prompts/task-execution.md'),
            // Relative to project root
            path.join(currentDir, '../services/claude/prompts/task-execution.md')
        ];
        
        for (const promptPath of possiblePaths) {
            if (existsSync(promptPath)) {
                const content = readFileSync(promptPath, 'utf-8');
                
                // Transform the prompt:
                // 1. Remove the first two lines (TASK_JSON and PROJECT_DIR placeholders)
                // 2. Add steps 1-3 before step 4
                const lines = content.split('\n');
                
                // Skip the first 4 lines (task json, project dir, empty line, and "Execute the following steps:")
                const stepsContent = lines.slice(4).join('\n');
                
                // Add the complete prompt with steps 1-3
                return `
## TodoQ Task Execution Guidelines

Execute the following steps:

1. **Parse and Validate Task JSON**
   - Extract and validate all task fields from the provided task JSON
   - Verify task number, name, and description are present
   - Check for any dependencies, files, or documentation references
   - **COMPLETION**: Mark step 1 complete in TodoWrite

2. **Mark Task as In Progress**
   - Update task status to in_progress in TodoWrite
   - Initialize tracking for all implementation steps
   - **COMPLETION**: Mark step 2 complete

3. **Verify Working Directory and Project Structure**
   - Confirm working in correct project directory
   - Check for existence of referenced files/directories
   - Verify project setup is appropriate for task
   - **COMPLETION**: Mark step 3 complete
${stepsContent}`.trim();
            }
        }
    } catch (error) {
        console.warn('Could not load task-execution.md, using fallback prompt');
    }
    
    // Fallback: return the current hardcoded prompt
    return `
## TodoQ Task Execution Guidelines

Execute the following steps:

1. **Parse and Validate Task JSON**
   - Extract and validate all task fields from the provided task JSON
   - Verify task number, name, and description are present
   - Check for any dependencies, files, or documentation references
   - **COMPLETION**: Mark step 1 complete in TodoWrite

2. **Mark Task as In Progress**
   - Update task status to in_progress in TodoWrite
   - Initialize tracking for all implementation steps
   - **COMPLETION**: Mark step 2 complete

3. **Verify Working Directory and Project Structure**
   - Confirm working in correct project directory
   - Check for existence of referenced files/directories
   - Verify project setup is appropriate for task
   - **COMPLETION**: Mark step 3 complete

4. **Phase 1 Checkpoint - Initialization Complete**
   - **MANDATORY VALIDATION**: Verify TodoWrite shows steps 1-3 as completed
   - Verify task json successfully extracted and task marked in_progress
   - If ANY previous step incomplete: create specific recovery todos and STOP
   - **COMPLETION**: Mark step 4 complete, start step 5

5. **Context Extraction & Documentation Research**
   - **CHECKPOINT**: Verify step 4 completed in TodoWrite before proceeding
   - Extract all elements from task json (number, name, description, files, docs_references, etc.)
   - If documentation references provided: Use WebFetch/WebSearch tools for comprehensive documentation research
   - Formulate effective search queries and connect findings to implementation and testing strategies
   - Integrate documentation findings with task context for implementation planning
   - **COMPLETION**: Mark step 5 complete, start step 6

6. **Implementation Phase**
   - **CHECKPOINT**: Verify step 5 completed in TodoWrite before proceeding
   - Expand task into specific implementation steps and update TodoWrite accordingly
   - Execute each implementation step using appropriate tools (Read, Edit, Bash, etc.)
   - Validate each substep completion before proceeding to next substep
   - Follow existing code conventions and patterns found in the codebase
   - **COMPLETION**: Mark step 6 complete when all implementation subtasks completed, start step 7

7. **Phase 2 Checkpoint - Implementation Complete**
   - **MANDATORY VALIDATION**: Verify TodoWrite shows steps 1-6 as completed
   - Verify all implementation subtasks completed successfully
   - If implementation incomplete: create specific recovery todos and STOP
   - **COMPLETION**: Mark step 7 complete, start step 8

8. **Testing & Validation Pipeline**
   - **CHECKPOINT**: Verify step 7 completed in TodoWrite before proceeding
   - Determine proper unit and integration tests for implemented functionality
   - Use Bash tool to run project-specific testing commands
   - Use Bash tool to run linting/typecheck validation if available (npm run lint, npm run typecheck)
   - On ANY test failures: Create specific recovery todos, keep step 8 as in_progress, and STOP
   - **COMPLETION**: Only mark step 8 complete when ALL tests pass

## Error Recovery Pattern
**On ANY Step Failure:**
1. Keep current step as in_progress in TodoWrite
2. Create specific recovery todo describing the exact failure
3. DO NOT proceed to next step until current step shows completed
4. Analyze failure context and resolve using appropriate direct tools (Read, Edit, Bash, etc.)
5. Only continue sequential execution after recovery todo completed

## Mandatory Validation Rules
1. **Sequential Enforcement**: No step can begin until previous step shows completed in TodoWrite
2. **Checkpoint Validation**: Phase checkpoints (4, 7) MUST verify all previous steps completed
3. **Error Stopping**: ANY failure creates recovery todos and halts progression
4. **No Skipping**: Every step must be explicitly marked complete in TodoWrite
`.trim();
}

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
            enabled: true,
            maxIterations: 10,
            timeout: 1800000, // 30 minutes
            model: 'opusplan',
            verbose: false,
            outputFormat: 'stream-json',
            allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'WebFetch', 'WebSearch', 'TodoWrite'],
            customArgs: [],
            continueSession: true, // Enable session continuity for multi-turn task completion
            // IMPORTANT: Do NOT include {{TASK_JSON}} or {{PROJECT_DIR}} placeholders in appendSystemPrompt
            // These are automatically injected by the main prompt template and won't be replaced here
            // This prompt is dynamically loaded from src/services/claude/prompts/task-execution.md when available
            appendSystemPrompt: loadDefaultPrompt(),
            // Retry configuration for resilient execution
            maxRetries: 3, // Retry up to 3 times on transient errors
            retryDelay: 2000, // Start with 2 second delay
            retryBackoffMultiplier: 2, // Double the delay each retry
            maxRetryDelay: 15000 // Cap at 15 seconds
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
        const mergedConfig = deepMerge(getDefaultConfig(), config);
        
        // Apply environment variable overrides
        const { ConfigRecovery } = await import('./recovery.js');
        return ConfigRecovery.applyEnvironmentOverrides(mergedConfig);
        
    } catch (error) {
        // Attempt recovery if we have a specific file path
        if (configPath && existsSync(configPath)) {
            const { ConfigRecovery } = await import('./recovery.js');
            const recoveredConfig = await ConfigRecovery.attemptRecovery(configPath, error as Error);
            
            if (recoveredConfig) {
                return ConfigRecovery.applyEnvironmentOverrides(recoveredConfig);
            }
        }
        
        // If no specific path or recovery failed, log and use defaults
        console.warn(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.warn('Using default configuration');
        
        const defaultConfig = getDefaultConfig();
        const { ConfigRecovery } = await import('./recovery.js');
        return ConfigRecovery.applyEnvironmentOverrides(defaultConfig);
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
        (!config.claude.customArgs || Array.isArray(config.claude.customArgs)) &&
        (!config.claude.continueSession || typeof config.claude.continueSession === 'boolean') &&
        (!config.claude.maxRetries || (typeof config.claude.maxRetries === 'number' && config.claude.maxRetries >= 0)) &&
        (!config.claude.retryDelay || (typeof config.claude.retryDelay === 'number' && config.claude.retryDelay > 0)) &&
        (!config.claude.retryBackoffMultiplier || (typeof config.claude.retryBackoffMultiplier === 'number' && config.claude.retryBackoffMultiplier >= 1)) &&
        (!config.claude.maxRetryDelay || (typeof config.claude.maxRetryDelay === 'number' && config.claude.maxRetryDelay > 0))
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
            timeout: 1800000,
            model: 'sonnet-4',
            verbose: false,
            streaming: false,
            allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'WebFetch', 'WebSearch', 'TodoWrite'],
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
        return this.config.claude?.timeout || 1800000;
    }

    public getClaudeModel(): string {
        return this.config.claude?.model || 'claude-3-5-sonnet-20241022';
    }

    public isClaudeVerbose(): boolean {
        return this.config.claude?.verbose || false;
    }

    public isClaudeStreaming(): boolean {
        return this.config.claude?.streaming || false;
    }

    public getClaudeAllowedTools(): string[] {
        return this.config.claude?.allowedTools || ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'WebFetch', 'WebSearch', 'TodoWrite'];
    }

    public getClaudeCustomArgs(): string[] {
        return this.config.claude?.customArgs || [];
    }
}