import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbi,
  parseUnits,
} from 'viem'
import { sepolia } from 'viem/chains'
import { AuthState, ClientState, useTurnkey } from '@turnkey/react-wallet-kit'
import {
  ENV_ASSET,
  ENV_VAULT_4626,
  ENV_VAULT_7540,
  isEmailWalletReady,
  isPimlicoConfigured,
  isTurnkeyConfigured,
  SEPOLIA_CHAIN_HEX,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_PARAMS,
  SEPOLIA_RPC_URL,
  ZERO_ADDRESS,
} from './config'
import { createTurnkeySmartAccount } from './aa/createSmartAccount'
import { ensureEmbeddedEthWallet } from './aa/turnkeyWallets'
import './App.css'

const VAULT_ABI = parseAbi([
  'function asset() view returns (address)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
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
  'function convertToAssets(uint256 shares) view returns (uint256)',
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

function formatTxError(error) {
  const parts = [
    error?.shortMessage,
    error?.details,
    error?.cause?.shortMessage,
    error?.cause?.message,
    error?.message,
  ].filter(Boolean)
  const unique = [...new Set(parts.map((p) => String(p).trim()).filter(Boolean))]
  return unique[0] || 'Error desconocido'
}

function etherscanTxUrl(hash) {
  return `https://sepolia.etherscan.io/tx/${hash}`
}

function createHttpPublicClient() {
  return createPublicClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC_URL),
  })
}

