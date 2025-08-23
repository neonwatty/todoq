import Database from 'better-sqlite3';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { TodoqError } from '../../core/types.js';

export class DatabaseClient {
    private db: Database.Database;

    constructor(dbPath: string) {
        try {
            // Ensure directory exists
            const dir = path.dirname(dbPath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }

            this.db = new Database(dbPath);
            this.optimize();
        } catch (error) {
            throw new TodoqError(
                `Failed to initialize database: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'DB_INIT_ERROR',
                { dbPath, error }
            );
        }
    }

    private optimize(): void {
        try {
            // Enable WAL mode for better concurrency
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('cache_size = -64000'); // 64MB cache
            this.db.pragma('foreign_keys = ON');
            this.db.pragma('temp_store = MEMORY');
        } catch (error) {
            throw new TodoqError(
                'Failed to optimize database',
                'DB_OPTIMIZE_ERROR',
                { error }
            );
        }
    }

    public transaction<T>(fn: () => T): T {
        const trx = this.db.transaction(fn);
        return trx();
    }

    public prepare<T = any>(sql: string): Database.Statement<T> {
        return this.db.prepare(sql);
    }

    public exec(sql: string): Database.Database {
        return this.db.exec(sql);
    }

    public close(): void {
        if (this.db) {
            this.db.close();
        }
    }

    public backup(backupPath: string): void {
        try {
            const dir = path.dirname(backupPath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            this.db.backup(backupPath);
        } catch (error) {
            throw new TodoqError(
                'Failed to backup database',
                'DB_BACKUP_ERROR',
                { backupPath, error }
            );
        }
    }

    public pragma(sql: string): any {
        return this.db.pragma(sql);
    }

    public get isOpen(): boolean {
        return this.db && this.db.open;
    }

    public get inTransaction(): boolean {
        return this.db.inTransaction;
    }
}