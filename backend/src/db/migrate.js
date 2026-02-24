require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { Pool } = require('pg');

async function migrate() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    console.log('[Migration] Connecting to database...');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. assets table
        await client.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(100),
        issuer VARCHAR(100),
        mock_address VARCHAR(42),
        nav DECIMAL(18, 8),
        yield_apy DECIMAL(6, 4),
        tvl BIGINT DEFAULT 0,
        min_investment BIGINT DEFAULT 0,
        asset_type VARCHAR(50),
        last_updated TIMESTAMP DEFAULT NOW()
      );
    `);
        console.log('[Migration] ✓ assets table');

        // 2. kyc_status table
        await client.query(`
      CREATE TABLE IF NOT EXISTS kyc_status (
        wallet VARCHAR(42) PRIMARY KEY,
        status VARCHAR(20) DEFAULT 'pending',
        persona_inquiry_id VARCHAR(100),
        nft_token_id INT,
        approved_at TIMESTAMP
      );
    `);
        console.log('[Migration] ✓ kyc_status table');

        // 3. events table with unique constraint for indexer dedup
        await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        contract VARCHAR(50),
        event_name VARCHAR(100),
        tx_hash VARCHAR(66),
        wallet VARCHAR(42),
        data JSONB,
        block_number BIGINT,
        timestamp TIMESTAMP DEFAULT NOW(),
        UNIQUE(tx_hash, event_name)
      );
    `);
        console.log('[Migration] ✓ events table');

        // 4. user_positions table
        await client.query(`
      CREATE TABLE IF NOT EXISTS user_positions (
        wallet VARCHAR(42),
        asset_symbol VARCHAR(20),
        pool_address VARCHAR(42),
        token_balance DECIMAL(36, 18) DEFAULT 0,
        usdc_value DECIMAL(18, 2) DEFAULT 0,
        yield_earned DECIMAL(18, 2) DEFAULT 0,
        last_updated TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (wallet, asset_symbol, pool_address)
      );
    `);
        console.log('[Migration] ✓ user_positions table');

        // 5. indexer_state table
        await client.query(`
      CREATE TABLE IF NOT EXISTS indexer_state (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT
      );
    `);
        console.log('[Migration] ✓ indexer_state table');

        // index on kyc_status.wallet (queried on every deposit)
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_kyc_wallet ON kyc_status(wallet);
    `);
        console.log('[Migration] ✓ idx_kyc_wallet index');

        // seed the 3 RWA assets
        await client.query(`
      INSERT INTO assets (symbol, name, issuer, mock_address, nav, yield_apy, tvl, min_investment, asset_type)
      VALUES
        ('BUIDL', 'BlackRock USD Institutional Fund', 'BlackRock (via Securitize)', '0xEf2884E786195CF757dEe96a6D6c7735aEA53B23', 1.00450000, 4.5000, 500000000, 50000, 'Treasury Money Market'),
        ('BENJI', 'Franklin OnChain US Government Fund', 'Franklin Templeton', '0xFC4e6f255e6B2aEFEb9199f3CD85E832DA6137Ba', 1.00810000, 4.8500, 350000000, 25000, 'Government Money Market'),
        ('OUSG', 'Ondo Short-Term US Government Bond Fund', 'Ondo Finance', '0x146617c34A7De9edd9bbBA33053FDfD75eDBe511', 1.00230000, 4.8000, 200000000, 100000, 'Bond Fund')
      ON CONFLICT (symbol) DO UPDATE SET
        name = EXCLUDED.name,
        issuer = EXCLUDED.issuer,
        mock_address = EXCLUDED.mock_address,
        asset_type = EXCLUDED.asset_type;
    `);
        console.log('[Migration] ✓ Seeded 3 assets (BUIDL, BENJI, OUSG)');

        // seed indexer_state
        await client.query(`
      INSERT INTO indexer_state (key, value)
      VALUES ('lastIndexedBlock', '0')
      ON CONFLICT (key) DO NOTHING;
    `);
        console.log('[Migration] ✓ Seeded indexer_state');

        await client.query('COMMIT');
        console.log('\n[Migration] ✅ All migrations completed successfully!\n');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Migration] ❌ Migration failed:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch(() => process.exit(1));
