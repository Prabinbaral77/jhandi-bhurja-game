// Env for tests only. The database is swapped for in-process PGlite in each test file.
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test'
process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret-0000'
process.env.LOG_LEVEL = 'error'
