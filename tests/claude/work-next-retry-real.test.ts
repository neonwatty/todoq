import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isClaudeCodeAvailable } from './commands-helpers.js';
import { createTestDir, cleanupTestDir, getCliPath } from '../functional/setup.js';
import { runCliInDir } from '../functional/helpers.js';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { execa } from 'execa';

describe('work-next with retry configuration - real Claude Code', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = createTestDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('should use retry configuration when Claude encounters transient errors', async () => {
    if (!await isClaudeCodeAvailable()) {
      console.log('⚠️  Skipping retry test - Claude Code not available');
      return;
    }

    // Initialize todoq
    await runCliInDir(testDir, 'init');

    // Create a configuration with retry settings
    const todoqConfig = {
      database: {
        path: '.todoq/todoq.db',
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
        priority: 1
      },
      claude: {
        enabled: true,
        model: 'sonnet', // Use sonnet for faster testing
        verbose: true,
        outputFormat: 'stream-json',
        dangerouslySkipPermissions: true,
        // Retry configuration - this is what we're testing
        maxRetries: 3,
        retryDelay: 2000,
        retryBackoffMultiplier: 1.5,
        maxRetryDelay: 10000
      }
    };

    const configPath = path.join(testDir, '.todoqrc.json');
    writeFileSync(configPath, JSON.stringify(todoqConfig, null, 2));

    // Create a simple task that should succeed
    const simpleTasks = {
      tasks: [
        {
          number: '1.0',
          name: 'Create Hello World Function',
          description: 'Create a simple JavaScript function that returns "Hello, World!"',
          status: 'pending',
          priority: 1,
          files: ['hello.js'],
          notes: 'Create a function named sayHello that returns the string "Hello, World!"'
        }
      ]
    };

    const tasksFile = path.join(testDir, 'hello-tasks.json');
    writeFileSync(tasksFile, JSON.stringify(simpleTasks, null, 2));

    // Import tasks
    await runCliInDir(testDir, 'import hello-tasks.json');

    // Verify task is available
    const currentResult = await runCliInDir(testDir, 'current');
    expect(currentResult.stdout).toContain('Create Hello World Function');

    console.log('🚀 Testing work-next with retry configuration...');
    console.log('📊 Retry config: maxRetries=3, retryDelay=2000ms, backoff=1.5x');
    
    // Execute work-next with retry configuration
    const cliPath = getCliPath();
    const startTime = Date.now();
    
    // Use the configuration file we created
    const workNextResult = await execa('node', [cliPath, 'work-next', '--config', configPath], {
      cwd: testDir,
      timeout: 120000, // 2 minutes timeout
      stdio: ['inherit', 'pipe', 'pipe'], // Capture output but don't stream
      reject: false
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`✅ Work-next completed in ${duration}ms with exit code: ${workNextResult.exitCode}`);
    
    // Check the output for retry messages if it failed
    const output = workNextResult.stdout + workNextResult.stderr;
    
    // Look for retry indicators in the output
    const hasRetryMessages = output.includes('Claude execution failed') || 
                            output.includes('Retrying in') ||
                            output.includes('attempt');
    
    if (hasRetryMessages) {
      console.log('🔁 Retry logic was triggered during execution');
      
      // Count retry attempts mentioned in output
      const retryMatches = output.match(/attempt \d+\/\d+/g) || [];
      if (retryMatches.length > 0) {
        console.log(`📊 Retry attempts detected: ${retryMatches.join(', ')}`);
      }
    } else {
      console.log('✨ Task completed without needing retries');
    }

    // Check if the file was created
    const helloPath = path.join(testDir, 'hello.js');
    const fileCreated = existsSync(helloPath);
    
    if (fileCreated) {
      console.log('✅ Hello.js file was created successfully');
      const content = readFileSync(helloPath, 'utf-8');
      console.log('📝 Generated code:');
      console.log(content);
      
      // Verify it has a sayHello function
      expect(content).toMatch(/sayHello|Hello,?\s*World/i);
    } else {
      console.log('⚠️  File was not created - Claude may have encountered issues');
    }

    // Check task status after completion
    const finalStatus = await runCliInDir(testDir, 'current', { expectError: true });
    console.log('📊 Final task status:', finalStatus.stdout || finalStatus.stderr || 'No current task');
  }, 180000); // 3 minute test timeout

  it('should demonstrate retry behavior with verbose output', async () => {
    if (!await isClaudeCodeAvailable()) {
      console.log('⚠️  Skipping retry demo - Claude Code not available');
      return;
    }

    // Initialize todoq
    await runCliInDir(testDir, 'init');

    // Create a more complex task that might trigger retries
    const complexTasks = {
      tasks: [
        {
          number: '1.0',
          name: 'Implement Fibonacci with Memoization',
          description: 'Create an optimized Fibonacci function using memoization',
          status: 'pending',
          priority: 1,
          files: ['fibonacci.js'],
          notes: 'Implement a fibonacci(n) function that: 1) Uses memoization for optimization, 2) Handles edge cases (n<0, non-integer), 3) Returns the nth Fibonacci number, 4) Includes a cache object to store computed values',
          testing_strategy: 'Test with fibonacci(0)=0, fibonacci(1)=1, fibonacci(10)=55, fibonacci(20)=6765'
        }
      ]
    };

    const tasksFile = path.join(testDir, 'fib-tasks.json');
    writeFileSync(tasksFile, JSON.stringify(complexTasks, null, 2));

    // Import tasks
    await runCliInDir(testDir, 'import fib-tasks.json');

    console.log('🚀 Testing complex task with retry configuration...');
    
    // Execute with verbose output to see retry behavior
    const cliPath = getCliPath();
    const commandArgs = [
      'work-next',
      '--verbose',
      '--output-format', 'stream-json',
      '--test-timeout', '120000',
      '--dangerously-skip-permissions'
    ];
    
    // Create inline config with retries
    const configWithRetries = {
      claude: {
        enabled: true,
        maxRetries: 5,
        retryDelay: 1000,
        retryBackoffMultiplier: 2,
        maxRetryDelay: 15000,
        model: 'sonnet'
      }
    };
    
    // Write temporary config
    const tempConfigPath = path.join(testDir, '.todoqrc.test.json');
    writeFileSync(tempConfigPath, JSON.stringify(configWithRetries, null, 2));
    
    console.log('📊 Using retry config: maxRetries=5, exponential backoff 2x');
    
    const workNextResult = await execa('node', [cliPath, '--config', tempConfigPath, ...commandArgs], {
      cwd: testDir,
      timeout: 180000, // 3 minutes
      stdio: ['inherit', 'pipe', 'pipe'],
      reject: false
    });

    const output = workNextResult.stdout + workNextResult.stderr;
    
    // Analyze the output for retry patterns
    console.log('\n📊 Execution Analysis:');
    console.log(`Exit code: ${workNextResult.exitCode}`);
    
    // Look for specific retry indicators
    const retryIndicators = [
      /Claude execution failed/g,
      /Retrying in \d+ms/g,
      /attempt \d+\/\d+/g,
      /Claude Code exited with code \d+/g
    ];
    
    retryIndicators.forEach(pattern => {
      const matches = output.match(pattern) || [];
      if (matches.length > 0) {
        console.log(`Found ${matches.length} occurrences of: ${pattern.source}`);
        matches.slice(0, 3).forEach(match => console.log(`  - ${match}`));
      }
    });
    
    // Check if fibonacci file was created
    const fibPath = path.join(testDir, 'fibonacci.js');
    if (existsSync(fibPath)) {
      console.log('\n✅ Fibonacci.js was created');
      const content = readFileSync(fibPath, 'utf-8');
      
      // Verify it has memoization
      const hasMemoization = content.includes('cache') || 
                            content.includes('memo') || 
                            content.includes('stored');
      console.log(`📝 Has memoization: ${hasMemoization}`);
      
      if (hasMemoization) {
        console.log('✨ Successfully implemented with memoization!');
      }
    } else {
      console.log('\n⚠️  Fibonacci.js was not created');
      console.log('This could indicate retry exhaustion or Claude encountering persistent issues');
    }
  }, 240000); // 4 minute test timeout
});