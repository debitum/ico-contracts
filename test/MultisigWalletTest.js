let MultiSigWallet = artifacts.require("./MultiSigWallet.sol");
let DebitumToken = artifacts.require("./DebitumToken.sol");

contract('MultiSigWallet', function(accounts) {

    it('Requires multiple confirmations', async function () {
        let additionalOwners = accounts.slice(1, 4);
        let wallet = await MultiSigWallet.new(additionalOwners, 2);

        await wallet.sendTransaction(
            {
                from: web3.eth.accounts[0],
                to: contract.address,
                value: web3.toWei(3, 'ether'),
            }
        );

        let transaction = await wallet.submitTransaction(web3.eth.accounts[2], 2);
        assert.equal(transaction.logs.length, 2);
        let txid = transaction.logs[0].args.transactionId.toNumber();

        assert.equal(transaction.logs[0].event, 'Submission');
        assert.equal(transaction.logs[1].event, 'Confirmation');

        let confirmations = await wallet.getConfirmations(txid);
        assert.equal(confirmations.length, 1);

        assert.equal((await wallet.getConfirmationCount(txid)).toNumber(), 1);

        await wallet.revokeConfirmation(txid);
        assert.equal((await wallet.getConfirmationCount(txid)).toNumber(), 0);
    });

    it('After getting required confirmations ether transferred to destination', async function () {
        //given
        let additionalOwners = accounts.slice(1, 4);
        const REQUIRED_CONFIRMATIONS = 2;
        const TRANSACTION_DESTINATION = web3.eth.accounts[2];
        const BALANCE_OF_DESTINATION = web3.eth.getBalance(TRANSACTION_DESTINATION);
        const TRANSACTION_AMOUNT = web3.toWei(2, 'ether');
        let wallet = await MultiSigWallet.new(additionalOwners, REQUIRED_CONFIRMATIONS);

        await wallet.sendTransaction(
            {
                from: web3.eth.accounts[0],
                to: contract.address,
                value: web3.toWei(3, 'ether'),
            }
        );

        //when
        let transaction = await wallet.submitTransaction(TRANSACTION_DESTINATION, TRANSACTION_AMOUNT);
        let txid = transaction.logs[0].args.transactionId.toNumber();
        await wallet.confirmTransaction(txid, {from: accounts[1]})

        //then
        assert.equal(web3.eth.getBalance(TRANSACTION_DESTINATION) - BALANCE_OF_DESTINATION, TRANSACTION_AMOUNT, "Ether balance of transaction destination increased by " +TRANSACTION_AMOUNT);
        assert.equal((await wallet.getTransactionCount(false, true)).toNumber(), 1, "Number of executed transaction is equal to 1");
    });

    it('After getting required confirmations tokens transferred to destination', async function () {
        //given
        let token = await DebitumToken.new();
        await token.unfreeze();
        let additionalOwners = accounts.slice(1, 4);
        const REQUIRED_CONFIRMATIONS = 2;
        const TRANSACTION_DESTINATION = web3.eth.accounts[2];
        const TRANSACTION_AMOUNT = web3.toWei(2, 'ether');
        let wallet = await MultiSigWallet.new(additionalOwners, REQUIRED_CONFIRMATIONS);
        await token.transfer(wallet.address, TRANSACTION_AMOUNT);

        //when
        let transaction = await wallet.submitTokenTransaction(token.address, TRANSACTION_DESTINATION, TRANSACTION_AMOUNT);
        let txid = transaction.logs[0].args.transactionId.toNumber();
        await wallet.confirmTransaction(txid, {from: accounts[1]})

        //then
        assert.equal((await token.balanceOf(TRANSACTION_DESTINATION)).toNumber(), TRANSACTION_AMOUNT, "Token balance of transaction destination is equal to " + TRANSACTION_AMOUNT);
        assert.equal((await wallet.getTransactionCount(false, true)).toNumber(), 1, "Number of executed transaction is equal to 1");
    });

    it("Eth transaction confirmation cannot be revoked by owner who not confirmed transaction earlier", async function(){
        //given
        let transferError;
        let additionalOwners = accounts.slice(1, 4);
        let wallet = await MultiSigWallet.new(additionalOwners, 4);
        const TRANSACTION_DESTINATION = web3.eth.accounts[2];
        const TRANSACTION_AMOUNT = web3.toWei(2, 'ether');

        //when
        let transaction = await wallet.submitTransaction(TRANSACTION_DESTINATION, TRANSACTION_AMOUNT);
        let txid = transaction.logs[0].args.transactionId.toNumber();
        await wallet.confirmTransaction(txid, {from: accounts[1]})

        try {
            await wallet.revokeConfirmation(txid, {from: accounts[2]});
        } catch (error) {
            transferError = error;
        }

        //then
        assert.notEqual(transferError, undefined, 'Error must be thrown, when owner, who did not confirmed transaction tries to revoke it');
    });

    it("Owner removal needs confirmations of required owners", async function () {
        let additionalOwners = accounts.slice(1, 5);
        const REQUIRED_CONFIRMATION = 3;
        let wallet = await MultiSigWallet.new(additionalOwners, REQUIRED_CONFIRMATION);

        let owners = await wallet.getOwners();

        assert.equal(owners.length, 5, "There are 5  owners");

        wallet.removeOwner(web3.eth.accounts[1]);
        owners = await wallet.getOwners();
        assert.equal(owners.length, 5, "There are 5 owners after deletion");

        wallet.removeOwner(web3.eth.accounts[1], {from: accounts[2], gass: 3000000});
        owners = await wallet.getOwners();
        assert.equal(owners.length, 5, "There are 5 owners after deletion");

        wallet.removeOwner(web3.eth.accounts[1], {from: accounts[3], gass: 3000000});
        owners = await wallet.getOwners();
        assert.equal(owners.length, 4, "There are 4 owners after deletion");
    });



});