function VaultConsole({ turnkey }) {
  const [activeVaultView, setActiveVaultView] = useState('erc4626')
  const [connectionMode, setConnectionMode] = useState('none')
  const [aaBusy, setAaBusy] = useState(false)
  const [txBusy, setTxBusy] = useState(false)
  const [statusKind, setStatusKind] = useState('idle') // idle | pending | success | error
  const [lastTxHash, setLastTxHash] = useState('')
  const [turnkeyAuth, setTurnkeyAuth] = useState(false)
  const [setupError, setSetupError] = useState('')
  const aaSetupRef = useRef(false)

  const [publicClient, setPublicClient] = useState(null)
  const [walletClient, setWalletClient] = useState(null)
  const [account, setAccount] = useState('')
  const [eoaAddress, setEoaAddress] = useState('')
  const [chainId, setChainId] = useState('')
  const [status, setStatus] = useState(
    isEmailWalletReady
      ? 'Inicia con email (Turnkey + Pimlico) o conecta MetaMask.'
      : 'Conecta tu wallet para iniciar.',
  )

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
  const [shareValueAssets, setShareValueAssets] = useState(0n)

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
  const [shareValueAssets7540, setShareValueAssets7540] = useState(0n)

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
  const isAaMode = connectionMode === 'aa'
  const isTurnkeyMode = connectionMode === 'aa' || connectionMode === 'turnkey-eoa'
  const isSepolia = isTurnkeyMode || chainId === SEPOLIA_CHAIN_ID

  const vaultReady = useMemo(
    () => vaultAddress && vaultAddress !== ZERO_ADDRESS && account && isSepolia,
    [vaultAddress, account, isSepolia],
  )

  const vault7540Ready = useMemo(
    () => vault7540Address && vault7540Address !== ZERO_ADDRESS && account && isSepolia,
    [vault7540Address, account, isSepolia],
  )

  const activeVaultReady = activeVaultView === 'erc4626' ? vaultReady : vault7540Ready

  const resetSession = useCallback(() => {
    setPublicClient(null)
    setWalletClient(null)
    setAccount('')
    setEoaAddress('')
    setConnectionMode('none')
    setChainId('')
    setTurnkeyAuth(false)
    setSetupError('')
    aaSetupRef.current = false
  }, [])

  function getInjectedClients() {
    const transport = custom(window.ethereum)
    return {
      publicClient: createPublicClient({ chain: sepolia, transport }),
      walletClient: createWalletClient({ chain: sepolia, transport }),
    }
  }

  async function syncChainId() {
    if (!hasWallet) return ''
    const hexChainId = await window.ethereum.request({ method: 'eth_chainId' })
    const decimal = parseInt(hexChainId, 16).toString()
    setChainId(decimal)
    return decimal
  }

  async function ensureSepolia() {
    if (isTurnkeyMode) {
      setChainId(SEPOLIA_CHAIN_ID)
      return true
    }

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

  async function connectInjectedWallet() {
    if (!hasWallet) {
      setStatus('No se detecto wallet inyectada. Instala MetaMask o Rabby, o usa login con email.')
      return
    }

    try {
      setConnectionMode('injected')
      const sep = await ensureSepoliaForInjected()
      if (!sep) {
        setConnectionMode('none')
        return
      }

      const clients = getInjectedClients()
      const addresses = await clients.walletClient.requestAddresses()
      if (!addresses.length) {
        setConnectionMode('none')
        setStatus('No se recibio ninguna cuenta de la wallet.')
        return
      }

      const currentAccount = getAddress(addresses[0])
      setPublicClient(clients.publicClient)
      setWalletClient(clients.walletClient)
      setAccount(currentAccount)
      setEoaAddress(currentAccount)
      setMintRecipient(currentAccount)
      setCopwQueryWallet(currentAccount)
      setStatus('Wallet inyectada conectada en Sepolia.')
    } catch (error) {
      setConnectionMode('none')
      setStatus(`Error conectando wallet: ${error.shortMessage || error.message}`)
    }
  }

  async function ensureSepoliaForInjected() {
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

  const setupAaFromTurnkey = useCallback(async () => {
    if (!turnkey || aaSetupRef.current) return false
    if (!isTurnkeyConfigured) {
      setSetupError('Configura VITE_TURNKEY_* en FrontEnd/.env')
      setStatus('Configura VITE_TURNKEY_* para login con email.')
      return false
    }

    const { httpClient, session, wallets, createWallet, refreshWallets, authState } = turnkey
    if (authState !== AuthState.Authenticated) {
      setSetupError('Turnkey aun no esta autenticado.')
      return false
    }
    if (!httpClient || !session?.organizationId) {
      setSetupError('Sesion Turnkey incompleta (sin httpClient/organizationId). Reintentando...')
      setStatus('Sesion Turnkey incompleta. Reintentando...')
      return false
    }

    aaSetupRef.current = true
    setAaBusy(true)
    setSetupError('')
    setTurnkeyAuth(true)
    setStatus('Obteniendo wallet Turnkey y conectando a Sepolia...')

    try {
      const ethAddress = await ensureEmbeddedEthWallet({
        wallets,
        createWallet,
        refreshWallets,
      })

      setEoaAddress(getAddress(ethAddress))
      setStatus(`EOA Turnkey: ${ethAddress}. Creando smart account...`)

      const aa = await createTurnkeySmartAccount({
        httpClient,
        organizationId: session.organizationId,
        eoaAddress: ethAddress,
      })

      const operatingAccount = getAddress(aa.account)
      setPublicClient(aa.publicClient)
      setWalletClient(aa.walletClient)
      setAccount(operatingAccount)
      setEoaAddress(getAddress(aa.eoaAddress))
      setMintRecipient(operatingAccount)
      setCopwQueryWallet(operatingAccount)
      setChainId(SEPOLIA_CHAIN_ID)
      setConnectionMode(aa.mode === 'aa' ? 'aa' : 'turnkey-eoa')
      setSetupError(aa.warning || '')
      setStatus(
        aa.mode === 'aa'
          ? `Smart account lista en Sepolia (gasless). Cuenta: ${operatingAccount}`
          : `EOA Turnkey conectada en Sepolia: ${operatingAccount}${aa.warning ? ` — ${aa.warning}` : ''}`,
      )
      return true
    } catch (error) {
      aaSetupRef.current = false
      setConnectionMode('none')
      const message = error?.shortMessage || error?.message || String(error)
      setSetupError(message)
      setStatus(`Error configurando email wallet: ${message}`)
      console.error('Turnkey/Pimlico setup error:', error)
      return false
    } finally {
      setAaBusy(false)
    }
  }, [turnkey])

  async function loginWithEmail() {
    if (!turnkey) {
      setStatus('Turnkey no esta disponible. Revisa VITE_TURNKEY_ORGANIZATION_ID y AUTH_PROXY.')
      return
    }
    if (!isTurnkeyConfigured) {
      setStatus('Faltan credenciales Turnkey en FrontEnd/.env')
      return
    }
    if (turnkey.clientState !== ClientState.Ready) {
      setStatus('Turnkey aun se esta inicializando. Espera un momento.')
      return
    }

    try {
      setSetupError('')
      setStatus('Abriendo login Turnkey (email OTP)...')
      await turnkey.handleLogin({ title: 'Entrar con email' })

      // handleLogin resolved: force wallet/session refresh and AA setup.
      setTurnkeyAuth(true)
      aaSetupRef.current = false
      if (typeof turnkey.refreshWallets === 'function') {
        try {
          await turnkey.refreshWallets()
        } catch (refreshError) {
          console.warn('refreshWallets after login:', refreshError)
        }
      }

      const ok = await setupAaFromTurnkey()
      if (!ok && turnkey.authState === AuthState.Authenticated) {
        // One delayed retry in case session/wallets land a tick later.
        setTimeout(() => {
          aaSetupRef.current = false
          setupAaFromTurnkey()
        }, 800)
      }
    } catch (error) {
      const message = error?.message || String(error)
      setSetupError(message)
      setStatus(`Error en login Turnkey: ${message}`)
    }
  }

  async function retryTurnkeySetup() {
    aaSetupRef.current = false
    setSetupError('')
    await setupAaFromTurnkey()
  }

  async function disconnectSession() {
    try {
      if (isTurnkeyMode && turnkey?.logout) {
        await turnkey.logout()
      }
    } catch (error) {
      console.error('Logout Turnkey:', error)
    }
    resetSession()
    setStatus('Sesion cerrada.')
  }

  useEffect(() => {
    if (!turnkey) return
    if (turnkey.authState !== AuthState.Authenticated) return
    if (connectionMode === 'injected') return
    if (account && isTurnkeyMode) return
    setTurnkeyAuth(true)
    setupAaFromTurnkey()
  }, [
    turnkey,
    turnkey?.authState,
    turnkey?.session?.organizationId,
    turnkey?.wallets,
    turnkey?.httpClient,
    connectionMode,
    account,
    isTurnkeyMode,
    setupAaFromTurnkey,
  ])

  useEffect(() => {
    if (!turnkey) return
    if (turnkey.authState === AuthState.Unauthenticated && isTurnkeyMode) {
      resetSession()
      setStatus('Sesion Turnkey expirada o cerrada.')
    }
  }, [turnkey, turnkey?.authState, isTurnkeyMode, resetSession])

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

      const loadedShareValue =
        loadedSharesBalance === 0n
          ? 0n
          : await publicClient.readContract({
              address: vaultAddr,
              abi: VAULT_ABI,
              functionName: 'convertToAssets',
              args: [loadedSharesBalance],
            })

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
      setShareValueAssets(loadedShareValue)
      setAssetAddressInput(assetAddress)
      setAppStatus('Datos ERC4626 actualizados correctamente.', 'success')
    } catch (error) {
      setAppStatus(`No se pudo leer contrato: ${formatTxError(error)}`, 'error')
    }
  }

  async function refresh7540Data() {
    if (!publicClient || !walletClient || !account) {
      setAppStatus('Primero conecta tu wallet.', 'error')
      return
    }
    const sep = await ensureSepolia()
    if (!sep) return

    if (!isAddress(vault7540Address) || vault7540Address === ZERO_ADDRESS) {
      setAppStatus('Configura VITE_VAULT7540_ADDRESS con una direccion valida en FrontEnd/.env.', 'error')
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

      const loadedShareValue =
        loadedSharesBalance === 0n
          ? 0n
          : await publicClient.readContract({
              address: vaultAddr,
              abi: VAULT_7540_ABI,
              functionName: 'convertToAssets',
              args: [loadedSharesBalance],
            })

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
      setShareValueAssets7540(loadedShareValue)
      setAsset7540AddressInput(assetAddress)
      setAppStatus('Datos ERC7540 actualizados correctamente.', 'success')
    } catch (error) {
      setAppStatus(`No se pudo leer vault ERC7540: ${formatTxError(error)}`, 'error')
    }
  }

  function setAppStatus(message, kind = 'idle') {
    setStatus(message)
    setStatusKind(kind)
  }

  async function writeAndWait(writeConfig, labels = {}) {
    const {
      pending = isTurnkeyMode
        ? 'Procesando UserOperation (firma Turnkey + bundler/paymaster Pimlico)... Esto puede tardar 15-60s.'
        : 'Enviando transaccion a Sepolia...',
      confirming = 'Tx enviada. Esperando confirmacion en Sepolia...',
      done = 'Transaccion confirmada en Sepolia.',
    } = labels

    setTxBusy(true)
    setLastTxHash('')
    setAppStatus(pending, 'pending')

    try {
      // For AA/Turnkey, walletClient.account is a SmartAccount/LocalAccount object.
      // Passing a bare address string overrides it and breaks encodeCalls.
      const hash = await walletClient.writeContract({
        ...writeConfig,
        account: walletClient.account || writeConfig.account,
      })

      if (hash) {
        setLastTxHash(hash)
        setAppStatus(`${confirming} Hash: ${hash}`, 'pending')
        await publicClient.waitForTransactionReceipt({ hash })
      }

      setAppStatus(done, 'success')
      return hash
    } catch (error) {
      const message = formatTxError(error)
      setAppStatus(`Fallo la transaccion: ${message}`, 'error')
      console.error('writeAndWait error:', error)
      throw error
    } finally {
      setTxBusy(false)
    }
  }

  async function approveAssets() {
    if (!walletClient || !publicClient || !account || !isAddress(vaultAddress) || !isAddress(assetAddressInput)) {
      setAppStatus('Conecta wallet y configura vault/asset antes de aprobar.', 'error')
      return
    }
    if (txBusy) return
    const sep = await ensureSepolia()
    if (!sep) return

    if (!approveAmount || Number(approveAmount) <= 0) {
      setAppStatus('Ingresa un monto valido para approve.', 'error')
      return
    }

    try {
      const amount = parseUnits(approveAmount, assetDecimals)
      await writeAndWait(
        {
          account,
          address: getAddress(assetAddressInput),
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [getAddress(vaultAddress), amount],
        },
        {
          pending: 'Aprobando asset para la vault ERC4626...',
          done: 'Approve ERC4626 confirmado.',
        },
      )
      await refreshData()
    } catch (error) {
      setAppStatus(`Error en approve: ${formatTxError(error)}`, 'error')
    }
  }

  async function approveAssets7540() {
    if (!walletClient || !publicClient || !account || !isAddress(vault7540Address) || !isAddress(asset7540AddressInput)) {
      setAppStatus('Conecta wallet y configura vault ERC7540/asset antes de aprobar.', 'error')
      return
    }
    if (txBusy) return
    const sep = await ensureSepolia()
    if (!sep) return

    if (!approveAmount7540 || Number(approveAmount7540) <= 0) {
      setAppStatus('Ingresa un monto valido para approve en ERC7540.', 'error')
      return
    }

    try {
      const amount = parseUnits(approveAmount7540, asset7540Decimals)
      await writeAndWait(
        {
          account,
          address: getAddress(asset7540AddressInput),
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [getAddress(vault7540Address), amount],
        },
        {
          pending: 'Aprobando asset para la vault ERC7540...',
          done: 'Approve ERC7540 confirmado.',
        },
      )
      await refresh7540Data()
    } catch (error) {
      setAppStatus(`Error en approve ERC7540: ${formatTxError(error)}`, 'error')
    }
  }

  async function mintCopwForTesting() {
    if (!walletClient || !publicClient || !account || !isAddress(assetAddressInput)) {
      setAppStatus('Conecta wallet y configura el asset antes de mintear COPW.', 'error')
      return
    }
    if (txBusy) return
    const sep = await ensureSepolia()
    if (!sep) return

    const recipient = mintRecipient.trim()
    if (!isAddress(recipient)) {
      setAppStatus('Ingresa una direccion valida para mintear COPW.', 'error')
      return
    }

    if (!mintAmount || Number(mintAmount) <= 0) {
      setAppStatus('Ingresa un monto valido para mintear COPW.', 'error')
      return
    }

    try {
      const amount = parseUnits(mintAmount, assetDecimals)
      await writeAndWait(
        {
          account,
          address: getAddress(assetAddressInput),
          abi: ERC20_ABI,
          functionName: 'mint',
          args: [getAddress(recipient), amount],
        },
        {
          pending: isTurnkeyMode
            ? 'Minteando COPW: firmando con Turnkey y enviando UserOp gasless a Pimlico... Espera 15-60s.'
            : 'Minteando COPW: confirma en MetaMask y espera la tx...',
          confirming: 'Mint enviado. Confirmando en Sepolia...',
          done: `Mint COPW confirmado (${mintAmount} a ${shortAddress(recipient)}).`,
        },
      )
      await refreshData()
    } catch (error) {
      setAppStatus(`Error minteando COPW: ${formatTxError(error)}`, 'error')
    }
  }

  async function depositAssets() {
    if (!walletClient || !publicClient || !account || !isAddress(vaultAddress)) {
      setAppStatus('Conecta wallet y configura la vault antes de depositar.', 'error')
      return
    }
    if (txBusy) return
    const sep = await ensureSepolia()
    if (!sep) return

    if (!depositAmount || Number(depositAmount) <= 0) {
      setAppStatus('Ingresa un monto valido para deposit.', 'error')
      return
    }

    try {
      const amount = parseUnits(depositAmount, assetDecimals)
      await writeAndWait(
        {
          account,
          address: getAddress(vaultAddress),
          abi: VAULT_ABI,
          functionName: 'deposit',
          args: [amount, account],
        },
        {
          pending: 'Depositando en vault ERC4626...',
          done: 'Deposit ERC4626 confirmado.',
        },
      )
      await refreshData()
    } catch (error) {
      setAppStatus(`Error en deposit: ${formatTxError(error)}`, 'error')
    }
  }

  async function withdrawAssets() {
    if (!walletClient || !publicClient || !account || !isAddress(vaultAddress)) {
      setAppStatus('Conecta wallet y configura la vault antes de reclamar activos.', 'error')
      return
    }
    if (txBusy) return

    const sep = await ensureSepolia()
    if (!sep) return

    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      setAppStatus('Ingresa un monto valido para withdraw.', 'error')
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
        setAppStatus('No tienes suficientes shares para reclamar ese monto de activo.', 'error')
        return
      }

      await writeAndWait(
        {
          account,
          address: vaultAddr,
          abi: VAULT_ABI,
          functionName: 'withdraw',
          args: [assets, account, account],
        },
        {
          pending: 'Retirando activos (withdraw) de ERC4626...',
          done: 'Withdraw ERC4626 confirmado.',
        },
      )
      await refreshData()
    } catch (error) {
      setAppStatus(`Error en withdraw: ${formatTxError(error)}`, 'error')
    }
  }

  async function redeemShares() {
    if (!walletClient || !publicClient || !account || !isAddress(vaultAddress)) {
      setAppStatus('Conecta wallet y configura la vault antes de redimir.', 'error')
      return
    }
    if (txBusy) return
    const sep = await ensureSepolia()
    if (!sep) return

    if (!redeemAmount || Number(redeemAmount) <= 0) {
      setAppStatus('Ingresa un monto valido para redeem.', 'error')
      return
    }

    try {
      const shares = parseUnits(redeemAmount, vaultDecimals)
      await writeAndWait(
        {
          account,
          address: getAddress(vaultAddress),
          abi: VAULT_ABI,
          functionName: 'redeem',
          args: [shares, account, account],
        },
        {
          pending: 'Redimiendo shares ERC4626...',
          done: 'Redeem ERC4626 confirmado.',
        },
      )
      await refreshData()
    } catch (error) {
      setAppStatus(`Error en redeem: ${formatTxError(error)}`, 'error')
    }
  }

  async function requestDeposit7540() {
    if (!walletClient || !publicClient || !account || !isAddress(vault7540Address)) {
      setAppStatus('Conecta wallet y configura la vault ERC7540 antes de requestDeposit.', 'error')
      return
    }
    if (txBusy) return
    const sep = await ensureSepolia()
    if (!sep) return

    if (!requestDepositAmount7540 || Number(requestDepositAmount7540) <= 0) {
      setAppStatus('Ingresa un monto valido para requestDeposit ERC7540.', 'error')
      return
    }

    try {
      const amount = parseUnits(requestDepositAmount7540, asset7540Decimals)
      await writeAndWait(
        {
          account,
          address: getAddress(vault7540Address),
          abi: VAULT_7540_ABI,
          functionName: 'requestDeposit',
          args: [amount, account, account],
        },
        {
          pending: 'Enviando requestDeposit ERC7540...',
          done: 'requestDeposit ERC7540 confirmado.',
        },
      )
      await refresh7540Data()
    } catch (error) {
      setAppStatus(`Error en requestDeposit ERC7540: ${formatTxError(error)}`, 'error')
    }
  }

  async function claimDeposit7540() {
    if (!walletClient || !publicClient || !account || !isAddress(vault7540Address)) {
      setAppStatus('Conecta wallet y configura la vault ERC7540 antes de claimDeposit.', 'error')
      return
    }
    if (txBusy) return
    const sep = await ensureSepolia()
    if (!sep) return

    if (!claimDepositId7540 || Number(claimDepositId7540) <= 0) {
      setAppStatus('Ingresa un requestId valido para claimDeposit ERC7540.', 'error')
      return
    }

    try {
      await writeAndWait(
        {
          account,
          address: getAddress(vault7540Address),
          abi: VAULT_7540_ABI,
          functionName: 'claimDeposit',
          args: [BigInt(claimDepositId7540), account],
        },
        {
          pending: `Claiming deposit ERC7540 (requestId ${claimDepositId7540})...`,
          done: 'claimDeposit ERC7540 confirmado.',
        },
      )
      await refresh7540Data()
    } catch (error) {
      setAppStatus(`Error en claimDeposit ERC7540: ${formatTxError(error)}`, 'error')
    }
  }

  async function requestRedeem7540() {
    if (!walletClient || !publicClient || !account || !isAddress(vault7540Address)) {
      setAppStatus('Conecta wallet y configura la vault ERC7540 antes de requestRedeem.', 'error')
      return
    }
    if (txBusy) return
    const sep = await ensureSepolia()
    if (!sep) return

    if (!requestRedeemAmount7540 || Number(requestRedeemAmount7540) <= 0) {
      setAppStatus('Ingresa un monto valido para requestRedeem ERC7540.', 'error')
      return
    }

    try {
      const shares = parseUnits(requestRedeemAmount7540, vault7540Decimals)
      await writeAndWait(
        {
          account,
          address: getAddress(vault7540Address),
          abi: VAULT_7540_ABI,
          functionName: 'requestRedeem',
          args: [shares, account, account],
        },
        {
          pending: 'Enviando requestRedeem ERC7540...',
          done: 'requestRedeem ERC7540 confirmado.',
        },
      )
      await refresh7540Data()
    } catch (error) {
      setAppStatus(`Error en requestRedeem ERC7540: ${formatTxError(error)}`, 'error')
    }
  }

  async function claimRedeem7540() {
    if (!walletClient || !publicClient || !account || !isAddress(vault7540Address)) {
      setAppStatus('Conecta wallet y configura la vault ERC7540 antes de claimRedeem.', 'error')
      return
    }
    if (txBusy) return
    const sep = await ensureSepolia()
    if (!sep) return

    if (!claimRedeemId7540 || Number(claimRedeemId7540) <= 0) {
      setAppStatus('Ingresa un requestId valido para claimRedeem ERC7540.', 'error')
      return
    }

    try {
      await writeAndWait(
        {
          account,
          address: getAddress(vault7540Address),
          abi: VAULT_7540_ABI,
          functionName: 'claimRedeem',
          args: [BigInt(claimRedeemId7540), account],
        },
        {
          pending: `Claiming redeem ERC7540 (requestId ${claimRedeemId7540})...`,
          done: 'claimRedeem ERC7540 confirmado.',
        },
      )
      await refresh7540Data()
    } catch (error) {
      setAppStatus(`Error en claimRedeem ERC7540: ${formatTxError(error)}`, 'error')
    }
  }

  async function queryCopwBalance() {
    const client = publicClient || createHttpPublicClient()
    if (!isAddress(assetAddressInput)) {
      setStatus('Define una direccion de COPW valida para consultar balance.')
      return
    }

    const wallet = copwQueryWallet.trim()
    if (!isAddress(wallet)) {
      setStatus('Ingresa una billetera valida para consultar COPW.')
      return
    }

    try {
      const value = await client.readContract({
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
    if (!hasWallet || isTurnkeyMode) return

    const onAccountsChanged = async (accounts) => {
      if (!accounts.length) {
        resetSession()
        setStatus('Wallet desconectada desde la extension.')
        return
      }
      const next = getAddress(accounts[0])
      setAccount(next)
      setEoaAddress(next)
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
  }, [hasWallet, isTurnkeyMode, mintRecipient, copwQueryWallet, resetSession])

  const modeLabel =
    connectionMode === 'aa'
      ? 'Email / Smart Account (Pimlico)'
      : connectionMode === 'turnkey-eoa'
        ? 'Email / EOA Turnkey'
        : connectionMode === 'injected'
          ? 'MetaMask / wallet inyectada'
          : turnkeyAuth
            ? 'Turnkey autenticado (pendiente de wallet)'
            : 'Sin conexion'

  return (
    <div className="app-shell">
      <header className="header">
        <div>
          <div className="header-topline">
            <p className="kicker">ERC-7540 / ERC-4626</p>
            <span className="network-badge">SEPOLIA ONLY</span>
            {isAaMode ? <span className="network-badge gasless-badge">GASLESS</span> : null}
          </div>
          <h1>Vault Console</h1>
          <p className="subtitle">
            Opera vaults en Sepolia con MetaMask o con email (Turnkey + Pimlico, sin extension ni ETH).
          </p>
        </div>
        <div className="header-actions">
          {!account ? (
            <>
              <button
                className="btn primary"
                type="button"
                onClick={loginWithEmail}
                disabled={!isTurnkeyConfigured || aaBusy || (turnkey && turnkey.clientState === ClientState.Loading)}
              >
                {aaBusy ? 'Preparando wallet Sepolia...' : 'Continuar con email'}
              </button>
              {turnkeyAuth && !account ? (
                <button className="btn accent" type="button" onClick={retryTurnkeySetup} disabled={aaBusy}>
                  Reintentar conexion Sepolia
                </button>
              ) : null}
              <button className="btn secondary" type="button" onClick={connectInjectedWallet}>
                Conectar MetaMask
              </button>
            </>
          ) : (
            <>
              <button className="btn primary" type="button" disabled>
                {shortAddress(account)}
              </button>
              <button className="btn warn" type="button" onClick={disconnectSession}>
                Desconectar
              </button>
            </>
          )}
        </div>
      </header>

      {!isEmailWalletReady ? (
        <section className="panel">
          <article className="card setup-hint">
            <h3>Login con email (opcional)</h3>
            <p className="hint">
              Para habilitar Turnkey + Pimlico, agrega en <span className="mono">FrontEnd/.env</span>:
            </p>
            <ul className="guide-list">
              <li>
                <span className="mono">VITE_TURNKEY_ORGANIZATION_ID</span>
                {!isTurnkeyConfigured ? ' (faltante)' : ' OK'}
              </li>
              <li>
                <span className="mono">VITE_TURNKEY_AUTH_PROXY_CONFIG_ID</span>
                {!isTurnkeyConfigured ? ' (faltante)' : ' OK'}
              </li>
              <li>
                <span className="mono">VITE_PIMLICO_API_KEY</span>
                {!isPimlicoConfigured ? ' (faltante)' : ' OK'}
              </li>
            </ul>
          </article>
        </section>
      ) : null}

      <section className="panel grid-2">
        <article className="card">
          <h2>Conexion</h2>
          <p>
            Modo: <strong>{modeLabel}</strong>
          </p>
          <p>
            Red objetivo: <span className="mono">Sepolia (11155111)</span>
          </p>
          <p>
            Chain ID: <strong>{chainId || '-'}</strong>
          </p>
          <p>
            Cuenta operativa: <span className="mono">{account || '-'}</span>
          </p>
          {eoaAddress ? (
            <p>
              EOA Turnkey (owner): <span className="mono">{eoaAddress}</span>
            </p>
          ) : null}
          {setupError ? (
            <p className="setup-error">
              Error / aviso: <strong>{setupError}</strong>
            </p>
          ) : null}
          {turnkeyAuth && !account ? (
            <button className="btn accent" type="button" onClick={retryTurnkeySetup} disabled={aaBusy}>
              {aaBusy ? 'Conectando...' : 'Completar conexion Sepolia'}
            </button>
          ) : null}
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
            Vista activa:{' '}
            <strong>{activeVaultView === 'erc4626' ? 'ERC4626 (sincrona)' : 'ERC7540 (asincrona)'}</strong>
          </p>
        </article>
      </section>

      {activeVaultView === 'erc4626' ? (
        <>
          <section className="panel">
            <article className="card action-card guide-card">
              <h3>Guia rapida ERC4626</h3>
              <ol className="guide-list">
                <li>Inicia con email (gasless) o conecta MetaMask en Sepolia.</li>
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
                  <strong>
                    {safeFormat(totalAssets, assetDecimals)} {assetSymbol}
                  </strong>
                </div>
                <div>
                  <span>Total Supply</span>
                  <strong>
                    {safeFormat(totalSupply, vaultDecimals)} {vaultSymbol}
                  </strong>
                </div>
                <div>
                  <span>Mis Shares</span>
                  <strong>
                    {safeFormat(sharesBalance, vaultDecimals)} {vaultSymbol}
                  </strong>
                </div>
                <div>
                  <span>Mi Balance COPW</span>
                  <strong>
                    {safeFormat(assetBalance, assetDecimals)} {assetSymbol}
                  </strong>
                </div>
                <div>
                  <span>Allowance a Vault</span>
                  <strong>
                    {safeFormat(assetAllowance, assetDecimals)} {assetSymbol}
                  </strong>
                </div>
                <div>
                  <span>Valor actual de mis shares</span>
                  <strong>
                    {safeFormat(shareValueAssets, assetDecimals)} {assetSymbol}
                  </strong>
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
                Balance:{' '}
                <strong>
                  {safeFormat(copwQueryBalance, assetDecimals)} {assetSymbol}
                </strong>
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
              <button className="btn secondary" type="button" onClick={approveAssets} disabled={!isSepolia || txBusy}>
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
              <button
                className="btn secondary"
                type="button"
                onClick={mintCopwForTesting}
                disabled={!isSepolia || txBusy}
              >
                {txBusy ? 'Procesando mint...' : 'Mintear COPW'}
              </button>
              {txBusy ? <p className="hint">No cierres la pestana. Mira la barra de estado abajo.</p> : null}
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
              <button className="btn primary" type="button" onClick={depositAssets} disabled={!isSepolia || txBusy}>
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
              <button className="btn accent" type="button" onClick={withdrawAssets} disabled={!isSepolia || txBusy}>
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
              <button className="btn warn" type="button" onClick={redeemShares} disabled={!isSepolia || txBusy}>
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
                <li>Inicia con email (gasless) o conecta MetaMask en Sepolia.</li>
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
                Asset ERC20 / COPW (.env o autodetect):{' '}
                <span className="mono">{asset7540AddressInput || '-'}</span>
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
                  <strong>
                    {safeFormat(totalAssets7540, asset7540Decimals)} {asset7540Symbol}
                  </strong>
                </div>
                <div>
                  <span>Total Supply</span>
                  <strong>
                    {safeFormat(totalSupply7540, vault7540Decimals)} {vault7540Symbol}
                  </strong>
                </div>
                <div>
                  <span>Mis Shares</span>
                  <strong>
                    {safeFormat(sharesBalance7540, vault7540Decimals)} {vault7540Symbol}
                  </strong>
                </div>
                <div>
                  <span>Mi Balance COPW</span>
                  <strong>
                    {safeFormat(assetBalance7540, asset7540Decimals)} {asset7540Symbol}
                  </strong>
                </div>
                <div>
                  <span>Allowance a ERC7540</span>
                  <strong>
                    {safeFormat(assetAllowance7540, asset7540Decimals)} {asset7540Symbol}
                  </strong>
                </div>
                <div>
                  <span>Valor actual de mis shares</span>
                  <strong>
                    {safeFormat(shareValueAssets7540, asset7540Decimals)} {asset7540Symbol}
                  </strong>
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
              <button className="btn secondary" type="button" onClick={approveAssets7540} disabled={!isSepolia || txBusy}>
                {txBusy ? 'Procesando...' : 'Aprobar ERC7540'}
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
              <button className="btn primary" type="button" onClick={requestDeposit7540} disabled={!isSepolia || txBusy}>
                {txBusy ? 'Procesando...' : 'requestDeposit'}
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
              <button className="btn accent" type="button" onClick={claimDeposit7540} disabled={!isSepolia || txBusy}>
                {txBusy ? 'Procesando...' : 'claimDeposit'}
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
              <button className="btn warn" type="button" onClick={requestRedeem7540} disabled={!isSepolia || txBusy}>
                {txBusy ? 'Procesando...' : 'requestRedeem'}
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
              <button className="btn warn" type="button" onClick={claimRedeem7540} disabled={!isSepolia || txBusy}>
                {txBusy ? 'Procesando...' : 'claimRedeem'}
              </button>
            </article>
          </section>
        </>
      ) : null}

      <footer className={`status-bar status-${statusKind}`}>
        <span
          className={`dot ${
            statusKind === 'pending' ? 'pending' : statusKind === 'error' ? 'error' : activeVaultReady ? 'ok' : 'idle'
          }`}
        ></span>
        <div className="status-copy">
          <p>{status}</p>
          {lastTxHash ? (
            <p className="status-link">
              Tx:{' '}
              <a href={etherscanTxUrl(lastTxHash)} target="_blank" rel="noreferrer">
                {shortAddress(lastTxHash)} (Etherscan)
              </a>
            </p>
          ) : null}
        </div>
      </footer>
    </div>
  )
}

function AppWithTurnkey() {
  const turnkey = useTurnkey()
  return <VaultConsole turnkey={turnkey} />
}

function App() {
  if (isTurnkeyConfigured) {
    return <AppWithTurnkey />
  }
  return <VaultConsole turnkey={null} />
}

export default App
