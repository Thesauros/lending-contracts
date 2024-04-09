// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title MockERC20
 *
 * @notice Mock implementation of a ERC20 token.
 *
 * @dev This contract also handles lending provider-like
 * logic to allow tracking of token balance in testing.
 */

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    event Deposit(string provider, address from, uint256 value);
    event Withdraw(string provider, address from, uint256 value);

    mapping(string => mapping(address => uint256)) private _balancesDeposit;

    uint8 public _decimals;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 decimals_
    ) ERC20(_name, _symbol) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    // mocking WETH
    function deposit() public payable {
        _mint(msg.sender, msg.value);
    }

    // mocking WETH
    function withdraw(uint256 value) public {
        _burn(msg.sender, value);
        payable(msg.sender).transfer(value);
    }

    function mint(address to, uint256 value) public {
        _mint(to, value);
    }

    function burn(address from, uint256 value) public {
        _burn(from, value);
    }

    function makeDeposit(
        address from,
        uint256 value,
        string memory provider
    ) public returns (bool success) {
        _balancesDeposit[provider][from] += value;
        _burn(from, value);
        emit Deposit(provider, from, value);
        success = true;
    }

    function withdrawDeposit(
        address to,
        uint256 value,
        string memory provider
    ) public returns (bool success) {
        _balancesDeposit[provider][to] -= value;
        _mint(to, value);
        emit Withdraw(provider, to, value);
        success = true;
    }

    function balanceOfDeposit(
        address who,
        string memory provider
    ) public view returns (uint256) {
        return _balancesDeposit[provider][who];
    }
}
