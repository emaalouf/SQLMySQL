#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const SQLConverter = require('./sqlConverter');
const DatabaseManager = require('./database');

const program = new Command();
const converter = new SQLConverter();
const dbManager = new DatabaseManager();

program
    .name('sql-to-mysql')
    .description('Convert SQL Server queries to MySQL format and manage MySQL database')
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

// Database Management Commands
program
    .command('db:test')
    .description('Test MySQL database connection')
    .action(async () => {
        try {
            const success = await dbManager.testConnection();
            if (success) {
                const info = await dbManager.getDatabaseInfo();
                console.log(chalk.green('\n📊 Database Information:'));
                console.log(`  Database: ${info.database}`);
                console.log(`  Tables: ${info.tableCount}`);
                console.log(`  Size: ${info.sizeInMB} MB`);
            }
        } catch (error) {
            console.error(chalk.red(`Database test failed: ${error.message}`));
            process.exit(1);
        } finally {
            await dbManager.close();
        }
    });

program
    .command('db:create')
    .description('Create the database if it doesn\'t exist')
    .action(async () => {
        try {
            await dbManager.createDatabase();
            console.log(chalk.green('🎉 Database setup completed!'));
        } catch (error) {
            console.error(chalk.red(`Failed to create database: ${error.message}`));
            process.exit(1);
        } finally {
            await dbManager.close();
        }
    });

program
    .command('db:load')
    .description('Load Soffa data from the MySQL SQL file into the database')
    .option('--file <path>', 'Custom SQL file path (default: SoffaV2CompleteWithData_mysql.sql)')
    .action(async (options) => {
        try {
            if (options.file) {
                const result = await dbManager.executeSQLFile(options.file);
                console.log(chalk.green(`🎉 Custom SQL file loaded successfully!`));
                console.log(chalk.blue(`Executed: ${result.executedCount} statements`));
                if (result.errorCount > 0) {
                    console.log(chalk.yellow(`Errors: ${result.errorCount} statements`));
                }
            } else {
                const result = await dbManager.loadSoffaData();
                console.log(chalk.blue(`Executed: ${result.executedCount} statements`));
                if (result.errorCount > 0) {
                    console.log(chalk.yellow(`Errors: ${result.errorCount} statements`));
                }
            }
        } catch (error) {
            console.error(chalk.red(`Failed to load data: ${error.message}`));
            console.log(chalk.yellow('\n💡 Tips:'));
            console.log('  1. Make sure MySQL is running');
            console.log('  2. Check your .env file credentials');
            console.log('  3. Ensure the SQL file exists');
            console.log('  4. Run "npm run db:create" first if database doesn\'t exist');
            process.exit(1);
        } finally {
            await dbManager.close();
        }
    });

program
    .command('db:info')
    .description('Show database information')
    .action(async () => {
        try {
            const info = await dbManager.getDatabaseInfo();
            console.log(chalk.green('\n📊 Database Information:'));
            console.log(`  Database: ${info.database}`);
            console.log(`  Tables: ${info.tableCount}`);
            console.log(`  Size: ${info.sizeInMB} MB`);
            
            // Get table list
            const result = await dbManager.query(`
                SELECT table_name, table_rows 
                FROM information_schema.tables 
                WHERE table_schema = ? 
                ORDER BY table_name
            `, [process.env.DB_NAME]);
            
            if (result.rows.length > 0) {
                console.log(chalk.cyan('\n📋 Tables:'));
                result.rows.forEach(table => {
                    console.log(`  • ${table.table_name} (${table.table_rows || 0} rows)`);
                });
            }
        } catch (error) {
            console.error(chalk.red(`Failed to get database info: ${error.message}`));
            process.exit(1);
        } finally {
            await dbManager.close();
        }
    });

program
    .command('db:query')
    .description('Execute a custom SQL query')
    .argument('<sql>', 'SQL query to execute')
    .option('--limit <number>', 'Limit number of results (default: 10)', '10')
    .action(async (sql, options) => {
        try {
            const limit = parseInt(options.limit);
            let query = sql;
            
            // Add LIMIT if it's a SELECT query and doesn't already have LIMIT
            if (sql.trim().toLowerCase().startsWith('select') && 
                !sql.toLowerCase().includes('limit')) {
                query += ` LIMIT ${limit}`;
            }
            
            const result = await dbManager.query(query);
            
            if (result.rows.length > 0) {
                console.log(chalk.green(`\n✓ Query executed successfully. Found ${result.rows.length} results:`));
                console.table(result.rows);
            } else {
                console.log(chalk.yellow('Query executed successfully but returned no results.'));
            }
        } catch (error) {
            console.error(chalk.red(`Query failed: ${error.message}`));
            process.exit(1);
        } finally {
            await dbManager.close();
        }
    });

