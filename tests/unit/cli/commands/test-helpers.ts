import { Command } from 'commander';

/**
 * Helper to set up command dependencies using Commander's setOptionValue
 * This approach works with Commander's internal option handling
 */
export function setupCommand(program: Command, commandName: string, dependencies: any): void {
    const command = program.commands.find(cmd => cmd.name() === commandName);
    if (command) {
        Object.entries(dependencies).forEach(([key, value]) => {
            command.setOptionValue(key, value);
        });
    }
}

/**
 * Helper to set up nested subcommands (e.g., 'config get', 'config set')
 */
export function setupSubcommand(program: Command, parentName: string, subcommandName: string, dependencies: any): void {
    const parentCommand = program.commands.find(cmd => cmd.name() === parentName);
    if (parentCommand) {
        const subcommand = parentCommand.commands.find(cmd => cmd.name() === subcommandName);
        if (subcommand) {
            Object.entries(dependencies).forEach(([key, value]) => {
                subcommand.setOptionValue(key, value);
            });
        }
    }
}

/**
 * Helper to add global options to all commands
 * Useful for adding --json option which many commands support
 */
export function addGlobalOptions(program: Command): void {
    // Don't add global options - commands already define their own options
    // This function is kept for backward compatibility but does nothing
    // Commands in navigation.ts, stats.ts, etc. already have --json defined
}

/**
 * Helper to setup all commands in a program with the same dependencies
 * Useful when all commands need the same services
 */
export function setupAllCommands(program: Command, dependencies: any): void {
    program.commands.forEach(cmd => {
        Object.entries(dependencies).forEach(([key, value]) => {
            cmd.setOptionValue(key, value);
        });
        
        // Also setup subcommands
        cmd.commands.forEach(subCmd => {
            Object.entries(dependencies).forEach(([key, value]) => {
                subCmd.setOptionValue(key, value);
            });
        });
    });
}