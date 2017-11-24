pragma solidity ^0.4.15;


contract iERC223Token {
    function transfer(address to, uint value, bytes data) returns (bool ok);
    function transferFrom(address from, address to, uint value, bytes data) returns (bool ok);
}