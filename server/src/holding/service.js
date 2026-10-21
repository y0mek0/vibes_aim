import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  JsonRpcProvider,
  getAddress,
  isAddress,
  id,
  verifyMessage,
} from 'ethers';
import { getHoldingMultiplier } from '../../../client/js/data/holding.js';

const TRANSFER_TOPIC = id('Transfer(address,address,uint256)');
const ZERO_TOPIC = `0x${'0'.repeat(64)}`;
const DEFAULT_BATCH = 20_000;

function b64(value) {
  return Buffer.from(value).toString('base64url');
}
function unb64(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}
function sign(secret, payload) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}
function makeToken(secret, payload) {
  const encoded = b64(JSON.stringify(payload));
  return `${encoded}.${sign(secret, encoded)}`;
}
function readToken(secret, token) {
  if (typeof token !== 'string') return null;
  const [encoded, mac] = token.split('.');
  if (!encoded || !mac) return null;
  const expected = sign(secret, encoded);
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try { return JSON.parse(unb64(encoded)); } catch { return null; }
}

function normalizeWallet(wallet) {
  if (!isAddress(wallet)) return null;
  return getAddress(wallet);
}

function topicAddress(wallet) {
  return `0x${wallet.slice(2).toLowerCase().padStart(64, '0')}`;
}

async function rpcCall(rpcUrl, method, params) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  if (!response.ok) throw new Error(`rpc_http_${response.status}`);
  const json = await response.json();
  if (json.error) throw new Error(json.error.message || 'rpc_error');
  return json.result;
}

function hexBigInt(value) {
  return BigInt(value || '0x0');
}
function hexNumber(value) {
  return Number.parseInt(value || '0x0', 16);
}

