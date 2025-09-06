import { Command } from 'commander';
import chalk from 'chalk';
import { getClaudeService } from '../../services/claude/index.js';
import type { TodoqConfig } from '../../core/types.js';

export function registerWorkNextCommands(program: Command): void {
  program
    .command('work-next')
    .description('Work on next task using Claude')
    .argument('[directory]', 'project directory', process.cwd())
    .option('--test-timeout <ms>', 'execution timeout in milliseconds (60000-1200000)', '300000')
    .option('--max-iterations <num>', 'maximum Claude iterations (1-50)', '10')
    .option('--max-turns <num>', 'maximum conversation turns (1-100)', '5')
    .option('--model <model>', 'Claude model (sonnet|opus|full-model-name)', 'sonnet')
    .option('--output-format <format>', 'output format (text|json|stream-json)', 'text')
    .option('--permission-mode <mode>', 'permission handling (acceptEdits|bypassPermissions|default|plan)', 'bypassPermissions')
    .option('--dangerously-skip-permissions', 'skip permission prompts (dev mode)')
    .option('--continue-session', 'resume most recent conversation')
    .option('--skip-claude-check', 'skip Claude availability check')
    .action(async (directory, options, command) => {
      try {
        // Get configuration from command context
        const config = options._config as TodoqConfig;
        
        // Deep copy the config to avoid mutations
        const claudeConfigOverride = JSON.parse(JSON.stringify(config));
        
        // Ensure claude config exists with defaults from file config
        if (!claudeConfigOverride.claude) {
          claudeConfigOverride.claude = {};
        }

        // Apply command-line options only if explicitly provided
        if (options.testTimeout !== undefined) {
          claudeConfigOverride.claude.testTimeout = parseInt(options.testTimeout);
        }
        if (options.maxIterations !== undefined) {
          claudeConfigOverride.claude.maxIterations = parseInt(options.maxIterations);
        }
        if (options.maxTurns !== undefined) {
          claudeConfigOverride.claude.maxTurns = parseInt(options.maxTurns);
        }
        if (options.model !== undefined) {
          claudeConfigOverride.claude.model = options.model;
        }
        if (options.outputFormat !== undefined) {
          claudeConfigOverride.claude.outputFormat = options.outputFormat;
        }
        if (options.permissionMode !== undefined) {
          claudeConfigOverride.claude.permissionMode = options.permissionMode;
        }
        const rootOptions = command.parent?.opts() || {};
        if (options.verbose || rootOptions.verbose) {
          claudeConfigOverride.claude.verbose = true;
        }
        if (options.dangerouslySkipPermissions) {
          claudeConfigOverride.claude.dangerouslySkipPermissions = true;
        }
        if (options.continueSession) {
          claudeConfigOverride.claude.continueSession = true;
        }
        
        // Get Claude service instance with configuration
        const claudeService = getClaudeService(undefined, undefined, claudeConfigOverride);
        
        // Check Claude availability unless skipped
        if (!options.skipClaudeCheck) {
          if (options.verbose) {
            console.log(chalk.blue('Checking Claude availability...'));
          }
          
          const isAvailable = await claudeService.isAvailable();
          if (!isAvailable) {
            console.error(chalk.red('✗ Claude Code not available'));
            console.error(chalk.yellow('Please ensure Claude is installed and available in PATH'));
            console.error(chalk.yellow('Use --skip-claude-check to bypass this check'));
            process.exit(1);
          }
          
          if (options.verbose) {
            console.log(chalk.green('✓ Claude Code is available'));
          }
        }

        // Execute steps 1-3: Get next task
        if (options.verbose) {
          console.log(chalk.blue('Executing steps 1-3: Getting next task...'));
        }
        
        const context = await claudeService.executeTodoqGetNext(directory);
        
        console.log(chalk.green(`Working on task: ${context.taskJson.number} - ${context.taskJson.name}`));
        if (context.taskJson.description) {
          console.log(chalk.gray(`Description: ${context.taskJson.description}`));
        }
        console.log(chalk.blue(`Remaining tasks: ${context.remainingCount}`));
        console.log('');

        // Execute steps 4-8: Work on task with Claude
        if (options.verbose) {
          console.log(chalk.blue('Executing steps 4-8: Working on task with Claude...'));
        }
        
        const result = await claudeService.executeTodoqNextPrompt(context);
        
        if (result.success) {
          console.log(chalk.green('✓ Task work completed successfully'));
          console.log(chalk.gray(`Duration: ${Math.round(result.duration / 1000)}s`));
          
          if (result.taskNumber && result.taskName) {
            console.log(chalk.green(`✓ Completed: ${result.taskNumber} - ${result.taskName}`));
          }
          
          if (options.verbose && result.output) {
            console.log(chalk.gray('\n--- Claude Output ---'));
            console.log(result.output);
          }
        } else {
          console.error(chalk.red('✗ Task work failed'));
          console.error(chalk.red(`Error: ${result.error}`));
          console.error(chalk.gray(`Duration: ${Math.round(result.duration / 1000)}s`));
          
          if (options.verbose && result.output) {
            console.error(chalk.gray('\n--- Claude Output ---'));
            console.error(result.output);
          }
          
          process.exit(1);
        }
        
      } catch (error) {
        const err = error as Error;
        console.error(chalk.red('✗ Unexpected error:'), err.message);
        
        if (options.verbose && err.stack) {
          console.error(chalk.gray('\n--- Stack Trace ---'));
          console.error(err.stack);
        }
        
        process.exit(1);
      }
    });
}