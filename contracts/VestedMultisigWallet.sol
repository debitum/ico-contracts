pragma solidity 0.4.18;

import './interface/iERC223Receiver.sol';
import './zeppelin/StandardToken.sol';
import './zeppelin/Ownable.sol';
import './FreezableToken.sol';
import './SimpleMultisigWallet.sol';



/**
 * Contract of  vested multi-signature wallet
 * for handling transaction of ether and tokens after vesting period will expire.
 *
 * Handle
 * - owners management
 * - ether and token transactions management
 */
contract VestedMultisigWallet is SimpleMultisigWallet {

    //date till when multi-signature wallet will be vested
    uint public vestedDate;


    /// @dev Contract constructor sets initial owners and required number of confirmations.
    /// @param _owners List of initial owners.
    /// @param _required number of needed confirmation to proceed any action
    /// @param _vestedDate date till when multisignature will be vested
    function VestedMultisigWallet(address[] _owners, uint _required, uint _vestedDate)
    SimpleMultisigWallet(_owners, _required)
    public
    {
        vestedDate = _vestedDate;
    }

    /// @dev Allows anyone to execute a confirmed transaction.
    /// @param transactionId Transaction ID.
    function executeTransaction(uint transactionId)
    public
    notExecuted(transactionId)
    returns(bool)
    {
        if (transactions[transactionId].transactionType == TransactionType.Standard
        && isConfirmed(transactionId)
        && this.balance >= transactions[transactionId].value) {
            transactions[transactionId].executed = true;
            transactions[transactionId].destination.transfer(transactions[transactionId].value);
            Execution(transactionId, now);
            return true;
        } else if(transactions[transactionId].transactionType == TransactionType.Token
        && isConfirmed(transactionId)
        && StandardToken(transactions[transactionId].token).balanceOf(address(this)) >= transactions[transactionId].value) {
            require(now >= vestedDate);
            transactions[transactionId].executed = true;
            StandardToken(transactions[transactionId].token).transfer(transactions[transactionId].destination, transactions[transactionId].value);
            Execution(transactionId, now);
            return true;
        } else if(transactions[transactionId].transactionType == TransactionType.Unfreeze
        && isConfirmed(transactionId)) {
            transactions[transactionId].executed = true;
            FreezableToken(transactions[transactionId].token).unfreeze();
            Execution(transactionId, now);
            return true;
        } else if(transactions[transactionId].transactionType == TransactionType.PassOwnership
        && isConfirmed(transactionId)) {
            transactions[transactionId].executed = true;
            Ownable(transactions[transactionId].token).transferOwnership(transactions[transactionId].destination);
            Execution(transactionId, now);
            return true;
        }
        return false;
    }

}
