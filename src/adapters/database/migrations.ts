import { DatabaseClient } from './client.js';
import { TodoqError } from '../../core/types.js';

export class MigrationManager {
    private db: DatabaseClient;

    constructor(db: DatabaseClient) {
        this.db = db;
    }

    public initialize(): void {
        try {
            // Create migrations table if it doesn't exist
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS migrations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    version INTEGER UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Run all pending migrations
            this.runMigrations();
        } catch (error) {
            throw new TodoqError(
                `Failed to initialize database migrations: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'MIGRATION_INIT_ERROR',
                { error }
            );
        }
    }

    private runMigrations(): void {
        const migrations = this.getMigrations();
        const appliedMigrations = this.getAppliedMigrations();

        for (const migration of migrations) {
            if (!appliedMigrations.includes(migration.version)) {
                this.runMigration(migration);
            }
        }
    }

    private getAppliedMigrations(): number[] {
        const stmt = this.db.prepare('SELECT version FROM migrations ORDER BY version');
        const rows = stmt.all() as Array<{ version: number }>;
        return rows.map(row => row.version);
    }

    private runMigration(migration: Migration): void {
        try {
            this.db.transaction(() => {
                // Execute migration
                this.db.exec(migration.sql);

                // Record migration
                const stmt = this.db.prepare(
                    'INSERT INTO migrations (version, name) VALUES (?, ?)'
                );
                stmt.run(migration.version, migration.name);
            });

            console.log(`Applied migration ${migration.version}: ${migration.name}`);
        } catch (error) {
            throw new TodoqError(
                `Failed to apply migration ${migration.version}: ${migration.name}`,
                'MIGRATION_ERROR',
                { migration, error }
            );
        }
    }

    private getMigrations(): Migration[] {
        return [
            {
                version: 1,
                name: 'Create tasks table',
                sql: `
                    CREATE TABLE tasks (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                        task_number TEXT UNIQUE NOT NULL,
                        name TEXT NOT NULL,
                        description TEXT,
                        docs_references TEXT,
                        testing_strategy TEXT,
                        status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
                        priority INTEGER DEFAULT 0,
                        files TEXT,
                        notes TEXT,
                        completion_notes TEXT,
                        completion_percentage REAL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                `
            },
            {
                version: 2,
                name: 'Create task indexes',
                sql: `
                    CREATE INDEX idx_tasks_status ON tasks(status);
                    CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
                    CREATE INDEX idx_tasks_task_number ON tasks(task_number);
                    CREATE INDEX idx_tasks_priority ON tasks(priority DESC);
                `
            },
            {
                version: 3,
                name: 'Create task dependencies table',
                sql: `
                    CREATE TABLE task_dependencies (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                        depends_on_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                        UNIQUE(task_id, depends_on_id)
                    );
                    
                    CREATE INDEX idx_dependencies_task_id ON task_dependencies(task_id);
                    CREATE INDEX idx_dependencies_depends_on_id ON task_dependencies(depends_on_id);
                `
            },
            {
                version: 4,
                name: 'Create config table',
                sql: `
                    CREATE TABLE config (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                `
            },
            {
                version: 5,
                name: 'Create updated_at trigger',
                sql: `
                    CREATE TRIGGER update_tasks_updated_at
                    AFTER UPDATE ON tasks
                    FOR EACH ROW
                    BEGIN
                        UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                    END;
                    
                    CREATE TRIGGER update_config_updated_at
                    AFTER UPDATE ON config
                    FOR EACH ROW
                    BEGIN
                        UPDATE config SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
                    END;
                `
            }
        ];
    }
}

interface Migration {
    version: number;
    name: string;
    sql: string;
}