import { useEffect, useMemo, useState } from 'react'
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  getAddress,
  isAddress,
  parseAbi,
  parseUnits,
} from 'viem'
import { sepolia } from 'viem/chains'
import './App.css'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const VAULT_ABI = parseAbi([
  'function asset() view returns (address)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function previewWithdraw(uint256 assets) view returns (uint256)',
  'function deposit(uint256 assets, address receiver) returns (uint256)',
  'function withdraw(uint256 assets, address receiver, address owner) returns (uint256)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256)',
])

const VAULT_7540_ABI = parseAbi([
  'function asset() view returns (address)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function nextRequestId() view returns (uint256)',
  'function requestDeposit(uint256 assets, address controller, address owner) returns (uint256)',
  'function requestRedeem(uint256 shares, address controller, address owner) returns (uint256)',
  'function claimDeposit(uint256 requestId, address receiver) returns (uint256)',
  'function claimRedeem(uint256 requestId, address receiver) returns (uint256)',
])

const ERC20_ABI = parseAbi([
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function mint(address to, uint256 amount)',
])

const SEPOLIA_CHAIN_ID = '11155111'
const SEPOLIA_CHAIN_HEX = '0xaa36a7'
const SEPOLIA_PARAMS = {
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

const ENV_VAULT_4626 = import.meta.env.VITE_VAULT_ADDRESS || ''
const ENV_VAULT_7540 = import.meta.env.VITE_VAULT7540_ADDRESS || ''
const ENV_ASSET = import.meta.env.VITE_ASSET_ADDRESS || ''

function shortAddress(value) {
  if (!value || value.length < 10) return value || '-'
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function safeFormat(value, decimals = 18, digits = 6) {
  try {
    const text = formatUnits(value, decimals)
    const [head, tail = ''] = text.split('.')
    if (!tail) return head
    return `${head}.${tail.slice(0, digits)}`
  } catch {
    return '0'
  }
}

function App() {
  const [activeVaultView, setActiveVaultView] = useState('erc4626')

  const [publicClient, setPublicClient] = useState(null)
  const [walletClient, setWalletClient] = useState(null)
  const [account, setAccount] = useState('')
  const [chainId, setChainId] = useState('')
  const [status, setStatus] = useState('Conecta tu wallet para iniciar.')

  const vaultAddress = ENV_VAULT_4626
  const [assetAddressInput, setAssetAddressInput] = useState(ENV_ASSET)

  const vault7540Address = ENV_VAULT_7540
  const [asset7540AddressInput, setAsset7540AddressInput] = useState(ENV_ASSET)

  const [vaultName, setVaultName] = useState('-')
  const [vaultSymbol, setVaultSymbol] = useState('-')
  const [vaultDecimals, setVaultDecimals] = useState(18)
  const [assetSymbol, setAssetSymbol] = useState('-')
  const [assetDecimals, setAssetDecimals] = useState(18)

  const [totalAssets, setTotalAssets] = useState(0n)
  const [totalSupply, setTotalSupply] = useState(0n)
  const [sharesBalance, setSharesBalance] = useState(0n)
  const [assetBalance, setAssetBalance] = useState(0n)
  const [assetAllowance, setAssetAllowance] = useState(0n)

  const [vault7540Name, setVault7540Name] = useState('-')
  const [vault7540Symbol, setVault7540Symbol] = useState('-')
  const [vault7540Decimals, setVault7540Decimals] = useState(18)
  const [asset7540Symbol, setAsset7540Symbol] = useState('-')
  const [asset7540Decimals, setAsset7540Decimals] = useState(18)
  const [totalAssets7540, setTotalAssets7540] = useState(0n)
  const [totalSupply7540, setTotalSupply7540] = useState(0n)
  const [sharesBalance7540, setSharesBalance7540] = useState(0n)
  const [assetBalance7540, setAssetBalance7540] = useState(0n)
  const [assetAllowance7540, setAssetAllowance7540] = useState(0n)
  const [nextRequestId7540, setNextRequestId7540] = useState(0n)

  const [copwQueryWallet, setCopwQueryWallet] = useState('')
  const [copwQueryBalance, setCopwQueryBalance] = useState(0n)

  const [approveAmount, setApproveAmount] = useState('')
  const [mintRecipient, setMintRecipient] = useState('')
  const [mintAmount, setMintAmount] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [redeemAmount, setRedeemAmount] = useState('')

  const [approveAmount7540, setApproveAmount7540] = useState('')
  const [requestDepositAmount7540, setRequestDepositAmount7540] = useState('')
  const [claimDepositId7540, setClaimDepositId7540] = useState('')
  const [requestRedeemAmount7540, setRequestRedeemAmount7540] = useState('')
  const [claimRedeemId7540, setClaimRedeemId7540] = useState('')

  const hasWallet = typeof window !== 'undefined' && typeof window.ethereum !== 'undefined'
  const isSepolia = chainId === SEPOLIA_CHAIN_ID

  const vaultReady = useMemo(
    () => vaultAddress && vaultAddress !== ZERO_ADDRESS && account && isSepolia,
    [vaultAddress, account, isSepolia],
  )

  const vault7540Ready = useMemo(
    () => vault7540Address && vault7540Address !== ZERO_ADDRESS && account && isSepolia,
    [vault7540Address, account, isSepolia],
  )

  const activeVaultReady = activeVaultView === 'erc4626' ? vaultReady : vault7540Ready

  function getClients() {
    const transport = custom(window.ethereum)
    return {
      publicClient: createPublicClient({ chain: sepolia, transport }),
      walletClient: createWalletClient({ chain: sepolia, transport }),
    }
  }

  async function syncChainId() {
    const hexChainId = await window.ethereum.request({ method: 'eth_chainId' })
    const decimal = parseInt(hexChainId, 16).toString()
    setChainId(decimal)
    return decimal
  }

  async function ensureSepolia() {
    if (!hasWallet) return false

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_HEX }],
      })
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [SEPOLIA_PARAMS],
        })
      } else {
        setStatus('Debes cambiar la wallet a Sepolia para usar esta aplicacion.')
        return false
      }
    }

    const currentChainId = await syncChainId()
    if (currentChainId !== SEPOLIA_CHAIN_ID) {
      setStatus('Red invalida. Esta aplicacion funciona unicamente en Sepolia.')
      return false
    }

    return true
  }

  async function connectWallet() {
    if (!hasWallet) {
      setStatus('No se detecto wallet inyectada. Instala MetaMask o Rabby.')
      return
    }

    try {
      const sep = await ensureSepolia()
      if (!sep) return

      const clients = getClients()
      const addresses = await clients.walletClient.requestAddresses()
      if (!addresses.length) {
        setStatus('No se recibio ninguna cuenta de la wallet.')
        return
      }

      const currentAccount = getAddress(addresses[0])
      setPublicClient(clients.publicClient)
      setWalletClient(clients.walletClient)
      setAccount(currentAccount)
      setMintRecipient(currentAccount)
      setCopwQueryWallet(currentAccount)
      setStatus('Wallet conectada con viem en Sepolia. Direcciones cargadas desde variables de entorno.')
    } catch (error) {
      setStatus(`Error conectando wallet: ${error.shortMessage || error.message}`)
    }
  }

  async function refreshData() {
    if (!publicClient || !walletClient || !account) {
      setStatus('Primero conecta tu wallet.')
      return
    }
    const sep = await ensureSepolia()
    if (!sep) return

    if (!isAddress(vaultAddress) || vaultAddress === ZERO_ADDRESS) {
      setStatus('Configura VITE_VAULT_ADDRESS con una direccion valida en FrontEnd/.env.')
      return
    }

    try {
      const vaultAddr = getAddress(vaultAddress)
      const resolvedAsset = await publicClient.readContract({
        address: vaultAddr,
        abi: VAULT_ABI,
        functionName: 'asset',
      })

      const assetAddress = isAddress(assetAddressInput)
        ? getAddress(assetAddressInput)
        : getAddress(resolvedAsset)

      const [
        loadedVaultName,
        loadedVaultSymbol,
        loadedVaultDecimals,
        loadedTotalAssets,
        loadedTotalSupply,
        loadedSharesBalance,
        loadedAssetSymbol,
        loadedAssetDecimals,
        loadedAssetBalance,
        loadedAssetAllowance,
      ] = await Promise.all([
        publicClient.readContract({ address: vaultAddr, abi: VAULT_ABI, functionName: 'name' }),
        publicClient.readContract({ address: vaultAddr, abi: VAULT_ABI, functionName: 'symbol' }),
        publicClient.readContract({ address: vaultAddr, abi: VAULT_ABI, functionName: 'decimals' }),
        publicClient.readContract({ address: vaultAddr, abi: VAULT_ABI, functionName: 'totalAssets' }),
        publicClient.readContract({ address: vaultAddr, abi: VAULT_ABI, functionName: 'totalSupply' }),
        publicClient.readContract({
          address: vaultAddr,
          abi: VAULT_ABI,
          functionName: 'balanceOf',
          args: [account],
        }),
        publicClient.readContract({ address: assetAddress, abi: ERC20_ABI, functionName: 'symbol' }),
        publicClient.readContract({ address: assetAddress, abi: ERC20_ABI, functionName: 'decimals' }),
        publicClient.readContract({
          address: assetAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [account],
        }),
        publicClient.readContract({
          address: assetAddress,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [account, vaultAddr],
        }),
      ])

      setVaultName(loadedVaultName)
      setVaultSymbol(loadedVaultSymbol)
      setVaultDecimals(Number(loadedVaultDecimals))
      setTotalAssets(loadedTotalAssets)
      setTotalSupply(loadedTotalSupply)
      setSharesBalance(loadedSharesBalance)
      setAssetSymbol(loadedAssetSymbol)
      setAssetDecimals(Number(loadedAssetDecimals))
      setAssetBalance(loadedAssetBalance)
      setAssetAllowance(loadedAssetAllowance)
      setAssetAddressInput(assetAddress)
      setStatus('Datos actualizados correctamente.')
    } catch (error) {
      setStatus(`No se pudo leer contrato: ${error.shortMessage || error.message}`)
    }
  }

  async function refresh7540Data() {
    if (!publicClient || !walletClient || !account) {
      setStatus('Primero conecta tu wallet.')
      return
    }
    const sep = await ensureSepolia()
    if (!sep) return

    if (!isAddress(vault7540Address) || vault7540Address === ZERO_ADDRESS) {
      setStatus('Configura VITE_VAULT7540_ADDRESS con una direccion valida en FrontEnd/.env.')
      return
    }

    try {
      const vaultAddr = getAddress(vault7540Address)
      const resolvedAsset = await publicClient.readContract({
        address: vaultAddr,
        abi: VAULT_7540_ABI,
        functionName: 'asset',
      })

      const assetAddress = isAddress(asset7540AddressInput)
        ? getAddress(asset7540AddressInput)
        : getAddress(resolvedAsset)

      const [
        loadedVaultName,
        loadedVaultSymbol,
        loadedVaultDecimals,
        loadedTotalAssets,
        loadedTotalSupply,
        loadedSharesBalance,
        loadedNextRequestId,
        loadedAssetSymbol,
        loadedAssetDecimals,
        loadedAssetBalance,
        loadedAssetAllowance,
      ] = await Promise.all([
        publicClient.readContract({ address: vaultAddr, abi: VAULT_7540_ABI, functionName: 'name' }),
        publicClient.readContract({ address: vaultAddr, abi: VAULT_7540_ABI, functionName: 'symbol' }),
        publicClient.readContract({ address: vaultAddr, abi: VAULT_7540_ABI, functionName: 'decimals' }),
        publicClient.readContract({ address: vaultAddr, abi: VAULT_7540_ABI, functionName: 'totalAssets' }),
        publicClient.readContract({ address: vaultAddr, abi: VAULT_7540_ABI, functionName: 'totalSupply' }),
        publicClient.readContract({
          address: vaultAddr,
          abi: VAULT_7540_ABI,
          functionName: 'balanceOf',
          args: [account],
        }),
        publicClient.readContract({ address: vaultAddr, abi: VAULT_7540_ABI, functionName: 'nextRequestId' }),
        publicClient.readContract({ address: assetAddress, abi: ERC20_ABI, functionName: 'symbol' }),
        publicClient.readContract({ address: assetAddress, abi: ERC20_ABI, functionName: 'decimals' }),
        publicClient.readContract({
          address: assetAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [account],
        }),
        publicClient.readContract({
          address: assetAddress,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [account, vaultAddr],
        }),
      ])

      setVault7540Name(loadedVaultName)
      setVault7540Symbol(loadedVaultSymbol)
      setVault7540Decimals(Number(loadedVaultDecimals))
      setTotalAssets7540(loadedTotalAssets)
      setTotalSupply7540(loadedTotalSupply)
      setSharesBalance7540(loadedSharesBalance)
      setNextRequestId7540(loadedNextRequestId)
      setAsset7540Symbol(loadedAssetSymbol)
      setAsset7540Decimals(Number(loadedAssetDecimals))
      setAssetBalance7540(loadedAssetBalance)
      setAssetAllowance7540(loadedAssetAllowance)
      setAsset7540AddressInput(assetAddress)
      setStatus('Datos ERC7540 actualizados correctamente.')
    } catch (error) {
      setStatus(`No se pudo leer vault ERC7540: ${error.shortMessage || error.message}`)
    }
  }

  async function writeAndWait(writeConfig) {
    const hash = await walletClient.writeContract(writeConfig)
    setStatus(`Tx enviada: ${hash}`)
    await publicClient.waitForTransactionReceipt({ hash })
    return hash
  }

  async function approveAssets() {
    if (!walletClient || !publicClient || !account || !isAddress(vaultAddress) || !isAddress(assetAddressInput)) {
      setStatus('Conecta wallet y configura vault/asset antes de aprobar.')
      return
    }
    const sep = await ensureSepolia()
    if (!sep) return

    if (!approveAmount || Number(approveAmount) <= 0) {
      setStatus('Ingresa un monto valido para approve.')
      return
    }

    try {
      const amount = parseUnits(approveAmount, assetDecimals)
      await writeAndWait({
        account,
        address: getAddress(assetAddressInput),
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [getAddress(vaultAddress), amount],
      })
      setStatus('Approve confirmado en blockchain.')
      await refreshData()
    } catch (error) {
      setStatus(`Error en approve: ${error.shortMessage || error.message}`)
    }
  }

  async function approveAssets7540() {
    if (!walletClient || !publicClient || !account || !isAddress(vault7540Address) || !isAddress(asset7540AddressInput)) {
      setStatus('Conecta wallet y configura vault ERC7540/asset antes de aprobar.')
      return
    }
    const sep = await ensureSepolia()
    if (!sep) return

    if (!approveAmount7540 || Number(approveAmount7540) <= 0) {
      setStatus('Ingresa un monto valido para approve en ERC7540.')
      return
    }

    try {
      const amount = parseUnits(approveAmount7540, asset7540Decimals)
      await writeAndWait({
        account,
        address: getAddress(asset7540AddressInput),
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [getAddress(vault7540Address), amount],
      })
      setStatus('Approve para ERC7540 confirmado en blockchain.')
      await refresh7540Data()
    } catch (error) {
      setStatus(`Error en approve ERC7540: ${error.shortMessage || error.message}`)
    }
  }

  async function mintCopwForTesting() {
    if (!walletClient || !publicClient || !account || !isAddress(assetAddressInput)) {
      setStatus('Conecta wallet y configura el asset antes de mintear COPW.')
      return
    }
    const sep = await ensureSepolia()
    if (!sep) return

    const recipient = mintRecipient.trim()
    if (!isAddress(recipient)) {
      setStatus('Ingresa una direccion valida para mintear COPW.')
      return
    }

    if (!mintAmount || Number(mintAmount) <= 0) {
      setStatus('Ingresa un monto valido para mintear COPW.')
      return
    }

    try {
      const amount = parseUnits(mintAmount, assetDecimals)
      await writeAndWait({
        account,
        address: getAddress(assetAddressInput),
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [getAddress(recipient), amount],
      })
      setStatus('Mint COPW confirmado para pruebas.')
      await refreshData()
    } catch (error) {
      setStatus(`Error minteando COPW. Verifica que el token soporte mint: ${error.shortMessage || error.message}`)
    }
  }

  async function depositAssets() {
    if (!walletClient || !publicClient || !account || !isAddress(vaultAddress)) {
      setStatus('Conecta wallet y configura la vault antes de depositar.')
      return
    }
    const sep = await ensureSepolia()
    if (!sep) return

    if (!depositAmount || Number(depositAmount) <= 0) {
      setStatus('Ingresa un monto valido para deposit.')
      return
    }

    try {
      const amount = parseUnits(depositAmount, assetDecimals)
      await writeAndWait({
        account,
        address: getAddress(vaultAddress),
        abi: VAULT_ABI,
        functionName: 'deposit',
        args: [amount, account],
      })
      setStatus('Deposit confirmado en blockchain.')
      await refreshData()
    } catch (error) {
      setStatus(`Error en deposit: ${error.shortMessage || error.message}`)
    }
  }

  async function withdrawAssets() {
    if (!walletClient || !publicClient || !account || !isAddress(vaultAddress)) {
      setStatus('Conecta wallet y configura la vault antes de reclamar activos.')
      return
    }

    const sep = await ensureSepolia()
    if (!sep) return

    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      setStatus('Ingresa un monto valido para withdraw.')
      return
    }

    try {
      const vaultAddr = getAddress(vaultAddress)
      const assets = parseUnits(withdrawAmount, assetDecimals)
      const burnPreview = await publicClient.readContract({
        address: vaultAddr,
        abi: VAULT_ABI,
        functionName: 'previewWithdraw',
        args: [assets],
      })

      if (burnPreview > sharesBalance) {
        setStatus('No tienes suficientes shares para reclamar ese monto de activo.')
        return
      }

      await writeAndWait({
        account,
        address: vaultAddr,
        abi: VAULT_ABI,
        functionName: 'withdraw',
        args: [assets, account, account],
      })
      setStatus('Retiro confirmado. Activo subyacente reclamado.')
      await refreshData()
    } catch (error) {
      setStatus(`Error en withdraw: ${error.shortMessage || error.message}`)
    }
  }

  async function redeemShares() {
    if (!walletClient || !publicClient || !account || !isAddress(vaultAddress)) {
      setStatus('Conecta wallet y configura la vault antes de redimir.')
      return
    }
    const sep = await ensureSepolia()
    if (!sep) return

    if (!redeemAmount || Number(redeemAmount) <= 0) {
      setStatus('Ingresa un monto valido para redeem.')
      return
    }

    try {
      const shares = parseUnits(redeemAmount, vaultDecimals)
      await writeAndWait({
        account,
        address: getAddress(vaultAddress),
        abi: VAULT_ABI,
        functionName: 'redeem',
        args: [shares, account, account],
      })
      setStatus('Redeem confirmado en blockchain.')
      await refreshData()
    } catch (error) {
      setStatus(`Error en redeem: ${error.shortMessage || error.message}`)
    }
  }

  async function requestDeposit7540() {
    if (!walletClient || !publicClient || !account || !isAddress(vault7540Address)) {
      setStatus('Conecta wallet y configura la vault ERC7540 antes de requestDeposit.')
      return
    }
    const sep = await ensureSepolia()
    if (!sep) return

    if (!requestDepositAmount7540 || Number(requestDepositAmount7540) <= 0) {
      setStatus('Ingresa un monto valido para requestDeposit ERC7540.')
      return
    }

    try {
      const amount = parseUnits(requestDepositAmount7540, asset7540Decimals)
      await writeAndWait({
        account,
        address: getAddress(vault7540Address),
        abi: VAULT_7540_ABI,
        functionName: 'requestDeposit',
        args: [amount, account, account],
      })
      setStatus('requestDeposit ERC7540 confirmado.')
      await refresh7540Data()
    } catch (error) {
      setStatus(`Error en requestDeposit ERC7540: ${error.shortMessage || error.message}`)
    }
  }

  async function claimDeposit7540() {
    if (!walletClient || !publicClient || !account || !isAddress(vault7540Address)) {
      setStatus('Conecta wallet y configura la vault ERC7540 antes de claimDeposit.')
      return
    }
    const sep = await ensureSepolia()
    if (!sep) return

    if (!claimDepositId7540 || Number(claimDepositId7540) <= 0) {
      setStatus('Ingresa un requestId valido para claimDeposit ERC7540.')
      return
    }

    try {
      await writeAndWait({
        account,
        address: getAddress(vault7540Address),
        abi: VAULT_7540_ABI,
        functionName: 'claimDeposit',
        args: [BigInt(claimDepositId7540), account],
      })
      setStatus('claimDeposit ERC7540 confirmado.')
      await refresh7540Data()
    } catch (error) {
      setStatus(`Error en claimDeposit ERC7540: ${error.shortMessage || error.message}`)
    }
  }

  async function requestRedeem7540() {
    if (!walletClient || !publicClient || !account || !isAddress(vault7540Address)) {
      setStatus('Conecta wallet y configura la vault ERC7540 antes de requestRedeem.')
      return
    }
    const sep = await ensureSepolia()
    if (!sep) return

    if (!requestRedeemAmount7540 || Number(requestRedeemAmount7540) <= 0) {
      setStatus('Ingresa un monto valido para requestRedeem ERC7540.')
      return
    }

    try {
      const shares = parseUnits(requestRedeemAmount7540, vault7540Decimals)
      await writeAndWait({
        account,
        address: getAddress(vault7540Address),
        abi: VAULT_7540_ABI,
        functionName: 'requestRedeem',
        args: [shares, account, account],
      })
      setStatus('requestRedeem ERC7540 confirmado.')
      await refresh7540Data()
    } catch (error) {
      setStatus(`Error en requestRedeem ERC7540: ${error.shortMessage || error.message}`)
    }
  }

  async function claimRedeem7540() {
    if (!walletClient || !publicClient || !account || !isAddress(vault7540Address)) {
      setStatus('Conecta wallet y configura la vault ERC7540 antes de claimRedeem.')
      return
    }
    const sep = await ensureSepolia()
    if (!sep) return

    if (!claimRedeemId7540 || Number(claimRedeemId7540) <= 0) {
      setStatus('Ingresa un requestId valido para claimRedeem ERC7540.')
      return
    }

    try {
      await writeAndWait({
        account,
        address: getAddress(vault7540Address),
        abi: VAULT_7540_ABI,
        functionName: 'claimRedeem',
        args: [BigInt(claimRedeemId7540), account],
      })
      setStatus('claimRedeem ERC7540 confirmado.')
      await refresh7540Data()
    } catch (error) {
      setStatus(`Error en claimRedeem ERC7540: ${error.shortMessage || error.message}`)
    }
  }

  async function queryCopwBalance() {
    if (!publicClient || !isAddress(assetAddressInput)) {
      setStatus('Define una direccion de COPW valida para consultar balance.')
      return
    }

    const wallet = copwQueryWallet.trim()
    if (!isAddress(wallet)) {
      setStatus('Ingresa una billetera valida para consultar COPW.')
      return
    }

    try {
      const value = await publicClient.readContract({
        address: getAddress(assetAddressInput),
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [getAddress(wallet)],
      })
      setCopwQueryBalance(value)
      setStatus('Balance COPW consultado correctamente.')
    } catch (error) {
      setStatus(`Error consultando balance COPW: ${error.shortMessage || error.message}`)
    }
  }

  useEffect(() => {
    if (!hasWallet) return

    const onAccountsChanged = async (accounts) => {
      if (!accounts.length) {
        setAccount('')
        setStatus('Wallet desconectada desde la extension.')
        return
      }
      const next = getAddress(accounts[0])
      setAccount(next)
      if (!mintRecipient) setMintRecipient(next)
      if (!copwQueryWallet) setCopwQueryWallet(next)
      setStatus('Cuenta cambiada. Verifica que sigas en Sepolia y refresca datos.')
    }

    const onChainChanged = async () => {
      await syncChainId()
    }

    window.ethereum.on('accountsChanged', onAccountsChanged)
    window.ethereum.on('chainChanged', onChainChanged)

    return () => {
      window.ethereum.removeListener('accountsChanged', onAccountsChanged)
      window.ethereum.removeListener('chainChanged', onChainChanged)
    }
  }, [hasWallet, mintRecipient, copwQueryWallet])

  return (
    <div className="app-shell">
      <header className="header">
        <div>
          <div className="header-topline">
            <p className="kicker">ERC-7540 / ERC-4626</p>
            <span className="network-badge">SEPOLIA ONLY</span>
          </div>
          <h1>Vault Console (viem)</h1>
          <p className="subtitle">
            Front para conectar wallet y operar contratos desplegados en Sepolia usando viem.
          </p>
        </div>
        <button className="btn primary" type="button" onClick={connectWallet}>
          {account ? `Conectado: ${shortAddress(account)}` : 'Conectar Wallet'}
        </button>
      </header>

      <section className="panel grid-2">
        <article className="card">
          <h2>Conexion</h2>
          <p>
            Red objetivo: <span className="mono">Sepolia (11155111)</span>
          </p>
          <p>
            Chain ID: <strong>{chainId || '-'}</strong>
          </p>
          <p>
            Cuenta: <span className="mono">{account || '-'}</span>
          </p>
        </article>

        <article className="card">
          <h2>Vista de pruebas</h2>
          <div className="tabs-bar" role="tablist" aria-label="Seleccion de vault">
            <button
              type="button"
              className={`btn tab-btn ${activeVaultView === 'erc4626' ? 'primary' : ''}`}
              onClick={() => setActiveVaultView('erc4626')}
            >
              ERC4626
            </button>
            <button
              type="button"
              className={`btn tab-btn ${activeVaultView === 'erc7540' ? 'primary' : ''}`}
              onClick={() => setActiveVaultView('erc7540')}
            >
              ERC7540
            </button>
          </div>
          <p className="hint">
            Vista activa: <strong>{activeVaultView === 'erc4626' ? 'ERC4626 (sincrona)' : 'ERC7540 (asincrona)'}</strong>
          </p>
        </article>
      </section>

      {activeVaultView === 'erc4626' ? (
        <>
          <section className="panel">
            <article className="card action-card guide-card">
              <h3>Guia rapida ERC4626</h3>
              <ol className="guide-list">
                <li>Conecta wallet en Sepolia.</li>
                <li>Verifica en pantalla que las direcciones cargaron desde el archivo .env.</li>
                <li>Haz clic en Refrescar ERC4626 para cargar datos on-chain.</li>
                <li>Opcional: usa Mint COPW para crear saldo de prueba en tu cuenta.</li>
                <li>Ejecuta Approve Asset para autorizar a la vault mover tu COPW.</li>
                <li>Usa Deposit para entrar a la vault y recibir shares.</li>
                <li>Prueba Withdraw para retirar activo por monto.</li>
                <li>Prueba Redeem para canjear shares por activo.</li>
              </ol>
            </article>
          </section>

          <section className="panel">
            <article className="card">
              <h2>Vault ERC4626 (Sincrona)</h2>
              <p>
                Vault ERC4626 (.env): <span className="mono">{vaultAddress || '-'}</span>
              </p>
              <p>
                Asset ERC20 / COPW (.env o autodetect): <span className="mono">{assetAddressInput || '-'}</span>
              </p>
              <button className="btn accent" type="button" onClick={refreshData}>
                Refrescar ERC4626
              </button>
              {!isSepolia && account ? <p>Wallet conectada fuera de Sepolia. Cambia de red para operar.</p> : null}
            </article>
          </section>

          <section className="panel">
            <article className="card stats">
              <h2>Estado Vault ERC4626</h2>
              <div className="stats-grid">
                <div>
                  <span>Vault</span>
                  <strong>{vaultName}</strong>
                </div>
                <div>
                  <span>Share Symbol</span>
                  <strong>{vaultSymbol}</strong>
                </div>
                <div>
                  <span>Asset Symbol</span>
                  <strong>{assetSymbol}</strong>
                </div>
                <div>
                  <span>Total Assets</span>
                  <strong>{safeFormat(totalAssets, assetDecimals)} {assetSymbol}</strong>
                </div>
                <div>
                  <span>Total Supply</span>
                  <strong>{safeFormat(totalSupply, vaultDecimals)} {vaultSymbol}</strong>
                </div>
                <div>
                  <span>Mis Shares</span>
                  <strong>{safeFormat(sharesBalance, vaultDecimals)} {vaultSymbol}</strong>
                </div>
                <div>
                  <span>Mi Balance COPW</span>
                  <strong>{safeFormat(assetBalance, assetDecimals)} {assetSymbol}</strong>
                </div>
                <div>
                  <span>Allowance a Vault</span>
                  <strong>{safeFormat(assetAllowance, assetDecimals)} {assetSymbol}</strong>
                </div>
              </div>
            </article>
          </section>

          <section className="panel grid-2">
            <article className="card action-card">
              <h3>Consulta balance COPW</h3>
              <label>
                Billetera a consultar
                <input
                  value={copwQueryWallet}
                  onChange={(event) => setCopwQueryWallet(event.target.value)}
                  placeholder="0x..."
                />
              </label>
              <button className="btn accent" type="button" onClick={queryCopwBalance}>
                Consultar COPW
              </button>
              <p className="hint">
                Balance: <strong>{safeFormat(copwQueryBalance, assetDecimals)} {assetSymbol}</strong>
              </p>
            </article>
          </section>

          <section className="panel grid-5">
            <article className="card action-card">
              <h3>1) Approve Asset</h3>
              <label>
                Monto ({assetSymbol})
                <input
                  value={approveAmount}
                  onChange={(event) => setApproveAmount(event.target.value)}
                  placeholder="100"
                />
              </label>
              <button className="btn secondary" type="button" onClick={approveAssets} disabled={!isSepolia}>
                Aprobar
              </button>
            </article>

            <article className="card action-card">
              <h3>2) Mint COPW (Prueba)</h3>
              <label>
                Billetera destino
                <input
                  value={mintRecipient}
                  onChange={(event) => setMintRecipient(event.target.value)}
                  placeholder="0x..."
                />
              </label>
              <label>
                Monto ({assetSymbol})
                <input
                  value={mintAmount}
                  onChange={(event) => setMintAmount(event.target.value)}
                  placeholder="1000"
                />
              </label>
              <button className="btn secondary" type="button" onClick={mintCopwForTesting} disabled={!isSepolia}>
                Mintear COPW
              </button>
            </article>

            <article className="card action-card">
              <h3>3) Deposit</h3>
              <label>
                Monto ({assetSymbol})
                <input
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(event.target.value)}
                  placeholder="50"
                />
              </label>
              <button className="btn primary" type="button" onClick={depositAssets} disabled={!isSepolia}>
                Depositar
              </button>
            </article>

            <article className="card action-card">
              <h3>4) Reclamar Asset (Withdraw)</h3>
              <label>
                Monto ({assetSymbol})
                <input
                  value={withdrawAmount}
                  onChange={(event) => setWithdrawAmount(event.target.value)}
                  placeholder="10"
                />
              </label>
              <button className="btn accent" type="button" onClick={withdrawAssets} disabled={!isSepolia}>
                Reclamar Activo
              </button>
            </article>

            <article className="card action-card">
              <h3>5) Redeem</h3>
              <label>
                Shares ({vaultSymbol})
                <input
                  value={redeemAmount}
                  onChange={(event) => setRedeemAmount(event.target.value)}
                  placeholder="10"
                />
              </label>
              <button className="btn warn" type="button" onClick={redeemShares} disabled={!isSepolia}>
                Redimir
              </button>
            </article>
          </section>
        </>
      ) : null}

      {activeVaultView === 'erc7540' ? (
        <>
          <section className="panel">
            <article className="card action-card guide-card">
              <h3>Guia rapida ERC7540 (asincrona)</h3>
              <ol className="guide-list">
                <li>Conecta wallet en Sepolia.</li>
                <li>Verifica en pantalla que las direcciones cargaron desde el archivo .env.</li>
                <li>Haz clic en Refrescar ERC7540 para cargar estado y nextRequestId.</li>
                <li>Ejecuta Approve Asset para permitir que la vault use tu COPW.</li>
                <li>Lanza requestDeposit con un monto de activo.</li>
                <li>Usa claimDeposit con el requestId para mintear shares.</li>
                <li>Lanza requestRedeem con la cantidad de shares a salir.</li>
                <li>Usa claimRedeem con el requestId para recibir el activo.</li>
              </ol>
              <p className="hint">
                Tip: si no recuerdas el requestId, revisa el valor de Next Request ID antes y despues de cada request.
              </p>
            </article>
          </section>

          <section className="panel">
            <article className="card">
              <h2>Vault ERC7540 (Asincrona)</h2>
              <p>
                Vault ERC7540 (.env): <span className="mono">{vault7540Address || '-'}</span>
              </p>
              <p>
                Asset ERC20 / COPW (.env o autodetect): <span className="mono">{asset7540AddressInput || '-'}</span>
              </p>
              <button className="btn accent" type="button" onClick={refresh7540Data}>
                Refrescar ERC7540
              </button>
            </article>
          </section>

          <section className="panel">
            <article className="card stats">
              <h2>Estado Vault ERC7540</h2>
              <div className="stats-grid">
                <div>
                  <span>Vault</span>
                  <strong>{vault7540Name}</strong>
                </div>
                <div>
                  <span>Share Symbol</span>
                  <strong>{vault7540Symbol}</strong>
                </div>
                <div>
                  <span>Asset Symbol</span>
                  <strong>{asset7540Symbol}</strong>
                </div>
                <div>
                  <span>Next Request ID</span>
                  <strong>{nextRequestId7540.toString()}</strong>
                </div>
                <div>
                  <span>Total Assets</span>
                  <strong>{safeFormat(totalAssets7540, asset7540Decimals)} {asset7540Symbol}</strong>
                </div>
                <div>
                  <span>Total Supply</span>
                  <strong>{safeFormat(totalSupply7540, vault7540Decimals)} {vault7540Symbol}</strong>
                </div>
                <div>
                  <span>Mis Shares</span>
                  <strong>{safeFormat(sharesBalance7540, vault7540Decimals)} {vault7540Symbol}</strong>
                </div>
                <div>
                  <span>Mi Balance COPW</span>
                  <strong>{safeFormat(assetBalance7540, asset7540Decimals)} {asset7540Symbol}</strong>
                </div>
                <div>
                  <span>Allowance a ERC7540</span>
                  <strong>{safeFormat(assetAllowance7540, asset7540Decimals)} {asset7540Symbol}</strong>
                </div>
              </div>
            </article>
          </section>

          <section className="panel grid-5">
            <article className="card action-card">
              <h3>ERC7540-1) Approve Asset</h3>
              <label>
                Monto ({asset7540Symbol})
                <input
                  value={approveAmount7540}
                  onChange={(event) => setApproveAmount7540(event.target.value)}
                  placeholder="100"
                />
              </label>
              <button className="btn secondary" type="button" onClick={approveAssets7540} disabled={!isSepolia}>
                Aprobar ERC7540
              </button>
            </article>

            <article className="card action-card">
              <h3>ERC7540-2) Request Deposit</h3>
              <label>
                Monto ({asset7540Symbol})
                <input
                  value={requestDepositAmount7540}
                  onChange={(event) => setRequestDepositAmount7540(event.target.value)}
                  placeholder="25"
                />
              </label>
              <button className="btn primary" type="button" onClick={requestDeposit7540} disabled={!isSepolia}>
                requestDeposit
              </button>
            </article>

            <article className="card action-card">
              <h3>ERC7540-3) Claim Deposit</h3>
              <label>
                Request ID
                <input
                  value={claimDepositId7540}
                  onChange={(event) => setClaimDepositId7540(event.target.value)}
                  placeholder="1"
                />
              </label>
              <button className="btn accent" type="button" onClick={claimDeposit7540} disabled={!isSepolia}>
                claimDeposit
              </button>
            </article>

            <article className="card action-card">
              <h3>ERC7540-4) Request Redeem</h3>
              <label>
                Shares ({vault7540Symbol})
                <input
                  value={requestRedeemAmount7540}
                  onChange={(event) => setRequestRedeemAmount7540(event.target.value)}
                  placeholder="10"
                />
              </label>
              <button className="btn warn" type="button" onClick={requestRedeem7540} disabled={!isSepolia}>
                requestRedeem
              </button>
            </article>

            <article className="card action-card">
              <h3>ERC7540-5) Claim Redeem</h3>
              <label>
                Request ID
                <input
                  value={claimRedeemId7540}
                  onChange={(event) => setClaimRedeemId7540(event.target.value)}
                  placeholder="2"
                />
              </label>
              <button className="btn warn" type="button" onClick={claimRedeem7540} disabled={!isSepolia}>
                claimRedeem
              </button>
            </article>
          </section>

        </>
      ) : null}

      <footer className="status-bar">
        <span className={`dot ${activeVaultReady ? 'ok' : 'idle'}`}></span>
        <p>{status}</p>
      </footer>
    </div>
  )
}

export default App
