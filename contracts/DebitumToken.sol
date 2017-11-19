pragma solidity ^0.4.15;

import './FreezableToken.sol';

contract DebitumToken is FreezableToken {

    string public constant name = 'DEBITUM';
    string public constant symbol = 'DEB';
    uint8 public constant decimals = 18;
    uint256 public constant totalSupply = 1000000000 * 1 ether;

    function DebitumToken() {
        balances[msg.sender]  = totalSupply;
    }

}