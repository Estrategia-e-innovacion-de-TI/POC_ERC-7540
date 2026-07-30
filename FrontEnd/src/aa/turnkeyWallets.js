/**
 * Finds the first Ethereum address in Turnkey wallets (embedded preferred).
 */
export function findEmbeddedEthAddress(wallets = []) {
  const allAccounts = []

  for (const wallet of wallets) {
    for (const account of wallet.accounts || []) {
      const address = account?.address
      if (typeof address === 'string' && address.startsWith('0x') && address.length === 42) {
        allAccounts.push({
          address,
          source: wallet.source,
          addressFormat: account.addressFormat,
        })
      }
    }
  }

  const embedded = allAccounts.find(
    (item) =>
      item.source === 'embedded' &&
      (!item.addressFormat || item.addressFormat.includes('ETHEREUM') || item.address.startsWith('0x')),
  )
  if (embedded) return embedded.address

  const anyEth = allAccounts.find((item) => item.address.startsWith('0x'))
  return anyEth?.address || null
}

/**
 * Ensures the authenticated Turnkey user has an embedded Ethereum wallet.
 */
export async function ensureEmbeddedEthWallet({
  wallets,
  createWallet,
  refreshWallets,
}) {
  let currentWallets = wallets || []
  let existing = findEmbeddedEthAddress(currentWallets)

  if (!existing && typeof refreshWallets === 'function') {
    currentWallets = (await refreshWallets()) || []
    existing = findEmbeddedEthAddress(currentWallets)
  }

  if (existing) return existing

  if (typeof createWallet !== 'function') {
    throw new Error('Turnkey createWallet no disponible en esta sesion.')
  }

  await createWallet({
    walletName: `Vault Console ${Date.now()}`,
    accounts: ['ADDRESS_FORMAT_ETHEREUM'],
  })

  const refreshed = (await refreshWallets()) || []
  const created = findEmbeddedEthAddress(refreshed)
  if (!created) {
    throw new Error(
      `No se pudo crear una wallet Ethereum embebida. Wallets: ${JSON.stringify(
        (refreshed || []).map((w) => ({
          source: w.source,
          accounts: (w.accounts || []).map((a) => a.address),
        })),
      )}`,
    )
  }
  return created
}
