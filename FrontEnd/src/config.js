export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export const SEPOLIA_CHAIN_ID = '11155111'
export const SEPOLIA_CHAIN_HEX = '0xaa36a7'
export const SEPOLIA_PARAMS = {
  chainId: SEPOLIA_CHAIN_HEX,
  chainName: 'Sepolia',
  nativeCurrency: {
    name: 'Sepolia ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
  blockExplorerUrls: ['https://sepolia.etherscan.io'],
}

export const ENV_VAULT_4626 = import.meta.env.VITE_VAULT_ADDRESS || ''
export const ENV_VAULT_7540 = import.meta.env.VITE_VAULT7540_ADDRESS || ''
export const ENV_ASSET = import.meta.env.VITE_ASSET_ADDRESS || ''

export const SEPOLIA_RPC_URL =
  import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'

export const TURNKEY_ORGANIZATION_ID = import.meta.env.VITE_TURNKEY_ORGANIZATION_ID || ''
export const TURNKEY_AUTH_PROXY_CONFIG_ID = import.meta.env.VITE_TURNKEY_AUTH_PROXY_CONFIG_ID || ''
export const PIMLICO_API_KEY = import.meta.env.VITE_PIMLICO_API_KEY || ''

export const isTurnkeyConfigured = Boolean(
  TURNKEY_ORGANIZATION_ID && TURNKEY_AUTH_PROXY_CONFIG_ID,
)

export const isPimlicoConfigured = Boolean(PIMLICO_API_KEY)

export const isEmailWalletReady = isTurnkeyConfigured && isPimlicoConfigured

export function getPimlicoUrl() {
  return `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_API_KEY}`
}