program
    .command('db:count')
    .description('Show row counts for all tables')
    .option('--table <name>', 'Count rows for specific table only')
    .action(async (options) => {
        try {
            if (options.table) {
                // Count specific table
                const result = await dbManager.query(`SELECT COUNT(*) as count FROM \`${options.table}\``);
                console.log(chalk.green(`\n📊 Table: ${options.table}`));
                console.log(`Rows: ${result.rows[0].count}`);
            } else {
                // Count all tables
                const tablesResult = await dbManager.query(`
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = ? 
                    ORDER BY table_name
                `, [process.env.DB_NAME]);
                
                console.log(chalk.green('\n📊 Row counts for all tables:'));
                console.log(chalk.gray('─'.repeat(50)));
                
                let totalRows = 0;
                for (const table of tablesResult.rows) {
                    try {
                        const countResult = await dbManager.query(`SELECT COUNT(*) as count FROM \`${table.table_name}\``);
                        const count = countResult.rows[0].count;
                        totalRows += parseInt(count);
                        
                        const displayCount = count.toLocaleString();
                        console.log(`${table.table_name.padEnd(35)} ${displayCount.padStart(12)}`);
                    } catch (error) {
                        console.log(`${table.table_name.padEnd(35)} ${chalk.red('Error')}`);
                    }
                }
                
                console.log(chalk.gray('─'.repeat(50)));
                console.log(chalk.cyan(`Total rows: ${totalRows.toLocaleString()}`));
            }
        } catch (error) {
            console.error(chalk.red(`Failed to get row counts: ${error.message}`));
            process.exit(1);
        } finally {
            await dbManager.close();
        }
    });

program
    .command('db:sample')
    .description('Show sample data from tables')
    .argument('<table>', 'Table name to sample')
    .option('--limit <number>', 'Number of sample rows (default: 5)', '5')
    .action(async (tableName, options) => {
        try {
            const limit = parseInt(options.limit);
            const result = await dbManager.query(`SELECT * FROM \`${tableName}\` LIMIT ${limit}`);
            
            if (result.rows.length > 0) {
                console.log(chalk.green(`\n📋 Sample data from ${tableName} (${result.rows.length} rows):`));
                console.table(result.rows);
            } else {
                console.log(chalk.yellow(`Table ${tableName} is empty.`));
            }
        } catch (error) {
            console.error(chalk.red(`Failed to sample table: ${error.message}`));
            process.exit(1);
        } finally {
            await dbManager.close();
        }
    });

program
    .command('db:schema')
    .description('Show schema information for a table')
    .argument('<table>', 'Table name')
    .action(async (tableName) => {
        try {
            const result = await dbManager.query(`
                SELECT 
                    COLUMN_NAME,
                    DATA_TYPE,
                    IS_NULLABLE,
                    COLUMN_DEFAULT,
                    COLUMN_KEY,
                    EXTRA
                FROM information_schema.COLUMNS 
                WHERE table_schema = ? AND table_name = ?
                ORDER BY ORDINAL_POSITION
            `, [process.env.DB_NAME, tableName]);
            
            if (result.rows.length > 0) {
                console.log(chalk.green(`\n🗂️  Schema for table: ${tableName}`));
                console.table(result.rows);
            } else {
                console.log(chalk.yellow(`Table ${tableName} not found.`));
            }
        } catch (error) {
            console.error(chalk.red(`Failed to get schema: ${error.message}`));
            process.exit(1);
        } finally {
            await dbManager.close();
        }
    });

// Add some helpful examples
program.on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  # SQL Conversion');
    console.log('  $ node index.js convert myfile.sql');
    console.log('  $ node index.js convert myfile.sql -o converted.sql --stats');
    console.log('  $ node index.js convert myfile.sql --preview');
    console.log('  $ node index.js batch ./sql-files -o ./mysql-files');
    console.log('');
    console.log('  # Database Management');
    console.log('  $ node index.js db:test');
    console.log('  $ node index.js db:create');
    console.log('  $ node index.js db:load');
    console.log('  $ node index.js db:info');
    console.log('  $ node index.js db:count');
    console.log('  $ node index.js db:count --table AbpUsers');
    console.log('  $ node index.js db:sample AbpUsers --limit 10');
    console.log('  $ node index.js db:schema AbpUsers');
    console.log('  $ node index.js db:query "SELECT * FROM AbpUsers WHERE EmailAddress LIKE \'%admin%\'"');
    console.log('');
    console.log('  Note: Configure your database credentials in the .env file');
});

program.parse(); 