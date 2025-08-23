import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseClient } from '../../../src/adapters/database/client.js';
import { MigrationManager } from '../../../src/adapters/database/migrations.js';

describe('Database Integration', () => {
    let db: DatabaseClient;
    const testDbPath = ':memory:';

    beforeEach(async () => {
        db = new DatabaseClient(testDbPath);
    });

    afterEach(() => {
        if (db && db.isOpen) {
            db.close();
        }
    });

    describe('DatabaseClient', () => {
        it('should initialize database successfully', () => {
            expect(db.isOpen).toBe(true);
        });

        it('should execute SQL commands', () => {
            db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
            
            const stmt = db.prepare('INSERT INTO test (name) VALUES (?)');
            const result = stmt.run('test name');

            expect(result.lastInsertRowid).toBeDefined();
            expect(result.changes).toBe(1);
        });

        it('should support transactions', () => {
            db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');

            const result = db.transaction(() => {
                const stmt = db.prepare('INSERT INTO test (name) VALUES (?)');
                stmt.run('item 1');
                stmt.run('item 2');
                return 'transaction completed';
            });

            expect(result).toBe('transaction completed');

            const count = db.prepare('SELECT COUNT(*) as count FROM test').get() as { count: number };
            expect(count.count).toBe(2);
        });

        it('should rollback failed transactions', () => {
            db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT UNIQUE)');

            expect(() => {
                db.transaction(() => {
                    const stmt = db.prepare('INSERT INTO test (name) VALUES (?)');
                    stmt.run('unique item');
                    stmt.run('unique item'); // This should fail due to UNIQUE constraint
                });
            }).toThrow();

            const count = db.prepare('SELECT COUNT(*) as count FROM test').get() as { count: number };
            expect(count.count).toBe(0); // Should be 0 due to rollback
        });

        it('should support prepared statements', () => {
            db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT, value INTEGER)');

            const insertStmt = db.prepare('INSERT INTO test (name, value) VALUES (?, ?)');
            const selectStmt = db.prepare('SELECT * FROM test WHERE name = ?');

            insertStmt.run('test', 42);
            const result = selectStmt.get('test') as any;

            expect(result.name).toBe('test');
            expect(result.value).toBe(42);
        });

        it('should check transaction status', () => {
            expect(db.inTransaction).toBe(false);

            db.transaction(() => {
                expect(db.inTransaction).toBe(true);
            });

            expect(db.inTransaction).toBe(false);
        });
    });

    describe('MigrationManager', () => {
        let migrationManager: MigrationManager;

        beforeEach(() => {
            migrationManager = new MigrationManager(db);
        });

        it('should initialize migrations table', async () => {
            migrationManager.initialize();

            const tables = db.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
            `).all() as Array<{ name: string }>;
            
            const tableNames = tables.map(t => t.name);
            expect(tableNames).toContain('migrations');
        });

        it('should create all required tables', async () => {
            migrationManager.initialize();

            const tables = db.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
            `).all() as Array<{ name: string }>;
            
            const tableNames = tables.map(t => t.name);
            expect(tableNames).toContain('tasks');
            expect(tableNames).toContain('task_dependencies');
            expect(tableNames).toContain('config');
            expect(tableNames).toContain('migrations');
        });

        it('should create indexes on tasks table', async () => {
            migrationManager.initialize();

            const indexes = db.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='index' AND tbl_name='tasks'
            `).all() as Array<{ name: string }>;
            
            const indexNames = indexes.map(i => i.name);
            expect(indexNames).toContain('idx_tasks_status');
            expect(indexNames).toContain('idx_tasks_parent_id');
            expect(indexNames).toContain('idx_tasks_task_number');
            expect(indexNames).toContain('idx_tasks_priority');
        });

        it('should not rerun migrations on subsequent calls', async () => {
            // First initialization
            migrationManager.initialize();

            const firstMigrations = db.prepare('SELECT * FROM migrations').all();

            // Second initialization
            migrationManager.initialize();

            const secondMigrations = db.prepare('SELECT * FROM migrations').all();

            expect(firstMigrations).toEqual(secondMigrations);
        });

        it('should enforce foreign key constraints', async () => {
            migrationManager.initialize();

            // Insert a parent task
            const parentStmt = db.prepare(`
                INSERT INTO tasks (task_number, name, status, priority) 
                VALUES (?, ?, ?, ?)
            `);
            const parentResult = parentStmt.run('1.0', 'Parent Task', 'pending', 0);

            // Insert a child task with valid parent_id
            const childStmt = db.prepare(`
                INSERT INTO tasks (parent_id, task_number, name, status, priority) 
                VALUES (?, ?, ?, ?, ?)
            `);
            expect(() => {
                childStmt.run(parentResult.lastInsertRowid, '1.1', 'Child Task', 'pending', 0);
            }).not.toThrow();

            // Try to insert child with invalid parent_id
            expect(() => {
                childStmt.run(9999, '1.2', 'Invalid Child', 'pending', 0);
            }).toThrow();
        });

        it('should enforce task_number uniqueness', async () => {
            migrationManager.initialize();

            const stmt = db.prepare(`
                INSERT INTO tasks (task_number, name, status, priority) 
                VALUES (?, ?, ?, ?)
            `);

            stmt.run('1.0', 'First Task', 'pending', 0);

            expect(() => {
                stmt.run('1.0', 'Duplicate Task', 'pending', 0);
            }).toThrow();
        });

        it('should enforce status check constraint', async () => {
            migrationManager.initialize();

            const stmt = db.prepare(`
                INSERT INTO tasks (task_number, name, status, priority) 
                VALUES (?, ?, ?, ?)
            `);

            expect(() => {
                stmt.run('1.0', 'Invalid Status Task', 'invalid_status', 0);
            }).toThrow();
        });
    });
});