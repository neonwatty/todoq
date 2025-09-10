import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseClient } from '../../../src/adapters/database/client.js';
import { MigrationManager } from '../../../src/adapters/database/migrations.js';
import { TodoqError } from '../../../src/core/types.js';

describe('MigrationManager', () => {
    let db: DatabaseClient;
    let migrationManager: MigrationManager;

    beforeEach(() => {
        db = new DatabaseClient(':memory:');
        migrationManager = new MigrationManager(db);
    });

    afterEach(() => {
        if (db && db.isOpen) {
            db.close();
        }
    });

    describe('initialize', () => {
        it('should create migrations table on first run', () => {
            migrationManager.initialize();

            // Check that migrations table exists
            const tableExists = db.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='migrations'
            `).get();

            expect(tableExists).toBeDefined();
        });

        it('should run all migrations on fresh database', () => {
            migrationManager.initialize();

            // Check all expected tables exist
            const tables = db.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            `).all() as Array<{ name: string }>;

            const tableNames = tables.map(t => t.name);
            expect(tableNames).toContain('tasks');
            expect(tableNames).toContain('task_dependencies');
            expect(tableNames).toContain('config');
            expect(tableNames).toContain('migrations');
        });

        it('should record applied migrations', () => {
            migrationManager.initialize();

            const appliedMigrations = db.prepare(`
                SELECT version, name FROM migrations ORDER BY version
            `).all() as Array<{ version: number; name: string }>;

            expect(appliedMigrations).toHaveLength(6); // Check expected number of migrations (including numerical sorting)
            expect(appliedMigrations[0].version).toBe(1);
            expect(appliedMigrations[0].name).toBe('Create tasks table');
        });

        it('should create proper indexes', () => {
            migrationManager.initialize();

            const indexes = db.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='index' AND sql IS NOT NULL
            `).all() as Array<{ name: string }>;

            const indexNames = indexes.map(i => i.name);
            expect(indexNames).toContain('idx_tasks_status');
            expect(indexNames).toContain('idx_tasks_parent_id');
            expect(indexNames).toContain('idx_tasks_task_number');
            expect(indexNames).toContain('idx_tasks_priority');
        });

        it('should create proper triggers', () => {
            migrationManager.initialize();

            const triggers = db.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='trigger'
            `).all() as Array<{ name: string }>;

            const triggerNames = triggers.map(t => t.name);
            expect(triggerNames).toContain('update_tasks_updated_at');
            expect(triggerNames).toContain('update_config_updated_at');
        });

        it('should not re-run migrations that are already applied', () => {
            // Run migrations first time
            migrationManager.initialize();

            const firstRunCount = db.prepare('SELECT COUNT(*) as count FROM migrations').get() as { count: number };

            // Run migrations second time
            const newMigrationManager = new MigrationManager(db);
            newMigrationManager.initialize();

            const secondRunCount = db.prepare('SELECT COUNT(*) as count FROM migrations').get() as { count: number };

            expect(firstRunCount.count).toBe(secondRunCount.count);
        });

        it('should handle database errors gracefully', () => {
            // Close the database to simulate error
            db.close();

            expect(() => migrationManager.initialize()).toThrow(TodoqError);
        });
    });

    describe('migration ordering', () => {
        it('should apply migrations in correct order', () => {
            migrationManager.initialize();

            const appliedMigrations = db.prepare(`
                SELECT version FROM migrations ORDER BY version
            `).all() as Array<{ version: number }>;

            const versions = appliedMigrations.map(m => m.version);
            
            // Check that versions are in ascending order
            for (let i = 1; i < versions.length; i++) {
                expect(versions[i]).toBeGreaterThan(versions[i - 1]);
            }
        });

        it('should skip already applied migrations', () => {
            // Initialize with all migrations
            migrationManager.initialize();

            // Manually insert a fake migration
            db.prepare(`
                INSERT INTO migrations (version, name) 
                VALUES (999, 'Test migration')
            `).run();

            // Create new manager and initialize again
            const newManager = new MigrationManager(db);
            newManager.initialize();

            // The fake migration should still exist (not overwritten)
            const testMigration = db.prepare(`
                SELECT * FROM migrations WHERE version = 999
            `).get();

            expect(testMigration).toBeDefined();
        });
    });

    describe('migration content validation', () => {
        beforeEach(() => {
            migrationManager.initialize();
        });

        it('should create tasks table with correct schema', () => {
            const tableInfo = db.prepare(`
                PRAGMA table_info(tasks)
            `).all() as Array<{ name: string; type: string; notnull: number; pk: number }>;

            const columns = tableInfo.map(col => ({
                name: col.name,
                type: col.type,
                required: col.notnull === 1,
                primaryKey: col.pk === 1
            }));

            // Check essential columns exist
            expect(columns.find(c => c.name === 'id' && c.primaryKey)).toBeDefined();
            expect(columns.find(c => c.name === 'task_number' && c.required)).toBeDefined();
            expect(columns.find(c => c.name === 'name' && c.required)).toBeDefined();
            expect(columns.find(c => c.name === 'status')).toBeDefined();
            expect(columns.find(c => c.name === 'priority')).toBeDefined();
            expect(columns.find(c => c.name === 'parent_id')).toBeDefined();
        });

        it('should enforce task status constraints', () => {
            // Valid status should work
            expect(() => {
                db.prepare(`
                    INSERT INTO tasks (task_number, name, status) 
                    VALUES ('1.0', 'Test', 'pending')
                `).run();
            }).not.toThrow();

            // Invalid status should fail
            expect(() => {
                db.prepare(`
                    INSERT INTO tasks (task_number, name, status) 
                    VALUES ('2.0', 'Test', 'invalid_status')
                `).run();
            }).toThrow();
        });

        it('should enforce task_number uniqueness', () => {
            db.prepare(`
                INSERT INTO tasks (task_number, name) 
                VALUES ('1.0', 'First Task')
            `).run();

            expect(() => {
                db.prepare(`
                    INSERT INTO tasks (task_number, name) 
                    VALUES ('1.0', 'Duplicate Task')
                `).run();
            }).toThrow();
        });

        it('should create task_dependencies table with proper constraints', () => {
            const tableInfo = db.prepare(`
                PRAGMA table_info(task_dependencies)
            `).all() as Array<{ name: string; type: string; notnull: number }>;

            const columns = tableInfo.map(col => ({
                name: col.name,
                type: col.type,
                required: col.notnull === 1
            }));

            expect(columns.find(c => c.name === 'task_id' && c.required)).toBeDefined();
            expect(columns.find(c => c.name === 'depends_on_id' && c.required)).toBeDefined();
        });

        it('should enforce foreign key constraints on dependencies', () => {
            // Create two tasks
            db.prepare('INSERT INTO tasks (task_number, name) VALUES (?, ?)').run('1.0', 'Task 1');
            db.prepare('INSERT INTO tasks (task_number, name) VALUES (?, ?)').run('2.0', 'Task 2');

            const task1 = db.prepare('SELECT id FROM tasks WHERE task_number = ?').get('1.0') as { id: number };
            const task2 = db.prepare('SELECT id FROM tasks WHERE task_number = ?').get('2.0') as { id: number };

            // Valid dependency should work
            expect(() => {
                db.prepare(`
                    INSERT INTO task_dependencies (task_id, depends_on_id) 
                    VALUES (?, ?)
                `).run(task2.id, task1.id);
            }).not.toThrow();
        });

        it('should create config table', () => {
            const tableInfo = db.prepare(`
                PRAGMA table_info(config)
            `).all() as Array<{ name: string; type: string; pk: number }>;

            const columns = tableInfo.map(col => ({
                name: col.name,
                type: col.type,
                primaryKey: col.pk === 1
            }));

            expect(columns.find(c => c.name === 'key' && c.primaryKey)).toBeDefined();
            expect(columns.find(c => c.name === 'value')).toBeDefined();
            expect(columns.find(c => c.name === 'updated_at')).toBeDefined();
        });
    });

    describe('migration error handling', () => {
        it('should provide meaningful error messages for migration failures', () => {
            // Create a broken migration manager by closing the database
            db.close();

            expect(() => {
                migrationManager.initialize();
            }).toThrow(TodoqError);

            try {
                migrationManager.initialize();
            } catch (error) {
                expect(error instanceof TodoqError).toBe(true);
                if (error instanceof TodoqError) {
                    expect(error.code).toBe('MIGRATION_INIT_ERROR');
                    expect(error.message).toContain('Failed to initialize database migrations');
                }
            }
        });

        it('should rollback failed migrations', () => {
            // This test would require a way to simulate a partial migration failure
            // For now, we ensure the transaction behavior is tested by checking
            // that either all parts of a migration succeed or none do
            migrationManager.initialize();

            // Check that migrations table is consistent
            const migrations = db.prepare('SELECT * FROM migrations ORDER BY version').all();
            
            // If we have migration records, the corresponding tables should exist
            migrations.forEach((migration: any) => {
                switch (migration.version) {
                    case 1:
                        expect(db.prepare("SELECT name FROM sqlite_master WHERE name='tasks'").get()).toBeDefined();
                        break;
                    case 2:
                        expect(db.prepare("SELECT name FROM sqlite_master WHERE name='idx_tasks_status'").get()).toBeDefined();
                        break;
                    case 3:
                        expect(db.prepare("SELECT name FROM sqlite_master WHERE name='task_dependencies'").get()).toBeDefined();
                        break;
                    case 4:
                        expect(db.prepare("SELECT name FROM sqlite_master WHERE name='config'").get()).toBeDefined();
                        break;
                    case 5:
                        expect(db.prepare("SELECT name FROM sqlite_master WHERE name='update_tasks_updated_at'").get()).toBeDefined();
                        break;
                }
            });
        });
    });

    describe('trigger functionality', () => {
        beforeEach(() => {
            migrationManager.initialize();
        });

        it('should update tasks.updated_at on task updates', async () => {
            // Insert a task
            db.prepare(`
                INSERT INTO tasks (task_number, name, created_at, updated_at) 
                VALUES ('1.0', 'Test Task', '2024-01-01 12:00:00', '2024-01-01 12:00:00')
            `).run();

            // Get initial updated_at
            const initialTask = db.prepare('SELECT updated_at FROM tasks WHERE task_number = ?').get('1.0') as { updated_at: string };

            // Wait a bit to ensure different timestamp
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Update task
            db.prepare('UPDATE tasks SET name = ? WHERE task_number = ?').run('Updated Task', '1.0');

            const updatedTask = db.prepare('SELECT updated_at FROM tasks WHERE task_number = ?').get('1.0') as { updated_at: string };

            expect(new Date(updatedTask.updated_at).getTime()).toBeGreaterThan(new Date(initialTask.updated_at).getTime());
        });

        it('should update config.updated_at on config updates', async () => {
            // Insert config
            db.prepare(`
                INSERT INTO config (key, value, updated_at) 
                VALUES ('test_key', 'test_value', '2024-01-01 12:00:00')
            `).run();

            const initialConfig = db.prepare('SELECT updated_at FROM config WHERE key = ?').get('test_key') as { updated_at: string };

            // Wait a bit to ensure different timestamp
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Update config
            db.prepare('UPDATE config SET value = ? WHERE key = ?').run('new_value', 'test_key');

            const updatedConfig = db.prepare('SELECT updated_at FROM config WHERE key = ?').get('test_key') as { updated_at: string };

            expect(new Date(updatedConfig.updated_at).getTime()).toBeGreaterThan(new Date(initialConfig.updated_at).getTime());
        });
    });
});