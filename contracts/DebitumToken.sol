pragma solidity 0.4.18;

import './FreezableToken.sol';

contract DebitumToken is FreezableToken {

    string public constant name = 'DEBITUM';
    string public constant symbol = 'DEB';
    uint8 public constant decimals = 18;
    uint256 public constant totalSupply = 400000000 * 1 ether;

    function DebitumToken() public {
        balances[msg.sender]  = totalSupply;
    }
}