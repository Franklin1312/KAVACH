const { ethers } = require('ethers');
const crypto = require('crypto');

// ─── Sepolia ETH Testnet Configuration ─────────────────────────────────────
const RPC_URL = process.env.POLYGON_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const PRIVATE_KEY = process.env.POLYGON_PRIVATE_KEY;
const EXPLORER_BASE = 'https://sepolia.etherscan.io/tx';

/**
 * Check if blockchain logging is available
 */
function isBlockchainEnabled() {
  return !!PRIVATE_KEY && PRIVATE_KEY !== 'your_polygon_private_key';
}

/**
 * Generate a SHA-256 hash of the payout receipt data
 * @param {Object} payoutData - The payout receipt to hash
 * @returns {string} The hex-encoded SHA-256 hash
 */
function hashPayoutReceipt(payoutData) {
  const payload = JSON.stringify(payoutData, Object.keys(payoutData).sort());
  return '0x' + crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Log a payout receipt hash on the Polygon Amoy Testnet.
 * 
 * We send a minimal self-transfer (0 value) with the SHA-256 hash
 * embedded in the transaction's `data` field. This creates an immutable,
 * publicly verifiable record on the blockchain.
 * 
 * @param {Object} claimData - Payout receipt data
 * @param {string} claimData.claimId - MongoDB claim ID
 * @param {string} claimData.workerId - MongoDB worker ID
 * @param {number} claimData.amount - Payout amount in INR
 * @param {string} claimData.triggerType - Type of disruption trigger
 * @param {number} claimData.triggerLevel - Severity level (1-4)
 * @param {number} claimData.fraudScore - Fraud engine score
 * @param {string} claimData.razorpayRef - Razorpay payout reference ID
 * @param {string} claimData.timestamp - ISO timestamp of payout
 * @returns {Object} { txHash, payoutHash, explorerUrl } or null on failure
 */
async function logPayoutOnChain(claimData) {
  if (!isBlockchainEnabled()) {
    console.log('[BLOCKCHAIN] Skipped — no POLYGON_PRIVATE_KEY configured');
    return null;
  }

  try {
    // 1. Hash the payout receipt
    const payoutHash = hashPayoutReceipt(claimData);
    console.log(`[BLOCKCHAIN] Payout hash: ${payoutHash}`);

    // 2. Connect to Polygon Amoy
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    // 3. Send a 0-value transaction with the RAW JSON in the data field
    //    We stringify the data so it's readable directly on Etherscan!
    const jsonPayload = JSON.stringify(claimData);
    const tx = await wallet.sendTransaction({
      to: wallet.address,
      value: 0,
      data: ethers.toUtf8Bytes(jsonPayload),
    });

    console.log(`[BLOCKCHAIN] Tx submitted: ${tx.hash}`);

    // 4. Wait for 1 confirmation (usually ~2 seconds on Amoy)
    const receipt = await tx.wait(1);
    const explorerUrl = `${EXPLORER_BASE}/${receipt.hash}`;

    console.log(`[BLOCKCHAIN] ✅ Payout logged on Sepolia ETH: ${explorerUrl}`);

    return {
      txHash: receipt.hash,
      payoutHash,
      explorerUrl,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };
  } catch (err) {
    // Non-fatal: payout still succeeds even if blockchain logging fails
    console.error('[BLOCKCHAIN] ❌ On-chain logging failed (non-fatal):', err.message);
    return null;
  }
}

module.exports = { logPayoutOnChain, hashPayoutReceipt, isBlockchainEnabled };
