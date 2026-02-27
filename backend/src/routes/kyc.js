const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const { mintComplianceNFT } = require('../services/kycMinter');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Too many requests' },
});

router.get('/api/kyc/status', async (req, res) => {
    try {
        const { wallet } = req.query;

        if (!wallet || !wallet.startsWith('0x')) {
            return res.status(400).json({ error: 'Valid wallet address required' });
        }

        const normalizedWallet = wallet.toLowerCase();

        const result = await pool.query(
            'SELECT status, nft_token_id, approved_at FROM kyc_status WHERE wallet = $1',
            [normalizedWallet]
        );

        if (result.rows.length === 0) {
            return res.json({ status: 'none', nftTokenId: null });
        }

        const row = result.rows[0];
        return res.json({
            status: row.status,
            nftTokenId: row.nft_token_id || null,
            approvedAt: row.approved_at || null,
        });
    } catch (err) {
        console.error('[KYC] Error checking status:', err.message);
        res.status(500).json({ error: 'Failed to check KYC status' });
    }
});

router.post('/api/kyc/webhook', webhookLimiter, async (req, res) => {
    const webhookSecret = process.env.PERSONA_WEBHOOK_SECRET;

    if (webhookSecret && req.headers['persona-signature']) {
        const signature = req.headers['persona-signature'];
        const rawBody = JSON.stringify(req.body);
        const computed = crypto
            .createHmac('sha256', webhookSecret)
            .update(rawBody)
            .digest('hex');

        if (computed !== signature) {
            console.warn('[KYC Webhook] ⚠ Invalid signature — rejecting');
            return res.status(403).json({ error: 'Invalid signature' });
        }
    }

    res.status(200).json({ received: true });

    const wallet = req.body.wallet || extractPersonaWallet(req.body);
    const inquiryId = req.body.inquiryId || extractPersonaInquiryId(req.body);

    if (!wallet) {
        console.error('[KYC Webhook] No wallet address in payload');
        return;
    }

    const normalizedWallet = wallet.toLowerCase();
    const ref = inquiryId || `mock_${Date.now()}`;

    console.log(`[KYC Webhook] Processing approval for ${normalizedWallet} (ref: ${ref})`);

    setImmediate(async () => {
        try {
            await pool.query(
                `INSERT INTO kyc_status (wallet, status, persona_inquiry_id, approved_at)
                 VALUES ($1, 'approved', $2, NOW())
                 ON CONFLICT (wallet)
                 DO UPDATE SET status = 'approved', persona_inquiry_id = $2, approved_at = NOW()`,
                [normalizedWallet, ref]
            );
            console.log(`[KYC Webhook] ✓ DB updated: ${normalizedWallet} → approved`);

            const result = await mintComplianceNFT(wallet, ref);

            if (result.success) {
                if (result.txHash) {
                    console.log(`[KYC Webhook] ✅ Full KYC flow complete for ${normalizedWallet}`);
                } else if (result.alreadyVerified) {
                    console.log(`[KYC Webhook] ℹ Already verified: ${normalizedWallet}`);
                }
            } else {
                await pool.query(
                    `UPDATE kyc_status SET status = 'mint_failed' WHERE wallet = $1`,
                    [normalizedWallet]
                );
                console.error(`[KYC Webhook] ❌ Mint failed for ${normalizedWallet}: ${result.error}`);
            }
        } catch (err) {
            console.error(`[KYC Webhook] ❌ Processing error:`, err.message);
        }
    });
});

router.post('/api/kyc/mock-approve', webhookLimiter, async (req, res) => {
    const { wallet } = req.body;

    if (!wallet || !wallet.startsWith('0x')) {
        return res.status(400).json({ error: 'Valid wallet address required' });
    }

    const normalizedWallet = wallet.toLowerCase();
    const mockRef = `mock_${Date.now()}`;

    console.log(`[KYC Mock] Simulating approval for ${normalizedWallet}`);

    try {
        await pool.query(
            `INSERT INTO kyc_status (wallet, status, persona_inquiry_id)
             VALUES ($1, 'pending', $2)
             ON CONFLICT (wallet)
             DO UPDATE SET status = 'pending', persona_inquiry_id = $2`,
            [normalizedWallet, mockRef]
        );

        res.json({ status: 'pending', message: 'KYC verification initiated' });

        setImmediate(async () => {
            try {
                await pool.query(
                    `UPDATE kyc_status SET status = 'approved', approved_at = NOW() WHERE wallet = $1`,
                    [normalizedWallet]
                );

                const result = await mintComplianceNFT(wallet, mockRef);

                if (result.success) {
                    console.log(`[KYC Mock] ✅ Mock KYC complete for ${normalizedWallet}`);
                } else {
                    await pool.query(
                        `UPDATE kyc_status SET status = 'mint_failed' WHERE wallet = $1`,
                        [normalizedWallet]
                    );
                    console.error(`[KYC Mock] ❌ Mint failed: ${result.error}`);
                }
            } catch (err) {
                console.error(`[KYC Mock] ❌ Processing error:`, err.message);
            }
        });
    } catch (err) {
        console.error('[KYC Mock] Error:', err.message);
        res.status(500).json({ error: 'Failed to initiate KYC' });
    }
});

function extractPersonaWallet(body) {
    try {
        return body?.data?.attributes?.fields?.wallet_address?.value || null;
    } catch {
        return null;
    }
}

function extractPersonaInquiryId(body) {
    try {
        return body?.data?.id || null;
    } catch {
        return null;
    }
}

module.exports = router;
