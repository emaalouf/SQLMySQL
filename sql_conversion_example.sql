-- SQL Server to MySQL INSERT Query Conversion
-- ===========================================

-- ORIGINAL SQL Server format:
-- INSERT INTO [dbo].[AbpAuditLogs] ([Id], [BrowserInfo], [ClientIpAddress], [ClientName], [CustomData], [Exception], [ExecutionDuration], [ExecutionTime], [ImpersonatorTenantId], [ImpersonatorUserId], [MethodName], [Parameters], [ServiceName], [TenantId], [UserId], [ReturnValue]) VALUES

-- CONVERTED MySQL format (Option 1 - with backticks):
INSERT INTO `AbpAuditLogs` (`Id`, `BrowserInfo`, `ClientIpAddress`, `ClientName`, `CustomData`, `Exception`, `ExecutionDuration`, `ExecutionTime`, `ImpersonatorTenantId`, `ImpersonatorUserId`, `MethodName`, `Parameters`, `ServiceName`, `TenantId`, `UserId`, `ReturnValue`) VALUES

-- CONVERTED MySQL format (Option 2 - without quotes, recommended for standard identifiers):
INSERT INTO AbpAuditLogs (Id, BrowserInfo, ClientIpAddress, ClientName, CustomData, Exception, ExecutionDuration, ExecutionTime, ImpersonatorTenantId, ImpersonatorUserId, MethodName, Parameters, ServiceName, TenantId, UserId, ReturnValue) VALUES

-- Example with actual values:
INSERT INTO AbpAuditLogs (Id, BrowserInfo, ClientIpAddress, ClientName, CustomData, Exception, ExecutionDuration, ExecutionTime, ImpersonatorTenantId, ImpersonatorUserId, MethodName, Parameters, ServiceName, TenantId, UserId, ReturnValue) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Chrome 120.0', '192.168.1.100', 'WebApp', NULL, NULL, 150, '2024-01-15 10:30:00', NULL, NULL, 'GetUsers', '{"pageSize":10}', 'UserService', 1, 123, '{"count":5}');

-- Key conversion rules:
-- 1. Remove [dbo] schema prefix (MySQL uses database.table or just table)
-- 2. Replace square brackets [] with backticks `` (optional) or remove them entirely
-- 3. Keep the same column names and VALUES structure
-- 4. Ensure proper data type compatibility (most ABP audit log types are compatible)

-- Notes for MySQL compatibility:
-- - GUID/uniqueidentifier values should be VARCHAR(36) or CHAR(36)
-- - DateTime values use 'YYYY-MM-DD HH:MM:SS' format
-- - JSON data in CustomData, Parameters, ReturnValue columns work well with MySQL JSON type
-- - NULL values remain the same 