async function getTransferEvents({ rpcUrl, contract, wallet, latestBlock, batchSize, historyWindowBlocks }) {
  const addressTopic = topicAddress(wallet);
  const events = new Map();
  const firstBlock = Math.max(0, latestBlock - historyWindowBlocks + 1);
  for (let from = firstBlock; from <= latestBlock; from += batchSize) {
    const to = Math.min(latestBlock, from + batchSize - 1);
    const filters = [
      [TRANSFER_TOPIC, null, addressTopic],
      [TRANSFER_TOPIC, addressTopic, null],
    ];
    for (const topics of filters) {
      const logs = await rpcCall(rpcUrl, 'eth_getLogs', [{ address: contract, fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}`, topics }]);
      for (const log of logs || []) {
        const key = `${log.transactionHash}:${hexNumber(log.logIndex)}`;
        events.set(key, log);
      }
    }
  }
  return [...events.values()].sort((a, b) => {
    const block = hexNumber(a.blockNumber) - hexNumber(b.blockNumber);
    return block || hexNumber(a.logIndex) - hexNumber(b.logIndex);
  });
}

export function createHoldingService(options = {}) {
  const rpcUrl = options.rpcUrl || 'https://rpc.testnet.chain.robinhood.com';
  const chainId = Number(options.chainId || 46630);
  const contract = normalizeWallet(options.contract || '0xcE413504CD82FcF32b290366D57443C6B3213DC9');
  const decimals = Number(options.decimals ?? 18);
  const secret = options.authSecret ?? (process.env.NODE_ENV === 'production' ? '' : 'aim2stock-dev-a2s-secret');
  const batchSize = Number(options.batchSize || 9_999_999);
  const historyWindowBlocks = Number(options.historyWindowBlocks || 30_000_000);
  const cacheMs = Number(options.cacheMs || 60_000);
  const cache = new Map();
  if (!contract) throw new Error('A2S contract address is invalid');
  if (!secret) throw new Error('A2S auth secret is required');

  async function challenge(wallet) {
    const normalized = normalizeWallet(wallet);
    if (!normalized) throw new Error('invalid_wallet');
    const expiresAt = Date.now() + 5 * 60_000;
    const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    const message = [
      'AIM2STOCK A2S Holding verification',
      `Wallet: ${normalized}`,
      `Chain ID: ${chainId}`,
      `Nonce: ${nonce}`,
      `Expires: ${new Date(expiresAt).toISOString()}`,
    ].join('\n');
    const challengeToken = makeToken(secret, { type: 'challenge', wallet: normalized, message, expiresAt });
    return { wallet: normalized, message, challengeToken, expiresAt, chainId, contract };
  }

  async function verify({ wallet, message, signature, challengeToken }) {
    const normalized = normalizeWallet(wallet);
    if (!normalized || typeof message !== 'string' || typeof signature !== 'string') throw new Error('invalid_wallet_proof');
    const challenge = readToken(secret, challengeToken);
    if (!challenge || challenge.type !== 'challenge' || challenge.wallet !== normalized || challenge.message !== message || Date.now() > challenge.expiresAt) {
      throw new Error('invalid_or_expired_challenge');
    }
    const recovered = normalizeWallet(verifyMessage(message, signature));
    if (!recovered || recovered !== normalized) throw new Error('wallet_signature_mismatch');
    const expiresAt = Date.now() + 24 * 60 * 60_000;
    const walletProof = makeToken(secret, { type: 'wallet', wallet: normalized, chainId, expiresAt });
    return { wallet: normalized, walletProof, expiresAt, chainId, contract };
  }

  function readProof(token) {
    const payload = readToken(secret, token);
    if (!payload || payload.type !== 'wallet' || Date.now() > payload.expiresAt || payload.chainId !== chainId || payload.wallet !== normalizeWallet(payload.wallet)) return null;
    return payload;
  }

  async function getStatus(wallet) {
    const normalized = normalizeWallet(wallet);
    if (!normalized) throw new Error('invalid_wallet');
    const now = Date.now();
    const cached = cache.get(normalized);
    if (cached && cached.expiresAt > now) return cached.value;

    const latestBlockHex = await rpcCall(rpcUrl, 'eth_blockNumber', []);
    const latestBlock = hexNumber(latestBlockHex);
    const balanceRaw = hexBigInt(await rpcCall(rpcUrl, 'eth_call', [{ to: contract, data: `0x70a08231${topicAddress(normalized).slice(2)}` }, 'latest']));
    const events = await getTransferEvents({ rpcUrl, contract, wallet: normalized, latestBlock, batchSize, historyWindowBlocks });
    const walletTopic = normalized.toLowerCase();
    const netDelta = events.reduce((sum, log) => {
      const from = `0x${log.topics[1].slice(-40)}`.toLowerCase();
      const to = `0x${log.topics[2].slice(-40)}`.toLowerCase();
      const amount = hexBigInt(log.data);
      return sum + (to === walletTopic ? amount : 0n) - (from === walletTopic ? amount : 0n);
    }, 0n);
    let running = balanceRaw - netDelta;
    if (running < 0n) running = 0n;
    let heldSince = null;
    if (running > 0n) {
      const firstBlock = Math.max(0, latestBlock - historyWindowBlocks + 1);
      const block = await rpcCall(rpcUrl, 'eth_getBlockByNumber', [`0x${firstBlock.toString(16)}`, false]);
      heldSince = hexNumber(block?.timestamp) * 1000;
    }
    for (const log of events) {
      const from = `0x${log.topics[1].slice(-40)}`.toLowerCase();
      const to = `0x${log.topics[2].slice(-40)}`.toLowerCase();
      const amount = hexBigInt(log.data);
      const before = running;
      if (to === normalized.toLowerCase()) running += amount;
      if (from === normalized.toLowerCase()) running -= amount;
      if (before === 0n && running > 0n) {
        const block = await rpcCall(rpcUrl, 'eth_getBlockByNumber', [log.blockNumber, false]);
        heldSince = hexNumber(block?.timestamp) * 1000;
      } else if (running === 0n) {
        heldSince = null;
      }
    }

    const divisor = 10 ** decimals;
    const balance = Number(balanceRaw) / divisor;
    const heldDays = heldSince ? Math.max(0, (now - heldSince) / 86_400_000) : 0;
    const multiplier = getHoldingMultiplier(balance, heldDays);
    const value = {
      verified: true,
      wallet: normalized,
      chainId,
      contract,
      decimals,
      balanceRaw: balanceRaw.toString(),
      balance,
      heldSince: heldSince ? new Date(heldSince).toISOString() : null,
      heldDays,
      multiplier,
      historyWindowBlocks,
      historyLimited: true,
      checkedAt: new Date(now).toISOString(),
    };
    cache.set(normalized, { expiresAt: now + cacheMs, value });
    return value;
  }

  async function getVerifiedStatus(proofToken) {
    const proof = readProof(proofToken);
    if (!proof) return null;
    try { return await getStatus(proof.wallet); } catch { return null; }
  }

  return { challenge, verify, readProof, getStatus, getVerifiedStatus, config: { rpcUrl, chainId, contract, decimals } };
}
