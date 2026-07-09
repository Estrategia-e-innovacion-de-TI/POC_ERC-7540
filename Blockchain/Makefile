# Makefile for Foundry project workflows

SHELL := /bin/bash

.DEFAULT_GOAL := help

VENV_FIZZ_BIN := $(abspath .venv-fizz/bin)
PATH := $(VENV_FIZZ_BIN):$(PATH)

.PHONY: help build rebuild clean test test-unit test-fuzz test-verbose \
	coverage fmt fmt-check snapshot install update anvil script \
	medusa-check medusa medusa-short deploy-copw deploy-erc4626 deploy-erc7540 \
	deploy-copw-sepolia deploy-erc4626-sepolia deploy-erc7540-sepolia

help:
	@echo "Comandos disponibles:"
	@echo "  make build        - Compilar contratos"
	@echo "  make rebuild      - Limpiar y compilar de cero"
	@echo "  make clean        - Limpiar artefactos (out/, cache/)"
	@echo "  make test         - Ejecutar todas las pruebas"
	@echo "  make test-unit    - Ejecutar pruebas unitarias ERC4626"
	@echo "  make test-fuzz    - Ejecutar pruebas fuzz ERC4626"
	@echo "  make test-verbose - Ejecutar pruebas con trazas (-vv)"
	@echo "  make coverage     - Generar coverage con forge"
	@echo "  make fmt          - Formatear contratos y tests"
	@echo "  make fmt-check    - Validar formato sin modificar"
	@echo "  make snapshot     - Generar snapshot de gas"
	@echo "  make install      - Instalar dependencias (forge install)"
	@echo "  make update       - Actualizar dependencias (forge update)"
	@echo "  make anvil        - Levantar nodo local Anvil"
	@echo "  make script       - Ejecutar script de ejemplo"
	@echo "  make deploy-copw  - Desplegar mock COPW (PK interactiva)"
	@echo "  make deploy-erc4626 - Desplegar ERC4626IdleVault (PK interactiva)"
	@echo "  make deploy-erc7540 - Desplegar ERC7540IdleVault (PK interactiva)"
	@echo "  make deploy-copw-sepolia - Desplegar COPW en Sepolia usando .env"
	@echo "  make deploy-erc4626-sepolia - Desplegar vault en Sepolia usando .env"
	@echo "  make deploy-erc7540-sepolia - Desplegar ERC7540 vault en Sepolia usando .env"
	@echo "  make medusa-check - Verificar prerequisitos de Medusa"
	@echo "  make medusa       - Ejecutar Medusa con medusa.json"
	@echo "  make medusa-short - Ejecutar Medusa con limite corto (debug)"

build:
	forge build

rebuild: clean build

clean:
	forge clean
	rm -rf out cache

test:
	forge test

test-unit:
	forge test --match-contract ERC4626BaseUnitTest -vv

test-fuzz:
	forge test --match-contract ERC4626BaseFuzzTest -vv

test-verbose:
	forge test -vv

coverage:
	forge coverage

fmt:
	forge fmt

fmt-check:
	forge fmt --check

snapshot:
	forge snapshot

install:
	forge install

update:
	forge update

anvil:
	anvil

script:
	forge script script/Counter.s.sol:CounterScript --broadcast --rpc-url http://127.0.0.1:8545

deploy-copw:
	@read -p "RPC_URL [http://127.0.0.1:8545]: " RPC; \
	if [ -z "$$RPC" ]; then RPC="http://127.0.0.1:8545"; fi; \
	read -s -p "PRIVATE_KEY (hex, sin 0x): " PK; echo ""; \
	if [ -z "$$PK" ]; then echo "PRIVATE_KEY es requerida"; exit 1; fi; \
	forge script script/DeployCOPW.s.sol:DeployCOPW --broadcast --rpc-url "$$RPC" --private-key "$$PK"

deploy-erc4626:
	@read -p "RPC_URL [http://127.0.0.1:8545]: " RPC; \
	if [ -z "$$RPC" ]; then RPC="http://127.0.0.1:8545"; fi; \
	read -p "ASSET_TOKEN (direccion): " ASSET; \
	if [ -z "$$ASSET" ]; then echo "ASSET_TOKEN es requerido"; exit 1; fi; \
	read -p "VAULT_NAME [Vault Share]: " VNAME; \
	if [ -z "$$VNAME" ]; then VNAME="Vault Share"; fi; \
	read -p "VAULT_SYMBOL [VSH]: " VSYM; \
	if [ -z "$$VSYM" ]; then VSYM="VSH"; fi; \
	read -s -p "PRIVATE_KEY (hex, sin 0x): " PK; echo ""; \
	if [ -z "$$PK" ]; then echo "PRIVATE_KEY es requerida"; exit 1; fi; \
	ASSET_TOKEN=$$ASSET VAULT_NAME="$$VNAME" VAULT_SYMBOL="$$VSYM" forge script script/DeployERC4626IdleVault.s.sol:DeployERC4626IdleVault --broadcast --rpc-url "$$RPC" --private-key "$$PK"

