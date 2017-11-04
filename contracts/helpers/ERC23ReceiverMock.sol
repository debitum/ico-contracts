pragma solidity ^0.4.11;


contract ERC23ReceiverMock {

    bool public isTokenReceiver;
    event TokenReceived(address _sender, address _origin, uint _value, bytes _data);

    function ERC23ReceiverMock(bool _isReceiver) {
        isTokenReceiver = _isReceiver;
    }

    function tokenFallback(address _sender, address _origin, uint _value, bytes _data) returns (bool ok){
        TokenReceived(_sender, _origin, _value, _data);
        return isTokenReceiver;
    }
}
