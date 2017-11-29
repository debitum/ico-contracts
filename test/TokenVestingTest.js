let TokenVesting = artifacts.require("./TokenVesting.sol");
let DebitumToken = artifacts.require("./DebitumToken.sol");
let TokenVestingAttacker = artifacts.require("./helpers/TokenVestingAttacker.sol");

contract('TokenVesting.sol', function (accounts) {
    let tokenVesting;
    let token;

    beforeEach('setup contract for each test', async function () {
        let now = Math.round(new Date().getTime()/1000);
        token = await DebitumToken.new();
        await token.unfreeze();
        tokenVesting = await TokenVesting.new(token.address, now,  {from: accounts[0]});
    });

    it('Only owner can add beneficiary', async function () {
        //given
        let transferError;

        //when
        await token.transfer(tokenVesting.address, web3.toWei(2, 'ether'), {from: accounts[0]});
        await tokenVesting.addBeneficiary(web3.eth.accounts[2], web3.toWei(1, 'ether'), {from: accounts[0]});

        try {
            await tokenVesting.addBeneficiary(web3.eth.accounts[1], web3.toWei(1, 'ether'), {from: accounts[1]});
        } catch(error) {
            transferError = error;
        }

        await tokenVesting.release();
        //then
        assert.notEqual(transferError, undefined, 'Error must be thrown, when not owner tries to add beneficiaries');
        assert.equal((await token.balanceOf(web3.eth.accounts[2])).toNumber(), web3.toWei(1, 'ether'), "One Debitum token has to be transferred");
        assert.equal((await token.balanceOf(web3.eth.accounts[1])).toNumber(), 0, "None Debitum token has to be transferred");
    });

    it('Tokens cannot be transferred more, then added to contract', async function () {
        //given
        let transferError;

        //when
        await token.transfer(tokenVesting.address, web3.toWei(1.1, 'ether'), {from: accounts[0]});
        await tokenVesting.addBeneficiary(web3.eth.accounts[1], web3.toWei(1, 'ether'), {from: accounts[0]});

        try {
            await tokenVesting.addBeneficiary(web3.eth.accounts[1], web3.toWei(1.1, 'ether'), {from: accounts[0]});
        } catch(error) {
            transferError = error;
        }

        await tokenVesting.release();
        //then
        assert.notEqual(transferError, undefined, 'Error must be thrown, when not owner tries to add beneficiaries');
        assert.equal((await token.balanceOf(web3.eth.accounts[1])).toNumber(), web3.toWei(1, 'ether'), "One Debitum token has to be transferred");
    });

    it('Should have released all after end', async function () {
        //given
        await token.transfer(tokenVesting.address, web3.toWei(1.1, 'ether'), {from: accounts[0]});
        await tokenVesting.addBeneficiary(web3.eth.accounts[2], web3.toWei(1, 'ether'), {from: accounts[0]});

        //when
        await tokenVesting.release();

        //then
        assert.equal((await token.balanceOf(web3.eth.accounts[2])).toNumber(), web3.toWei(1, 'ether'), "One Debitum token has to be transferred");
        assert.equal((await token.balanceOf(web3.eth.accounts[0])).toNumber(),  web3.toWei(400000000 - 1, 'ether'), "Not used tokens returned to owner");
    });

    it('Token can be vested form save user just once', async function () {
        //given
        await token.transfer(tokenVesting.address, web3.toWei(1.1, 'ether'), {from: accounts[0]});
        let attacker = await TokenVestingAttacker.new(tokenVesting.address);
        await tokenVesting.addBeneficiary(attacker.address, web3.toWei(0.5, 'ether'), {from: accounts[0]});

        //when
        await tokenVesting.release();

        //then
        assert.equal((await token.balanceOf(attacker.address)).toNumber(), web3.toWei(0.5, 'ether'), "Debitum token has to be transferred");
    });

    it('Beneficiary owner can withdraw their tokens', async function () {
        //given
        await token.transfer(tokenVesting.address, web3.toWei(1.1, 'ether'), {from: accounts[0]});
        await tokenVesting.addBeneficiary(web3.eth.accounts[2], web3.toWei(0.5, 'ether'), {from: accounts[0]});
        await tokenVesting.addBeneficiary(web3.eth.accounts[1], web3.toWei(0.5, 'ether'), {from: accounts[0]});

        //when
        await tokenVesting.withdraw( {from: accounts[2]});
        await tokenVesting.withdrawFor(web3.eth.accounts[1], {from: accounts[2]});

        //then
        assert.equal((await token.balanceOf(web3.eth.accounts[2])).toNumber(), web3.toWei(0.5, 'ether'), "Debitum token has to be transferred");
        assert.equal((await token.balanceOf(web3.eth.accounts[1])).toNumber(), web3.toWei(0.5, 'ether'), "Debitum token has to be transferred");
    });

    it('Tokens returned to owner if beneficiary is removed', async function () {
        //given
        let ownableTokens = (await token.balanceOf(web3.eth.accounts[0])).toNumber();
        await token.transfer(tokenVesting.address, web3.toWei(0.5, 'ether'), {from: accounts[0]});

        //when
        await tokenVesting.addBeneficiary(web3.eth.accounts[2], web3.toWei(0.5, 'ether'), {from: accounts[0]});
        await tokenVesting.removeBeneficiary(web3.eth.accounts[2], {from: accounts[0]});

        //then
        assert.equal((await token.balanceOf(web3.eth.accounts[0])).toNumber(), ownableTokens, "Debitum token returned to owner");
    });

});