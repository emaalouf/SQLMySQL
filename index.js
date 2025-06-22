#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const SQLConverter = require('./sqlConverter');

const program = new Command();
const converter = new SQLConverter();

program
    .name('sql-to-mysql')
    .description('Convert SQL Server queries to MySQL format')
    .version('1.0.0');

program
    .command('convert')
    .description('Convert a SQL file from SQL Server to MySQL format')
    .argument('<input>', 'Input SQL file path')
    .option('-o, --output <file>', 'Output file path (default: <input>_mysql.sql)')
    .option('-s, --stats', 'Show conversion statistics')
    .option('--preview', 'Preview conversion without saving')
    .action(async (inputFile, options) => {
        try {
            // Check if input file exists
            if (!fs.existsSync(inputFile)) {
                console.error(chalk.red(`Error: Input file "${inputFile}" not found.`));
                process.exit(1);
            }

            // Check file size first to determine processing method
            console.log(chalk.blue(`Converting ${inputFile}...`));
            const stats = fs.statSync(inputFile);
            const fileSizeInMB = stats.size / (1024 * 1024);
            
            // Determine output file path
            const outputFile = options.output || 
                path.join(path.dirname(inputFile), 
                    path.basename(inputFile, path.extname(inputFile)) + '_mysql.sql');

            // Use different processing methods based on file size
            if (fileSizeInMB > 50) {
                console.log(chalk.yellow(`⚠️  Large file detected (${fileSizeInMB.toFixed(2)}MB). Using streaming mode...`));
                
                if (options.preview) {
                    console.log(chalk.yellow('Preview mode not available for large files. Use streaming conversion instead.'));
                    return;
                }
                
                const result = await converter.convertLargeFileStreaming(inputFile, outputFile);
                if (result.success) {
                    console.log(chalk.green(`✓ ${result.message}`));
                } else {
                    console.error(chalk.red(`✗ ${result.message}`));
                    process.exit(1);
                }
                
                if (options.stats) {
                    console.log(chalk.cyan('\n--- Large File Statistics ---'));
                    console.log(`File size: ${fileSizeInMB.toFixed(2)}MB`);
                    console.log('Detailed statistics not available for streaming mode.');
                    console.log('Check the converted file for results.');
                }
            } else {
                // Small file - use memory-based processing
                const originalContent = fs.readFileSync(inputFile, 'utf8');
                const convertedContent = converter.convertToMySQL(originalContent);

                // Preview mode
                if (options.preview) {
                    console.log(chalk.yellow('\n--- Preview (first 20 lines) ---'));
                    const previewLines = convertedContent.split('\n').slice(0, 20);
                    previewLines.forEach((line, index) => {
                        console.log(chalk.gray(`${index + 1}: `) + line);
                    });
                    if (convertedContent.split('\n').length > 20) {
                        console.log(chalk.gray('... (truncated)'));
                    }
                    return;
                }

                // Save converted content
                fs.writeFileSync(outputFile, convertedContent, 'utf8');
                console.log(chalk.green(`✓ Successfully converted to ${outputFile}`));

                // Show statistics if requested
                if (options.stats) {
                    const conversionStats = converter.getConversionStats(originalContent, convertedContent);
                    console.log(chalk.cyan('\n--- Conversion Statistics ---'));
                    console.log(`Original lines: ${conversionStats.originalLines}`);
                    console.log(`Converted lines: ${conversionStats.convertedLines}`);
                    console.log(`Conversions applied: ${conversionStats.conversionsApplied.length}`);
                    
                    if (conversionStats.conversionsApplied.length > 0) {
                        console.log(chalk.cyan('\nConversions made:'));
                        conversionStats.conversionsApplied.forEach(conv => {
                            console.log(`  • ${conv.pattern}: ${conv.count} matches`);
                        });
                    }
                }
            }

        } catch (error) {
            console.error(chalk.red(`Error: ${error.message}`));
            process.exit(1);
        }
    });

program
    .command('batch')
    .description('Convert multiple SQL files in a directory')
    .argument('<directory>', 'Directory containing SQL files')
    .option('-o, --output <dir>', 'Output directory (default: same as input)')
    .option('--pattern <pattern>', 'File pattern to match (default: *.sql)', '*.sql')
    .action(async (directory, options) => {
        try {
            if (!fs.existsSync(directory)) {
                console.error(chalk.red(`Error: Directory "${directory}" not found.`));
                process.exit(1);
            }

            const outputDir = options.output || directory;
            const pattern = options.pattern;
            
            // Create output directory if it doesn't exist
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Find SQL files
            const files = fs.readdirSync(directory)
                .filter(file => file.toLowerCase().endsWith('.sql'))
                .map(file => path.join(directory, file));

            if (files.length === 0) {
                console.log(chalk.yellow('No SQL files found in the directory.'));
                return;
            }

            console.log(chalk.blue(`Found ${files.length} SQL files to convert...`));

            let successCount = 0;
            let errorCount = 0;

            for (const inputFile of files) {
                try {
                    const filename = path.basename(inputFile, '.sql');
                    const outputFile = path.join(outputDir, `${filename}_mysql.sql`);
                    
                    const result = await converter.convertAndSave(inputFile, outputFile);
                    
                    if (result.success) {
                        console.log(chalk.green(`✓ ${path.basename(inputFile)}`));
                        successCount++;
                    } else {
                        console.log(chalk.red(`✗ ${path.basename(inputFile)}: ${result.message}`));
                        errorCount++;
                    }
                } catch (error) {
                    console.log(chalk.red(`✗ ${path.basename(inputFile)}: ${error.message}`));
                    errorCount++;
                }
            }

            console.log(chalk.cyan(`\nBatch conversion complete:`));
            console.log(chalk.green(`  Success: ${successCount}`));
            if (errorCount > 0) {
                console.log(chalk.red(`  Errors: ${errorCount}`));
            }

        } catch (error) {
            console.error(chalk.red(`Error: ${error.message}`));
            process.exit(1);
        }
    });

// Add some helpful examples
program.on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  $ node index.js convert myfile.sql');
    console.log('  $ node index.js convert myfile.sql -o converted.sql --stats');
    console.log('  $ node index.js convert myfile.sql --preview');
    console.log('  $ node index.js batch ./sql-files -o ./mysql-files');
});

program.parse(); 