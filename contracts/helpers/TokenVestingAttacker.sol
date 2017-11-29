pragma solidity 0.4.18;

import './../TokenVesting.sol';

contract TokenVestingAttacker {

    TokenVesting public tokenVesting;

    function TokenVestingAttacker(address vestingContract) public {
        tokenVesting = TokenVesting(vestingContract);
    }

    function () public payable {
    }

    function tokenFallback(address /*_origin*/, uint /*_value*/, bytes /*_data*/) public returns (bool){
        tokenVesting.release();
        return true;
    }
}
