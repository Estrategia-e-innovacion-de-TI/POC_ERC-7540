import { createAccount } from '@turnkey/viem'
import { createPublicClient, createWalletClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { createSmartAccountClient } from 'permissionless'
import { toSimpleSmartAccount } from 'permissionless/accounts'
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { entryPoint07Address } from 'viem/account-abstraction'
import { getPimlicoUrl, isPimlicoConfigured, SEPOLIA_RPC_URL } from '../config'

function createSepoliaPublicClient() {
  return createPublicClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC_URL),
  })
}

/**
 * Builds Turnkey viem account + optional Pimlico smart account.
 * Falls back to the Turnkey EOA if paymaster/bundler setup fails.
 */
export async function createTurnkeySmartAccount({
  httpClient,
  organizationId,
  eoaAddress,
}) {
  const publicClient = createSepoliaPublicClient()

  const turnkeyAccount = await createAccount({
    client: httpClient,
    organizationId,
    signWith: eoaAddress,
    ethereumAddress: eoaAddress,
  })

  if (!isPimlicoConfigured) {
    const eoaWalletClient = createWalletClient({
      account: turnkeyAccount,
      chain: sepolia,
      transport: http(SEPOLIA_RPC_URL),
    })
    return {
      publicClient,
      walletClient: eoaWalletClient,
      account: eoaAddress,
      eoaAddress,
      mode: 'turnkey-eoa',
      warning: 'Pimlico no configurado: usando EOA Turnkey (necesitas ETH Sepolia para gas).',
    }
  }

  try {
    const pimlicoUrl = getPimlicoUrl()
    const pimlicoClient = createPimlicoClient({
      transport: http(pimlicoUrl),
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
    })

    const simpleSmartAccount = await toSimpleSmartAccount({
      owner: turnkeyAccount,
      client: publicClient,
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
    })

    const smartAccountClient = createSmartAccountClient({
      account: simpleSmartAccount,
      client: publicClient,
      chain: sepolia,
      bundlerTransport: http(pimlicoUrl),
      paymaster: pimlicoClient,
      userOperation: {
        estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
      },
    })

    return {
      publicClient,
      walletClient: smartAccountClient,
      account: simpleSmartAccount.address,
      eoaAddress,
      mode: 'aa',
      warning: null,
    }
  } catch (error) {
    const eoaWalletClient = createWalletClient({
      account: turnkeyAccount,
      chain: sepolia,
      transport: http(SEPOLIA_RPC_URL),
    })

    return {
      publicClient,
      walletClient: eoaWalletClient,
      account: eoaAddress,
      eoaAddress,
      mode: 'turnkey-eoa',
      warning: `Smart account no disponible (${error.shortMessage || error.message}). Usando EOA Turnkey; necesitas ETH Sepolia para gas.`,
    }
  }
}
