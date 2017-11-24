pragma solidity ^0.4.11;


contract ERC23ReceiverMock {

    bool public isTokenReceiver;
    event TokenReceived(address _origin, uint _value, bytes _data, bool answer);

    function ERC23ReceiverMock(bool _isReceiver) {
        isTokenReceiver = _isReceiver;
    }

    function () payable {
    }

    function tokenFallback(address _origin, uint _value, bytes _data) returns (bool ok){
        TokenReceived(_origin, _value, _data, isTokenReceiver);
        return isTokenReceiver;
    }

    function transferEth(address _to, uint _value) returns (bool success) {
        require(_to != address(0));
        require(_value <= this.balance);

        _to.transfer(_value);
        return true;
    }
}
