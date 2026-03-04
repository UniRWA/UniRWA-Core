import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Maps common Solidity revert reason strings to user-friendly error messages.
 * Use in every catch block that shows an error toast.
 */
export function parseRevertReason(error: unknown): string {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown error';

  // Wallet-level rejections
  if (msg.includes('User rejected') || msg.includes('user rejected'))
    return 'Transaction was rejected in your wallet.';

  // ERC-20 / balance errors
  if (msg.includes('transfer amount exceeds balance') || msg.includes('exceeds balance'))
    return 'Not enough USDC in your wallet.';
  if (msg.includes('insufficient allowance'))
    return 'Token approval required — please try again.';

  // Soulbound / NFT
  if (msg.includes('non-transferable') || msg.includes('Soulbound'))
    return 'This NFT cannot be transferred.';

  // KYC
  if (msg.includes('Not verified') || msg.includes('KYC required'))
    return 'Please complete KYC verification first.';

  // Slippage
  if (msg.includes('Slippage exceeded') || msg.includes('slippage'))
    return 'Price moved too much. Try increasing slippage tolerance.';

  // Faucet cooldown
  if (msg.includes('Wait 24h') || msg.includes('24h') || msg.includes('cooldown'))
    return 'Faucet used recently. Come back in 24 hours.';

  // AMM / liquidity
  if (msg.includes('Pool not initialized'))
    return 'No liquidity available for this pair.';
  if (msg.includes('price deviation'))
    return 'Oracle price check failed — AMM price too far from NAV.';

  // Pool deposit
  if (msg.includes('Below minimum'))
    return 'Amount is below the minimum deposit.';

  // Orderbook
  if (msg.includes('Not order owner'))
    return 'You can only cancel your own orders.';
  if (msg.includes('Order not active'))
    return 'This order is no longer active.';
  if (msg.includes('Amount must be positive'))
    return 'Amount must be greater than 0.';

  // Default
  return 'Transaction failed. Please try again.';
}
