# FrontEnd - ERC4626 Vault Console

Aplicacion React para conectarse a contratos desplegados de la parte blockchain (`ERC4626IdleVault` + token asset ERC20) unicamente en Sepolia, usando `viem`.

## Requisitos

- Node.js 20.x
- NPM
- Wallet inyectada (MetaMask o Rabby)
- Red Sepolia configurada en la wallet

## Configuracion

1. Copia variables de entorno:

```bash
cp .env.example .env
```

2. Define direcciones desplegadas en `FrontEnd/.env`:

- `VITE_VAULT_ADDRESS`: direccion del contrato vault ERC4626.
- `VITE_VAULT7540_ADDRESS`: direccion del contrato vault ERC7540.
- `VITE_ASSET_ADDRESS`: direccion del token asset ERC20 (opcional, la app puede resolverla desde `vault.asset()`).

Nota:
- La UI toma estas direcciones desde variables de entorno.
- El usuario final no necesita escribirlas manualmente en la interfaz.

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

- Conectar wallet.
- Leer estado on-chain de la vault:
  - `name`, `symbol`, `totalAssets`, `totalSupply`.
  - balances de usuario y allowance de asset hacia la vault.
- Consultar balance de COPW para cualquier billetera.
- Operaciones de usuario:
  - `approve` del asset ERC20.
  - `mint` de COPW para pruebas (si el token lo permite).
  - `deposit` en la vault.
  - `withdraw` para reclamar activo subyacente.
  - `redeem` de shares.

## Restriccion de red

- La interfaz fuerza uso de Sepolia (`chainId 11155111`).
- Si la wallet esta en otra red, la app intenta cambiar automaticamente a Sepolia y bloquea operaciones hasta estar en esa red.

## Paleta de colores aplicada (sin degradados)

- Amarillo: `#FFD204`
- Verde: `#00C587`
- Naranja: `#FF803A`
- Rosado: `#FFB8D2`
- Azul: `#01CDEB`
- Negro: `#2C2A29`
- Blanco: `#F7F7F7`
