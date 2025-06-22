# SQL Server to MySQL Converter

A Node.js command-line tool that converts SQL Server queries to MySQL format. This tool automatically handles common syntax differences between SQL Server and MySQL, making database migration easier.

## Features

- 🔄 **Automatic Conversion**: Converts SQL Server syntax to MySQL format
- 📁 **Single File or Batch Processing**: Convert individual files or entire directories
- 📊 **Conversion Statistics**: Shows what changes were made during conversion
- 👀 **Preview Mode**: Preview conversions before saving
- 🎨 **Colored Output**: Easy-to-read colored terminal output
- ⚡ **Fast Processing**: Efficient regex-based conversions
- 🚀 **Large File Support**: Handles massive files (tested with 1GB+ files) using streaming
- 💾 **Memory Efficient**: Automatically switches to streaming mode for files > 50MB

## Supported Conversions

- `[dbo].[table]` → `table`
- `[column]` → `column` (removes square brackets)
- `GETDATE()` → `NOW()`
- `GETUTCDATE()` → `UTC_TIMESTAMP()`
- `NEWID()` → `UUID()`
- `LEN()` → `LENGTH()`
- `ISNULL()` → `IFNULL()`
- `TOP n` → `LIMIT n`

## Installation

1. **Clone or download** this project
2. **Install dependencies**:
   ```bash
   npm install
   ```

## Usage

### Convert a Single File

```bash
# Basic conversion
node index.js convert input.sql

# Specify output file
node index.js convert input.sql -o output_mysql.sql

# Show conversion statistics
node index.js convert input.sql --stats

# Preview without saving
node index.js convert input.sql --preview
```

### Batch Convert Multiple Files

```bash
# Convert all SQL files in a directory
node index.js batch ./sql-files

# Convert to a different output directory
node index.js batch ./sql-files -o ./mysql-files
```

### Examples

**Converting your AbpAuditLogs INSERT:**

Input (SQL Server):
```sql
INSERT INTO [dbo].[AbpAuditLogs] ([Id], [BrowserInfo], [ClientIpAddress]) 
VALUES ('guid-here', 'Chrome', '192.168.1.1');
```

Output (MySQL):
```sql
-- Converted from SQL Server to MySQL
-- Generated on: 2024-01-15T10:30:00.000Z
-- Use with caution and verify before executing

INSERT INTO AbpAuditLogs (Id, BrowserInfo, ClientIpAddress) 
VALUES ('guid-here', 'Chrome', '192.168.1.1');
```

## Command Reference

### `convert` Command
Convert a single SQL file from SQL Server to MySQL format.

**Syntax:** `node index.js convert <input> [options]`

**Options:**
- `-o, --output <file>`: Output file path (default: `<input>_mysql.sql`)
- `-s, --stats`: Show conversion statistics
- `--preview`: Preview conversion without saving

### `batch` Command
Convert multiple SQL files in a directory.

**Syntax:** `node index.js batch <directory> [options]`

**Options:**
- `-o, --output <dir>`: Output directory (default: same as input)
- `--pattern <pattern>`: File pattern to match (default: `*.sql`)

## Sample Files

The project includes:
- `sample_sqlserver.sql`: Example SQL Server queries for testing
- `sql_conversion_example.sql`: Manual conversion examples and explanations

## Testing the Converter

Try the converter with the included sample file:

```bash
# Test with sample file
node index.js convert sample_sqlserver.sql --stats --preview

# Convert the sample file
node index.js convert sample_sqlserver.sql
```

## Large File Processing

The converter automatically detects large files (> 50MB) and switches to streaming mode:

- **Memory Efficient**: Processes files line-by-line instead of loading into memory
- **Progress Tracking**: Shows progress every 10,000 lines processed
- **Tested Scale**: Successfully tested with 1GB+ files containing millions of lines
- **Automatic Mode**: No configuration needed - automatically detects and handles large files

```bash
# Large file example (will automatically use streaming)
node index.js convert huge-database-dump.sql
# Output: ⚠️ Large file detected (1172.93MB). Using streaming mode...
# Output: Processed 9437868 lines total.
```

## Important Notes

⚠️ **Always review converted SQL before executing!**

- This tool handles common syntax conversions but may not catch all edge cases
- Complex stored procedures, triggers, or advanced SQL Server features may need manual review
- Data type mappings may require adjustment (e.g., `uniqueidentifier` → `VARCHAR(36)`)
- Test converted queries in a development environment first
- For large files (1GB+), spot-check a sample of converted queries before running on production data

## Extending the Converter

To add more conversion rules, edit the `conversions` array in `sqlConverter.js`:

```javascript
{
    pattern: /YOUR_REGEX_PATTERN/g,
    replacement: 'YOUR_REPLACEMENT'
}
```

## License

ISC License - Feel free to use and modify as needed. 