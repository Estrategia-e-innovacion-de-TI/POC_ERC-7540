// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IERC20Minimal {
    /// @notice Total de tokens en circulacion del activo subyacente.
    /// @return Suministro total del token.
    function totalSupply() external view returns (uint256);

    /// @notice Balance de un usuario para el token subyacente.
    /// @param account Cuenta a consultar.
    /// @return Balance de la cuenta.
    function balanceOf(address account) external view returns (uint256);

    /// @notice Transfiere tokens del emisor al receptor.
    /// @param to Receptor de los tokens.
    /// @param amount Cantidad a transferir.
    /// @return true si la transferencia fue exitosa.
    function transfer(address to, uint256 amount) external returns (bool);

    /// @notice Transfiere tokens desde una cuenta origen usando allowance.
    /// @param from Cuenta origen.
    /// @param to Receptor de los tokens.
    /// @param amount Cantidad a transferir.
    /// @return true si la transferencia fue exitosa.
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    /// @notice Cantidad de decimales del token subyacente.
    /// @return Numero de decimales.
    function decimals() external view returns (uint8);
}

/// @title ERC4626Base
/// @notice Base abstracta de una vault ERC-4626 con token de shares ERC-20 incluido.
/// @dev La estrategia concreta debe implementar totalAssets() y opcionalmente los hooks.
abstract contract ERC4626Base {
    string public name;
    string public symbol;

    uint8 public immutable decimals;
    IERC20Minimal public immutable assetToken;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed caller,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    error ZeroAddress();
    error ZeroAmount();
    error InsufficientAssets();
    error InsufficientShares();
    error AllowanceExceeded();

    /// @notice Inicializa la vault base y define el activo subyacente.
    /// @param _assetToken Token ERC20 usado como activo de la vault.
    /// @param _name Nombre del token de shares.
    /// @param _symbol Simbolo del token de shares.
    constructor(IERC20Minimal _assetToken, string memory _name, string memory _symbol) {
        if (address(_assetToken) == address(0)) revert ZeroAddress();

        assetToken = _assetToken;
        name = _name;
        symbol = _symbol;
        decimals = _assetToken.decimals();
    }

    /// @notice Retorna la direccion del activo subyacente de la vault.
    /// @return Direccion del token asset.
    function asset() public view returns (address) {
        return address(assetToken);
    }

    /// @notice Total de activos gestionados por la vault (incluyendo estrategia externa si aplica).
    function totalAssets() public view virtual returns (uint256);

    /// @notice Establece allowance para un spender sobre shares del emisor.
    /// @param spender Cuenta autorizada para gastar shares.
    /// @param amount Cantidad aprobada.
    /// @return true si la aprobacion se registro correctamente.
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /// @notice Transfiere shares del emisor a otra cuenta.
    /// @param to Receptor de shares.
    /// @param amount Cantidad de shares a transferir.
    /// @return true si la transferencia fue exitosa.
    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    /// @notice Transfiere shares desde una cuenta usando allowance.
    /// @param from Cuenta origen de shares.
    /// @param to Receptor de shares.
    /// @param amount Cantidad de shares a transferir.
    /// @return true si la transferencia fue exitosa.
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < amount) revert AllowanceExceeded();
            allowance[from][msg.sender] = currentAllowance - amount;
        }

        _transfer(from, to, amount);
        return true;
    }

    /// @notice Convierte activos en shares con redondeo hacia abajo.
    /// @param assets Cantidad de activos a convertir.
    /// @return Cantidad estimada de shares.
    function convertToShares(uint256 assets) public view virtual returns (uint256) {
        return _convertToShares(assets, false);
    }

    /// @notice Convierte shares en activos con redondeo hacia abajo.
    /// @param shares Cantidad de shares a convertir.
    /// @return Cantidad estimada de activos.
    function convertToAssets(uint256 shares) public view virtual returns (uint256) {
        return _convertToAssets(shares, false);
    }

    /// @notice Maximo de activos que una cuenta puede depositar.
    /// @dev Por defecto no hay limite.
    /// @return Maximo permitido para deposit.
    function maxDeposit(address) public view virtual returns (uint256) {
        return type(uint256).max;
    }

    /// @notice Maximo de shares que una cuenta puede mintear.
    /// @dev Por defecto no hay limite.
    /// @return Maximo permitido para mint.
    function maxMint(address) public view virtual returns (uint256) {
        return type(uint256).max;
    }

    /// @notice Maximo de activos que el owner puede retirar actualmente.
    /// @param owner Titular de las shares.
    /// @return Maximo de activos retirables.
    function maxWithdraw(address owner) public view virtual returns (uint256) {
        return convertToAssets(balanceOf[owner]);
    }

    /// @notice Maximo de shares que el owner puede redimir actualmente.
    /// @param owner Titular de las shares.
    /// @return Maximo de shares redimibles.
    function maxRedeem(address owner) public view virtual returns (uint256) {
        return balanceOf[owner];
    }

    /// @notice Simula deposit y estima shares acuñadas para assets dados.
    /// @param assets Activos de entrada.
    /// @return Shares estimadas con redondeo hacia abajo.
    function previewDeposit(uint256 assets) public view virtual returns (uint256) {
        return _convertToShares(assets, false);
    }

    /// @notice Simula mint y estima activos requeridos para shares dadas.
    /// @param shares Shares objetivo.
    /// @return Activos estimados con redondeo hacia arriba.
    function previewMint(uint256 shares) public view virtual returns (uint256) {
        return _convertToAssets(shares, true);
    }

    /// @notice Simula withdraw y estima shares a quemar por assets dados.
    /// @param assets Activos objetivo de salida.
    /// @return Shares estimadas con redondeo hacia arriba.
    function previewWithdraw(uint256 assets) public view virtual returns (uint256) {
        return _convertToShares(assets, true);
    }

    /// @notice Simula redeem y estima activos obtenidos por shares dadas.
    /// @param shares Shares a redimir.
    /// @return Activos estimados con redondeo hacia abajo.
    function previewRedeem(uint256 shares) public view virtual returns (uint256) {
        return _convertToAssets(shares, false);
    }

    /// @notice Deposita activos y acuña shares para receiver.
    /// @param assets Cantidad de activos a depositar.
    /// @param receiver Cuenta que recibira las shares.
    /// @return shares Cantidad de shares acuñadas.
    function deposit(uint256 assets, address receiver) external virtual returns (uint256 shares) {
        if (receiver == address(0)) revert ZeroAddress();
        if (assets == 0) revert ZeroAmount();
        if (assets > maxDeposit(receiver)) revert InsufficientAssets();

        // En deposito: el usuario entrega activos y recibe shares (redondeo hacia abajo).
        shares = previewDeposit(assets);
        if (shares == 0) revert ZeroAmount();

        _afterDeposit(assets, shares);
        _safeTransferFrom(address(assetToken), msg.sender, address(this), assets);
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    /// @notice Acuña una cantidad fija de shares cobrando los activos necesarios.
    /// @param shares Cantidad de shares a acuñar.
    /// @param receiver Cuenta que recibira las shares.
    /// @return assets Cantidad de activos transferidos al vault.
    function mint(uint256 shares, address receiver) external virtual returns (uint256 assets) {
        if (receiver == address(0)) revert ZeroAddress();
        if (shares == 0) revert ZeroAmount();
        if (shares > maxMint(receiver)) revert InsufficientShares();

        // En mint: se fija cantidad de shares y se calcula activos requeridos (redondeo hacia arriba).
        assets = previewMint(shares);
        if (assets == 0) revert ZeroAmount();

        _afterDeposit(assets, shares);
        _safeTransferFrom(address(assetToken), msg.sender, address(this), assets);
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    /// @notice Retira una cantidad fija de activos quemando las shares necesarias.
    /// @param assets Cantidad de activos a retirar.
    /// @param receiver Cuenta que recibe los activos.
    /// @param owner Titular de las shares a quemar.
    /// @return shares Cantidad de shares quemadas.
    function withdraw(uint256 assets, address receiver, address owner) external virtual returns (uint256 shares) {
        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
        if (assets == 0) revert ZeroAmount();
        if (assets > maxWithdraw(owner)) revert InsufficientAssets();

        // En withdraw: se fija activos a retirar y se calculan shares a quemar (redondeo hacia arriba).
        shares = previewWithdraw(assets);
        if (shares == 0) revert ZeroAmount();

        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }

        _beforeWithdraw(assets, shares);
        _burn(owner, shares);
        _safeTransfer(address(assetToken), receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    /// @notice Redime una cantidad fija de shares y entrega activos al receiver.
    /// @param shares Cantidad de shares a redimir.
    /// @param receiver Cuenta que recibe los activos.
    /// @param owner Titular de las shares.
    /// @return assets Cantidad de activos entregados.
    function redeem(uint256 shares, address receiver, address owner) external virtual returns (uint256 assets) {
        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
        if (shares == 0) revert ZeroAmount();
        if (shares > maxRedeem(owner)) revert InsufficientShares();

        // En redeem: se fija shares a quemar y se calculan activos de salida (redondeo hacia abajo).
        assets = previewRedeem(shares);
        if (assets == 0) revert ZeroAmount();

        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }

        _beforeWithdraw(assets, shares);
        _burn(owner, shares);
        _safeTransfer(address(assetToken), receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    /// @notice Hook ejecutado despues de calcular deposit/mint y antes de transferir activos.
    /// @dev Sobrescribir para invertir activos en estrategia.
    /// @param assets Activos del flujo de entrada.
    /// @param shares Shares del flujo de entrada.
    function _afterDeposit(uint256 assets, uint256 shares) internal virtual {}

    /// @notice Hook ejecutado antes de quemar shares en withdraw/redeem.
    /// @dev Sobrescribir para desinvertir activos desde estrategia.
    /// @param assets Activos del flujo de salida.
    /// @param shares Shares del flujo de salida.
    function _beforeWithdraw(uint256 assets, uint256 shares) internal virtual {}

    /// @notice Conversion interna de activos a shares.
    /// @param assets Cantidad de activos a convertir.
    /// @param roundUp Si true, redondea hacia arriba cuando hay residuo.
    /// @return Shares equivalentes.
    function _convertToShares(uint256 assets, bool roundUp) internal view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 managedAssets = totalAssets();

        if (supply == 0 || managedAssets == 0) {
            // Relacion inicial 1:1 cuando no hay liquidez o no hay shares emitidas.
            return assets;
        }

        uint256 shares = (assets * supply) / managedAssets;
        if (roundUp && (shares * managedAssets) / supply < assets) {
            shares += 1;
        }

        return shares;
    }

    /// @notice Conversion interna de shares a activos.
    /// @param shares Cantidad de shares a convertir.
    /// @param roundUp Si true, redondea hacia arriba cuando hay residuo.
    /// @return Activos equivalentes.
    function _convertToAssets(uint256 shares, bool roundUp) internal view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 managedAssets = totalAssets();

        if (supply == 0 || managedAssets == 0) {
            // Relacion inicial 1:1 simetrica para previews y conversiones base.
            return shares;
        }

        uint256 assets = (shares * managedAssets) / supply;
        if (roundUp && (assets * supply) / managedAssets < shares) {
            assets += 1;
        }

        return assets;
    }

    /// @notice Acuña shares en una cuenta.
    /// @param to Receptor de shares.
    /// @param amount Cantidad a acuñar.
    function _mint(address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();

        totalSupply += amount;
        balanceOf[to] += amount;

        emit Transfer(address(0), to, amount);
    }

    /// @notice Quema shares de una cuenta.
    /// @param from Cuenta origen de las shares.
    /// @param amount Cantidad a quemar.
    function _burn(address from, uint256 amount) internal {
        uint256 fromBalance = balanceOf[from];
        if (fromBalance < amount) revert InsufficientShares();

        balanceOf[from] = fromBalance - amount;
        totalSupply -= amount;

        emit Transfer(from, address(0), amount);
    }

    /// @notice Transferencia interna de shares.
    /// @param from Cuenta origen.
    /// @param to Cuenta destino.
    /// @param amount Cantidad de shares.
    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();

        uint256 fromBalance = balanceOf[from];
        if (fromBalance < amount) revert InsufficientShares();

        balanceOf[from] = fromBalance - amount;
        balanceOf[to] += amount;

        emit Transfer(from, to, amount);
    }

    /// @notice Consume allowance de shares para gasto delegado.
    /// @param owner Titular de las shares.
    /// @param spender Gastador autorizado.
    /// @param amount Cantidad a consumir.
    function _spendAllowance(address owner, address spender, uint256 amount) internal {
        uint256 currentAllowance = allowance[owner][spender];
        if (currentAllowance == type(uint256).max) return;
        if (currentAllowance < amount) revert AllowanceExceeded();

        allowance[owner][spender] = currentAllowance - amount;
        emit Approval(owner, spender, allowance[owner][spender]);
    }

    /// @notice Wrapper de transferencia ERC20 tolerante a tokens no estandar.
    /// @param token Direccion del token ERC20.
    /// @param to Receptor.
    /// @param amount Cantidad a transferir.
    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20Minimal.transfer.selector, to, amount));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert InsufficientAssets();
        }
    }

    /// @notice Wrapper de transferencia delegada ERC20 tolerante a tokens no estandar.
    /// @param token Direccion del token ERC20.
    /// @param from Cuenta origen.
    /// @param to Cuenta destino.
    /// @param amount Cantidad a transferir.
    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSelector(IERC20Minimal.transferFrom.selector, from, to, amount));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert InsufficientAssets();
        }
    }
}