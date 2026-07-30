# FrontEnd - Vault Console (ERC4626 / ERC7540)

Aplicacion React para operar contratos desplegados en Sepolia (`ERC4626IdleVault`, `ERC7540IdleVault` + asset ERC20) usando `viem`.

Soporta dos modos de conexion:

1. **MetaMask / wallet inyectada** (flujo clasico; el usuario paga gas).
2. **Email (Turnkey + Pimlico)** — crea wallet embebida y smart account ERC-4337 con gas patrocinado (sin extension ni ETH).

## Requisitos

- Node.js 20.x
- NPM
- Para MetaMask: wallet inyectada + red Sepolia
- Para email: cuentas Turnkey (Auth Proxy + Email OTP) y API key de Pimlico

## Configuracion

1. Copia variables de entorno:

```bash
cp .env.example .env
```

2. Define direcciones desplegadas en `FrontEnd/.env`:

- `VITE_VAULT_ADDRESS`: vault ERC4626
- `VITE_VAULT7540_ADDRESS`: vault ERC7540
- `VITE_ASSET_ADDRESS`: token asset ERC20 (opcional; la app puede resolverla con `vault.asset()`)

3. (Opcional) Login con email gasless:

- `VITE_TURNKEY_ORGANIZATION_ID`
- `VITE_TURNKEY_AUTH_PROXY_CONFIG_ID`
- `VITE_PIMLICO_API_KEY`
- `VITE_SEPOLIA_RPC_URL` (opcional; default publicnode)

### Turnkey

1. Crea org en [app.turnkey.com](https://app.turnkey.com)
2. Embedded Wallets → Configuration → habilita **Auth Proxy** y **Email OTP**
3. Copia Organization ID y Auth Proxy Config ID al `.env`

### Pimlico

1. Crea API key en [dashboard.pimlico.io](https://dashboard.pimlico.io)
2. Usa la key de Sepolia y configura sponsorship / paymaster segun su dashboard
3. Pon la key en `VITE_PIMLICO_API_KEY`

Nota: en GitHub Pages la API key queda en el bundle del cliente. Para produccion conviene un proxy; en esta POC es aceptable con limites de testnet.

## Ejecutar

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Funcionalidades

- Conectar con email (Turnkey) o MetaMask
- Smart account Simple Account + paymaster Pimlico en modo email
- Leer estado on-chain de las vaults
- Consultar balance de COPW
- Operaciones: `approve`, `mint` (prueba), `deposit` / `withdraw` / `redeem` (4626)
- Operaciones asincronas 7540: `requestDeposit`, `claimDeposit`, `requestRedeem`, `claimRedeem`

## Restriccion de red

- Solo Sepolia (`chainId 11155111`)
- En modo MetaMask la app intenta cambiar automaticamente a Sepolia
- En modo email la smart account opera siempre sobre Sepolia via RPC HTTP

## Flujo email (resumen)

```
Email OTP (Turnkey)
  → EOA embebida
  → Simple Smart Account (permissionless)
  → UserOperations vía bundler/paymaster Pimlico
  → Vaults en Sepolia
```

La direccion visible en la UI es la **smart account** (no la EOA Turnkey). La EOA aparece como owner.

## Paleta de colores aplicada (sin degradados)

- Amarillo: `#FFD204`
- Verde: `#00C587`
- Naranja: `#FF803A`
- Rosado: `#FFB8D2`
- Azul: `#01CDEB`
- Negro: `#2C2A29`
- Blanco: `#F7F7F7`
