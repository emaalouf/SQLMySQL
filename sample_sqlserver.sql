-- Sample SQL Server queries for testing the converter
-- This file contains typical SQL Server syntax that should be converted to MySQL

-- INSERT with square brackets and schema prefix
INSERT INTO [dbo].[AbpAuditLogs] ([Id], [BrowserInfo], [ClientIpAddress], [ClientName], [CustomData], [Exception], [ExecutionDuration], [ExecutionTime], [ImpersonatorTenantId], [ImpersonatorUserId], [MethodName], [Parameters], [ServiceName], [TenantId], [UserId], [ReturnValue]) 
VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'Chrome 120.0', '192.168.1.100', 'WebApp', NULL, NULL, 150, GETDATE(), NULL, NULL, 'GetUsers', '{"pageSize":10}', 'UserService', 1, 123, '{"count":5}'),
('550e8400-e29b-41d4-a716-446655440001', 'Firefox 119.0', '192.168.1.101', 'MobileApp', NULL, NULL, 75, GETUTCDATE(), NULL, NULL, 'CreateUser', '{"name":"John"}', 'UserService', 1, 124, NULL);

-- SELECT with TOP and various SQL Server functions
SELECT TOP 10 [Id], [BrowserInfo], [ClientIpAddress], LEN([MethodName]) as MethodLength
FROM [dbo].[AbpAuditLogs] 
WHERE [ExecutionTime] >= GETDATE() - 7
  AND ISNULL([Exception], '') = ''
  AND [UserId] IS NOT NULL;

-- UPDATE with square brackets
UPDATE [dbo].[AbpAuditLogs] 
SET [CustomData] = ISNULL([CustomData], '{}'),
    [ReturnValue] = CASE WHEN LEN([ReturnValue]) > 100 THEN LEFT([ReturnValue], 100) ELSE [ReturnValue] END
WHERE [Id] = NEWID();

-- CREATE TABLE with typical SQL Server data types
CREATE TABLE [dbo].[TestTable] (
    [Id] uniqueidentifier DEFAULT NEWID() PRIMARY KEY,
    [Name] nvarchar(255) NOT NULL,
    [Description] ntext NULL,
    [CreatedDate] datetime DEFAULT GETDATE(),
    [ModifiedDate] datetime DEFAULT GETUTCDATE(),
    [IsActive] bit DEFAULT 1
);

-- INSERT with SQL Server functions
INSERT INTO [dbo].[TestTable] ([Id], [Name], [Description], [CreatedDate])
VALUES 
(NEWID(), 'Test Record 1', 'This is a test description', GETDATE()),
(NEWID(), 'Test Record 2', 'Another test with length: ' + CAST(LEN('sample') AS nvarchar), GETUTCDATE()); 