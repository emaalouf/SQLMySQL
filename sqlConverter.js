const fs = require('fs');
const path = require('path');
const readline = require('readline');

class SQLConverter {
    constructor() {
        this.conversions = [
            // Remove SQL Server schema prefix [dbo].[table] -> table
            {
                pattern: /\[dbo\]\.\[(\w+)\]/g,
                replacement: '$1'
            },
            // Convert [column] to column (remove square brackets)
            {
                pattern: /\[([^\]]+)\]/g,
                replacement: '$1'
            },
            // Convert GETDATE() to NOW()
            {
                pattern: /GETDATE\(\)/g,
                replacement: 'NOW()'
            },
            // Convert GETUTCDATE() to UTC_TIMESTAMP()
            {
                pattern: /GETUTCDATE\(\)/g,
                replacement: 'UTC_TIMESTAMP()'
            },
            // Convert NEWID() to UUID()
            {
                pattern: /NEWID\(\)/g,
                replacement: 'UUID()'
            },
            // Convert LEN() to LENGTH()
            {
                pattern: /\bLEN\(/g,
                replacement: 'LENGTH('
            },
            // Convert ISNULL() to IFNULL()
            {
                pattern: /\bISNULL\(/g,
                replacement: 'IFNULL('
            },
            // Convert TOP n to LIMIT n (basic conversion)
            {
                pattern: /\bTOP\s+(\d+)\b/gi,
                replacement: 'LIMIT $1'
            }
        ];
    }

    /**
     * Convert SQL Server syntax to MySQL
     * @param {string} sqlContent - The SQL content to convert
     * @returns {string} - Converted MySQL content
     */
    convertToMySQL(sqlContent) {
        let converted = sqlContent;
        
        // Apply all conversions
        this.conversions.forEach(conv => {
            converted = converted.replace(conv.pattern, conv.replacement);
        });

        // Add header comment
        const header = `-- Converted from SQL Server to MySQL\n-- Generated on: ${new Date().toISOString()}\n-- Use with caution and verify before executing\n\n`;
        
        return header + converted;
    }

    /**
     * Read SQL file and convert it
     * @param {string} inputFile - Path to input SQL file
     * @returns {string} - Converted content
     */
    convertFile(inputFile) {
        try {
            const content = fs.readFileSync(inputFile, 'utf8');
            return this.convertToMySQL(content);
        } catch (error) {
            throw new Error(`Error reading file ${inputFile}: ${error.message}`);
        }
    }

    /**
     * Convert SQL file and save to output file
     * @param {string} inputFile - Path to input SQL file
     * @param {string} outputFile - Path to output file
     */
    convertAndSave(inputFile, outputFile) {
        try {
            // Check file size first
            const stats = fs.statSync(inputFile);
            const fileSizeInMB = stats.size / (1024 * 1024);
            
            // Use streaming for files larger than 50MB
            if (fileSizeInMB > 50) {
                return this.convertLargeFileStreaming(inputFile, outputFile);
            } else {
                const convertedContent = this.convertFile(inputFile);
                fs.writeFileSync(outputFile, convertedContent, 'utf8');
                return {
                    success: true,
                    message: `Successfully converted ${inputFile} to ${outputFile}`
                };
            }
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Convert large SQL files using streaming to avoid memory issues
     * @param {string} inputFile - Path to input SQL file
     * @param {string} outputFile - Path to output file
     */
    async convertLargeFileStreaming(inputFile, outputFile) {
        return new Promise((resolve, reject) => {
            try {
                const readStream = fs.createReadStream(inputFile, { encoding: 'utf8' });
                const writeStream = fs.createWriteStream(outputFile, { encoding: 'utf8' });
                
                // Write header
                const header = `-- Converted from SQL Server to MySQL\n-- Generated on: ${new Date().toISOString()}\n-- Use with caution and verify before executing\n\n`;
                writeStream.write(header);
                
                const rl = readline.createInterface({
                    input: readStream,
                    crlfDelay: Infinity
                });
                
                let lineCount = 0;
                let convertedCount = 0;
                
                rl.on('line', (line) => {
                    lineCount++;
                    let convertedLine = line;
                    
                    // Apply conversions line by line
                    let hasConversions = false;
                    this.conversions.forEach(conv => {
                        const beforeConversion = convertedLine;
                        convertedLine = convertedLine.replace(conv.pattern, conv.replacement);
                        if (beforeConversion !== convertedLine) {
                            hasConversions = true;
                        }
                    });
                    
                    if (hasConversions) {
                        convertedCount++;
                    }
                    
                    writeStream.write(convertedLine + '\n');
                    
                    // Progress indicator for large files
                    if (lineCount % 10000 === 0) {
                        process.stdout.write(`\rProcessed ${lineCount} lines...`);
                    }
                });
                
                rl.on('close', () => {
                    writeStream.end();
                    process.stdout.write(`\rProcessed ${lineCount} lines total.\n`);
                    resolve({
                        success: true,
                        message: `Successfully converted ${inputFile} to ${outputFile} (${lineCount} lines processed, ${convertedCount} lines converted)`
                    });
                });
                
                rl.on('error', (error) => {
                    writeStream.destroy();
                    reject(new Error(`Error reading file: ${error.message}`));
                });
                
                writeStream.on('error', (error) => {
                    rl.close();
                    reject(new Error(`Error writing file: ${error.message}`));
                });
                
            } catch (error) {
                reject(new Error(`Error processing large file: ${error.message}`));
            }
        });
    }

    /**
     * Get statistics about the conversion
     * @param {string} originalContent - Original SQL content
     * @param {string} convertedContent - Converted content
     * @returns {object} - Conversion statistics
     */
    getConversionStats(originalContent, convertedContent) {
        const stats = {
            originalLines: originalContent.split('\n').length,
            convertedLines: convertedContent.split('\n').length,
            conversionsApplied: []
        };

        this.conversions.forEach(conv => {
            const matches = originalContent.match(conv.pattern);
            if (matches) {
                stats.conversionsApplied.push({
                    pattern: conv.pattern.toString(),
                    count: matches.length
                });
            }
        });

        return stats;
    }
}

module.exports = SQLConverter; 