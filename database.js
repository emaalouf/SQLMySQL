require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

class DatabaseManager {
    constructor() {
        this.connection = null;
        this.pool = null;
        this.config = {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
            timeout: parseInt(process.env.DB_TIMEOUT) || 60000,
            multipleStatements: true
        };
    }

    /**
     * Create connection pool for better connection management
     */
    createPool() {
        if (!this.pool) {
            this.pool = mysql.createPool(this.config);
            console.log(chalk.green('✓ MySQL connection pool created'));
        }
        return this.pool;
    }

    /**
     * Create a single connection
     */
    async connect() {
        try {
            if (!this.connection) {
                this.connection = await mysql.createConnection(this.config);
                console.log(chalk.green('✓ Connected to MySQL database'));
            }
            return this.connection;
        } catch (error) {
            console.error(chalk.red('✗ Failed to connect to MySQL:'), error.message);
            throw error;
        }
    }

    /**
     * Test database connection
     */
    async testConnection() {
        try {
            const connection = await this.connect();
            const [rows] = await connection.execute('SELECT 1 as test');
            console.log(chalk.green('✓ Database connection test successful'));
            return true;
        } catch (error) {
            console.error(chalk.red('✗ Database connection test failed:'), error.message);
            return false;
        }
    }

    /**
     * Create database if it doesn't exist
     */
    async createDatabase() {
        try {
            // Connect without specifying database
            const tempConfig = { ...this.config };
            delete tempConfig.database;
            
            const connection = await mysql.createConnection(tempConfig);
            
            // Create database if it doesn't exist
            await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${this.config.database}\``);
            console.log(chalk.green(`✓ Database '${this.config.database}' created or already exists`));
            
            await connection.end();
            return true;
        } catch (error) {
            console.error(chalk.red('✗ Failed to create database:'), error.message);
            throw error;
        }
    }

    /**
     * Execute SQL file
     */
    async executeSQLFile(filePath) {
        try {
            console.log(chalk.blue(`📁 Reading SQL file: ${filePath}`));
            
            // Check if file exists
            const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
            if (!fileExists) {
                throw new Error(`SQL file not found: ${filePath}`);
            }

            // Read SQL file
            const sqlContent = await fs.readFile(filePath, 'utf8');
            
            if (!sqlContent.trim()) {
                throw new Error('SQL file is empty');
            }

            console.log(chalk.blue(`📊 SQL file size: ${(sqlContent.length / 1024 / 1024).toFixed(2)} MB`));

            // Connect to database
            const connection = await this.connect();

            // Split SQL content into individual statements (basic splitting)
            // Note: This is a simple approach and might need refinement for complex SQL
            const statements = sqlContent
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0);

            console.log(chalk.blue(`📋 Found ${statements.length} SQL statements to execute`));

            let executedCount = 0;
            let errorCount = 0;

            // Execute statements in batches to avoid memory issues
            const batchSize = 100;
            for (let i = 0; i < statements.length; i += batchSize) {
                const batch = statements.slice(i, i + batchSize);
                
                for (const statement of batch) {
                    try {
                        await connection.execute(statement);
                        executedCount++;
                        
                        // Show progress every 50 statements
                        if (executedCount % 50 === 0) {
                            console.log(chalk.yellow(`⏳ Executed ${executedCount}/${statements.length} statements...`));
                        }
                    } catch (error) {
                        errorCount++;
                        console.error(chalk.red(`✗ Error executing statement ${executedCount + errorCount}:`), error.message);
                        
                        // Log the problematic statement (first 100 chars)
                        const preview = statement.substring(0, 100) + (statement.length > 100 ? '...' : '');
                        console.error(chalk.gray(`Statement preview: ${preview}`));
                        
                        // Continue with next statement instead of stopping
                        continue;
                    }
                }
            }

            console.log(chalk.green(`✓ SQL file execution completed:`));
            console.log(chalk.green(`  - Successfully executed: ${executedCount} statements`));
            if (errorCount > 0) {
                console.log(chalk.yellow(`  - Errors encountered: ${errorCount} statements`));
            }

            return {
                success: true,
                executedCount,
                errorCount,
                totalStatements: statements.length
            };

        } catch (error) {
            console.error(chalk.red('✗ Failed to execute SQL file:'), error.message);
            throw error;
        }
    }

    /**
     * Load data from the converted MySQL file
     */
    async loadSoffaData() {
        const sqlFile = path.join(__dirname, 'SoffaV2CompleteWithData_mysql.sql');
        
        try {
            // First, create database if it doesn't exist
            await this.createDatabase();
            
            // Then execute the SQL file
            const result = await this.executeSQLFile(sqlFile);
            
            console.log(chalk.green('🎉 Soffa database loaded successfully!'));
            return result;
            
        } catch (error) {
            console.error(chalk.red('✗ Failed to load Soffa data:'), error.message);
            throw error;
        }
    }

    /**
     * Execute a custom query
     */
    async query(sql, params = []) {
        try {
            const connection = await this.connect();
            const [rows, fields] = await connection.execute(sql, params);
            return { rows, fields };
        } catch (error) {
            console.error(chalk.red('✗ Query execution failed:'), error.message);
            throw error;
        }
    }

    /**
     * Get database information
     */
    async getDatabaseInfo() {
        try {
            const connection = await this.connect();
            
            // Get database name
            const [dbInfo] = await connection.execute('SELECT DATABASE() as current_database');
            
            // Get table count
            const [tables] = await connection.execute(`
                SELECT COUNT(*) as table_count 
                FROM information_schema.tables 
                WHERE table_schema = ?
            `, [this.config.database]);
            
            // Get database size
            const [size] = await connection.execute(`
                SELECT 
                    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
                FROM information_schema.tables 
                WHERE table_schema = ?
            `, [this.config.database]);

            return {
                database: dbInfo[0].current_database,
                tableCount: tables[0].table_count,
                sizeInMB: size[0].size_mb || 0
            };
        } catch (error) {
            console.error(chalk.red('✗ Failed to get database info:'), error.message);
            throw error;
        }
    }

    /**
     * Close connection
     */
    async close() {
        try {
            if (this.connection) {
                await this.connection.end();
                this.connection = null;
                console.log(chalk.blue('📴 Database connection closed'));
            }
            if (this.pool) {
                await this.pool.end();
                this.pool = null;
                console.log(chalk.blue('📴 Database pool closed'));
            }
        } catch (error) {
            console.error(chalk.red('✗ Error closing database connection:'), error.message);
        }
    }
}

module.exports = DatabaseManager; 