let TokenVesting = artifacts.require("./SimpleTokenVesting.sol");
let DebitumToken = artifacts.require("./DebitumToken.sol");


contract('SimpleTokenVesting', function (accounts) {
    let tokenVesting;

    beforeEach('Setup contract for each test', async function () {
        let now = Math.round(new Date().getTime() / 1000);
        tokenVesting = await TokenVesting.new(web3.eth.accounts[2],  now + 2);
    });

    it('Token cannot be transferred till vesting date', async function () {
        //given
        let transferError;
        let token = await DebitumToken.new();
        await token.unfreeze();
        const TRANSACTION_AMOUNT = web3.toWei(2, 'ether');
        await token.transfer(tokenVesting.address, TRANSACTION_AMOUNT);

        //when
        try {
            await tokenVesting.release(token.address, {from: accounts[2]});
        } catch (error) {
            transferError = error;
        }

        //then
        assert.notEqual(transferError, undefined, 'Error must be thrown, when tries to release tokens before vesting period');

        //when
        while (Math.round(new Date().getTime() / 1000) - 3  <= (await tokenVesting.vestedDate()).toNumber() ) {
        }

        await tokenVesting.release(token.address, {from: accounts[2]});

        //then
        assert.equal((await token.balanceOf(web3.eth.accounts[2])).toNumber(), TRANSACTION_AMOUNT, "Token balance of transaction destination is equal to " + TRANSACTION_AMOUNT);
    });


});