deploy-erc7540:
	@read -p "RPC_URL [http://127.0.0.1:8545]: " RPC; \
	if [ -z "$$RPC" ]; then RPC="http://127.0.0.1:8545"; fi; \
	read -p "ASSET_TOKEN (direccion): " ASSET; \
	if [ -z "$$ASSET" ]; then echo "ASSET_TOKEN es requerido"; exit 1; fi; \
	read -p "VAULT_NAME [Async Vault Share]: " VNAME; \
	if [ -z "$$VNAME" ]; then VNAME="Async Vault Share"; fi; \
	read -p "VAULT_SYMBOL [aVSH]: " VSYM; \
	if [ -z "$$VSYM" ]; then VSYM="aVSH"; fi; \
	read -s -p "PRIVATE_KEY (hex, sin 0x): " PK; echo ""; \
	if [ -z "$$PK" ]; then echo "PRIVATE_KEY es requerida"; exit 1; fi; \
	ASSET_TOKEN=$$ASSET VAULT_NAME="$$VNAME" VAULT_SYMBOL="$$VSYM" forge script script/DeployERC7540IdleVault.s.sol:DeployERC7540IdleVault --broadcast --rpc-url "$$RPC" --private-key "$$PK"

deploy-copw-sepolia:
	@set -a; . ./.env; set +a; \
	if [ -z "$$BLOCKCHAIN_RPC_URL" ]; then echo "BLOCKCHAIN_RPC_URL no definido en .env"; exit 1; fi; \
	if [ -z "$$ETHERSCAN_API_KEY" ]; then echo "ETHERSCAN_API_KEY no definido en .env"; exit 1; fi; \
	read -s -p "PRIVATE_KEY (hex, sin 0x): " PK; echo ""; \
	if [ -z "$$PK" ]; then echo "PRIVATE_KEY es requerida"; exit 1; fi; \
	forge script script/DeployCOPW.s.sol:DeployCOPW --broadcast --verify --rpc-url "$$BLOCKCHAIN_RPC_URL" --etherscan-api-key "$$ETHERSCAN_API_KEY" --private-key "$$PK"

deploy-erc4626-sepolia:
	@set -a; . ./.env; set +a; \
	if [ -z "$$BLOCKCHAIN_RPC_URL" ]; then echo "BLOCKCHAIN_RPC_URL no definido en .env"; exit 1; fi; \
	if [ -z "$$ETHERSCAN_API_KEY" ]; then echo "ETHERSCAN_API_KEY no definido en .env"; exit 1; fi; \
	read -p "ASSET_TOKEN (direccion): " ASSET; \
	if [ -z "$$ASSET" ]; then echo "ASSET_TOKEN es requerido"; exit 1; fi; \
	read -p "VAULT_NAME [Vault COPW]: " VNAME; \
	if [ -z "$$VNAME" ]; then VNAME="Vault COPW"; fi; \
	read -p "VAULT_SYMBOL [vCOPW]: " VSYM; \
	if [ -z "$$VSYM" ]; then VSYM="vCOPW"; fi; \
	read -s -p "PRIVATE_KEY (hex, sin 0x): " PK; echo ""; \
	if [ -z "$$PK" ]; then echo "PRIVATE_KEY es requerida"; exit 1; fi; \
	ASSET_TOKEN=$$ASSET VAULT_NAME="$$VNAME" VAULT_SYMBOL="$$VSYM" forge script script/DeployERC4626IdleVault.s.sol:DeployERC4626IdleVault --broadcast --verify --rpc-url "$$BLOCKCHAIN_RPC_URL" --etherscan-api-key "$$ETHERSCAN_API_KEY" --private-key "$$PK"

deploy-erc7540-sepolia:
	@set -a; . ./.env; set +a; \
	if [ -z "$$BLOCKCHAIN_RPC_URL" ]; then echo "BLOCKCHAIN_RPC_URL no definido en .env"; exit 1; fi; \
	if [ -z "$$ETHERSCAN_API_KEY" ]; then echo "ETHERSCAN_API_KEY no definido en .env"; exit 1; fi; \
	read -p "ASSET_TOKEN (direccion): " ASSET; \
	if [ -z "$$ASSET" ]; then echo "ASSET_TOKEN es requerido"; exit 1; fi; \
	read -p "VAULT_NAME [Async Vault COPW]: " VNAME; \
	if [ -z "$$VNAME" ]; then VNAME="Async Vault COPW"; fi; \
	read -p "VAULT_SYMBOL [aCOPW]: " VSYM; \
	if [ -z "$$VSYM" ]; then VSYM="aCOPW"; fi; \
	read -s -p "PRIVATE_KEY (hex, sin 0x): " PK; echo ""; \
	if [ -z "$$PK" ]; then echo "PRIVATE_KEY es requerida"; exit 1; fi; \
	ASSET_TOKEN=$$ASSET VAULT_NAME="$$VNAME" VAULT_SYMBOL="$$VSYM" forge script script/DeployERC7540IdleVault.s.sol:DeployERC7540IdleVault --broadcast --verify --rpc-url "$$BLOCKCHAIN_RPC_URL" --etherscan-api-key "$$ETHERSCAN_API_KEY" --private-key "$$PK"

medusa-check:
	@command -v medusa >/dev/null || (echo "medusa no esta en PATH" && exit 1)
	@command -v crytic-compile >/dev/null || (echo "crytic-compile no esta en PATH (.venv-fizz/bin)" && exit 1)
	@echo "OK: medusa y crytic-compile disponibles"

medusa: medusa-check
	medusa fuzz --config medusa.json

medusa-short: medusa-check
	medusa fuzz --config medusa.json --test-limit 5000
