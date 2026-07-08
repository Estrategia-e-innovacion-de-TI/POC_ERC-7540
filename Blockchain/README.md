# ERC-7540 / ERC-4626 (Blockchain)

Proyecto Solidity basado en Foundry con una implementacion base de vault ERC-4626, contratos mock para pruebas, scripts de despliegue y suite de testing (unit, fuzz en Forge y fuzzing avanzado con Echidna/Medusa).

## Que hay actualmente en el proyecto

### Contratos

- `src/ERC4626/ERC4626Base.sol`
	- Base abstracta ERC-4626 con logica de shares ERC-20.
	- Implementa: `deposit`, `mint`, `withdraw`, `redeem`, previews, conversiones, allowances y eventos.
	- Expone hooks para estrategia (`_afterDeposit`, `_beforeWithdraw`) y requiere implementar `totalAssets()`.

- `src/ERC4626/ERC4626IdleVault.sol`
	- Implementacion minima de la base.
	- `totalAssets()` devuelve solo el balance local del asset (vault idle).

- `src/ERC7540/IERC7540.sol`
	- Interfaz minima para flujo asincrono request/claim de deposit y redeem.

- `src/ERC7540/ERC7540AsyncVault.sol`
	- Base abstracta que extiende `ERC4626Base` con solicitudes asincronas.
	- Implementa request/claim de deposit y redeem con escrow de shares para redenciones.

- `src/ERC7540/ERC7540IdleVault.sol`
	- Implementacion minima concreta de `ERC7540AsyncVault`.
	- `totalAssets()` devuelve solo el balance local del asset (vault idle).

- `src/mocks/COPW.sol`
	- ERC20 mock para pruebas/despliegues locales.
	- Incluye `mint` abierto para testeo.

### Scripts de despliegue

- `script/DeployCOPW.s.sol`
	- Despliega el token mock `COPW`.

- `script/DeployERC4626IdleVault.s.sol`
	- Despliega `ERC4626IdleVault` leyendo:
		- `ASSET_TOKEN` (obligatoria)
		- `VAULT_NAME` (default: `Vault Share`)
		- `VAULT_SYMBOL` (default: `VSH`)

### Pruebas

- `test/ERC4626BaseUnit.t.sol`
	- Cobertura unitaria de constructor, deposit/mint/withdraw/redeem, approvals y redondeos.

- `test/ERC4626BaseFuzz.t.sol`
	- Pruebas fuzz de invariantes y consistencia de previews vs ejecucion real.

- `test/fizz/`
	- Suite de fuzzing por handlers/properties para Echidna y Medusa.

### Configuracion y artefactos relevantes

- `foundry.toml`: configuracion de Foundry.
- `Makefile`: comandos de trabajo diario.
- `medusa.json`: config de Medusa.
- `echidna.yaml`: config de Echidna.
- `fizz_data/`: corpus, reportes y salidas de fuzzing/cobertura.

## Requisitos

1. Foundry instalado (`forge`, `anvil`, `cast`).
2. Dependencias del repo:

```bash
forge install
```

3. Opcional para fuzzing avanzado:
- `echidna`
- `medusa`
- `crytic-compile`

Nota: el `Makefile` prioriza `.venv-fizz/bin` en `PATH`, util si instalas tooling Python ahi.

## Uso rapido

Desde la carpeta `Blockchain/`:

```bash
make help
```

Comandos principales:

```bash
make build
make test
make test-unit
make test-fuzz
make test-verbose
make coverage
make fmt
make fmt-check
make snapshot
```

## Flujo local recomendado

1. Levantar nodo local:

```bash
make anvil
```

2. En otra terminal, desplegar mock COPW:

```bash
make deploy-copw
```

3. Desplegar vault ERC4626 (te pedira `ASSET_TOKEN`, nombre/simbolo y private key):

```bash
make deploy-erc4626
```

4. Ejecutar pruebas:

```bash
make test
```

## Despliegue en Sepolia

Copia `example.env` a `.env` y completa los valores:

```bash
cp example.env .env
```

Variables esperadas:

```bash
BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/TU_API_KEY
ETHERSCAN_API_KEY=TU_ETHERSCAN_KEY
```

Luego ejecuta:

```bash
make deploy-copw-sepolia
make deploy-erc4626-sepolia
make deploy-erc7540-sepolia
```

Ambos comandos solicitan `PRIVATE_KEY` de forma interactiva.

## Direcciones desplegadas en Sepolia

- COPW (Mock ERC20): [0x563347Cb73dF1250D62d7B0B1407E3B1209f0A71](https://sepolia.etherscan.io/address/0x563347Cb73dF1250D62d7B0B1407E3B1209f0A71)
- ERC4626IdleVault: [0x2BBDeAa7D79455B074b6D5c8006628000634C10a](https://sepolia.etherscan.io/address/0x2BBDeAa7D79455B074b6D5c8006628000634C10a)
- ERC7540IdleVault: [0xAb8e368C472a6086D3791913135b737f91eEC4FF](https://sepolia.etherscan.io/address/0xAb8e368C472a6086D3791913135b737f91eEC4FF)

Fuentes de despliegue:
- `broadcast/DeployCOPW.s.sol/11155111/run-latest.json`
- `broadcast/DeployERC4626IdleVault.s.sol/11155111/run-latest.json`
- `broadcast/DeployERC7540IdleVault.s.sol/11155111/run-latest.json`

## Fuzzing avanzado

### Medusa

```bash
make medusa-check
make medusa
```

Ejecucion corta para depurar:

```bash
make medusa-short
```

### Echidna

```bash
forge build
echidna . --contract FuzzTester --config echidna.yaml
```

## Estructura resumida

```text
src/
	ERC4626/
		ERC4626Base.sol
		ERC4626IdleVault.sol
	ERC7540/
		IERC7540.sol
		ERC7540AsyncVault.sol
		ERC7540IdleVault.sol
	mocks/
		COPW.sol

script/
	DeployCOPW.s.sol
	DeployERC4626IdleVault.s.sol

test/
	ERC4626BaseUnit.t.sol
	ERC4626BaseFuzz.t.sol
	fizz/

fizz_data/
medusa.json
echidna.yaml
Makefile
```

## Documentacion funcional

Para detalle conceptual y operativo de la implementacion actual:

- `ARQUITECTURA_ERC4626.md`
- `FAQ_ERC4626.md`
- `ARQUITECTURA_ERC7540.md`
- `FAQ_ERC7540.md`

## Notas importantes

- Esta implementacion de `ERC4626IdleVault` es una version minima (sin estrategia externa).
- Si se crea una estrategia real, se debe extender `totalAssets()` para incluir activos invertidos y ajustar politicas de liquidez/retiro.
- Las pruebas (`forge test`, fuzz y Medusa) crean una instancia local de `COPW` dentro del entorno de test. Esto no crea un segundo contrato en el repo ni reemplaza el `COPW` ya desplegado en Sepolia.
