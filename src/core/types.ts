export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface Task {
    id?: number;
    parentId?: number;
    taskNumber: string;
    name: string;
    description?: string;
    docsReferences?: string[];
    testingStrategy?: string;
    status: TaskStatus;
    priority: number;
    dependencies?: string[];
    files?: string[];
    notes?: string;
    completionNotes?: string;
    completionPercentage?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface TaskInput {
    number: string;
    name: string;
    description?: string;
    parent?: string | null;
    status?: TaskStatus;
    priority?: number;
    docs_references?: string[];
    testing_strategy?: string;
    dependencies?: string[];
    files?: string[];
    notes?: string;
    completion_notes?: string;
}

export interface TaskDependency {
    id?: number;
    taskId: number;
    dependsOnId: number;
}

export interface TodoqConfig {
    database: {
        path: string;
        autoMigrate: boolean;
        walMode: boolean;
    };
    display: {
        format: 'tree' | 'list' | 'table';
        colors: boolean;
        showCompleted: boolean;
    };
    defaults: {
        status: TaskStatus;
        priority: number;
    };
    claude?: {
        enabled: boolean;
        claudePath?: string;
        maxIterations?: number;
        timeout?: number;
        model?: string;
        verbose?: boolean;
        streaming?: boolean;
        outputFormat?: 'text' | 'json' | 'stream-json';
        permissionMode?: 'acceptEdits' | 'bypassPermissions' | 'default' | 'plan';
        dangerouslySkipPermissions?: boolean;
        allowedTools?: string[];
        customArgs?: string[];
        continueSession?: boolean;
        appendSystemPrompt?: string;
    };
}

export interface OperationResult<T> {
    success: boolean;
    data?: T;
    error?: TodoqError;
}

export interface BulkInsertResult {
    success: boolean;
    inserted: Task[];
    skipped: Array<{task: TaskInput; reason: string}>;
    errors: Array<{task: TaskInput; error: string}>;
    summary: {
        total: number;
        successful: number;
        skipped: number;
        failed: number;
    };
}

export interface ValidationResult {
    valid: boolean;
    errors: Array<{task: string; field: string; error: string}>;
    summary: {
        total: number;
        valid: number;
        invalid: number;
    };
}

export class TodoqError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: any
    ) {
        super(message);
        this.name = 'TodoqError';
        Error.captureStackTrace(this, TodoqError);
    }
}

export interface CommandOptions {
    config?: string;
    json?: boolean;
    _config?: TodoqConfig;
}

export interface ListOptions extends CommandOptions {
    status?: TaskStatus;
    parent?: string;
    noSubtasks?: boolean;
    tree?: boolean;
    format?: 'tree' | 'list' | 'table';
}

export interface TaskStats {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    completionRate: number;
}