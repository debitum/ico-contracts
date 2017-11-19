let DebitumToken = artifacts.require("./DebitumToken.sol");
var ERC23Receiver = artifacts.require("./helpers/ERC23ReceiverMock.sol");

contract('DebitumToken.sol', function (accounts) {
    let token;
    beforeEach('setup contract for each test', async function () {
        token = await DebitumToken.new(accounts[0]);
        await token.unfreeze();
    });

    it("Token contract should return the correct total supply after construction", async function() {
        let totalSupply = await token.totalSupply();

        assert.equal(totalSupply.toNumber(), web3.toWei(1000000000, 'ether'));
    });

    it('Token should throw an error when trying to transfer to 0x0', async function() {
        let transferError;

        try {
            await token.transfer(0x0, 100);
            assert.fail('should have thrown before');
        } catch(error) {
            transferError = error;
        }

        assert.notEqual(transferError, undefined, 'Error must be thrown, when trying to transfer to 0x0');
    });

    it('Token should throw an error when trying to transferFrom to 0x0', async function() {
        let transferError;

        await token.approve(accounts[1], 100);

        try {
            await token.transferFrom(accounts[0], 0x0, 100, {from: accounts[1]});
            assert.fail('should have thrown before');
        } catch(error) {
            transferError = error;
        }
        assert.notEqual(transferError, undefined, 'Error must be thrown, when trying to transferFrom to 0x0');
    });

    it("Token creator at the start has all tokens", async function () {
        let ownerTokenBalance = (await token.balanceOf(web3.eth.accounts[0], {from: accounts[0], gass: 3000000})).toNumber();
        assert.equal(ownerTokenBalance, await token.totalSupply(), "Owner of token contract has all tokens");
    });

    it("Should return the correct allowance amount after approval",  async function() {
        await token.approve(web3.eth.accounts[1], web3.toWei(100, 'ether'), {from: accounts[0], gass: 3000000})
        let allowance = await token.allowance(web3.eth.accounts[0], web3.eth.accounts[1]);
        assert.equal(allowance, web3.toWei(100, 'ether'), "Allowance must be the same as approved");
    });


    it("Should throw an error when trying to transfer more than allowed", async function() {
        await token.approve(web3.eth.accounts[1], web3.toWei(99, 'ether'),  {from: accounts[0], gass: 3000000});
        let transferError;
        try {
            let transfer = await token.transferFrom(web3.eth.accounts[0], web3.eth.accounts[2], web3.toWei(100, 'ether'), {from: accounts[1], gass: 3000000});
        } catch (error) {
            transferError = error;
        }
        assert.notEqual(transferError, undefined, 'Error must be thrown');
    });

    it("Should return correct balances after transfering from another account", async function() {
        let balance0, balance1, balance2;
        await token.approve(web3.eth.accounts[1], web3.toWei(100, 'ether'), {from: accounts[0], gass: 3000000});
        await token.transferFrom(web3.eth.accounts[0], web3.eth.accounts[2], web3.toWei(100, 'ether'), {from: accounts[1], gass: 3000000});
        balance0 = (await token.balanceOf(web3.eth.accounts[0])).toNumber();
        balance1 = (await token.balanceOf(web3.eth.accounts[1])).toNumber();
        balance2 = (await token.balanceOf(web3.eth.accounts[2])).toNumber();

        assert.equal(balance0, web3.toWei(1000000000 - 100, 'ether'));
        assert.equal(balance1, 0);
        assert.equal(balance2, web3.toWei(100, 'ether'));
    });

    it("Token should return correct balances after transfer", async function() {
        let TokenContract = await DebitumToken.new(accounts[0]);
        let transfer = await TokenContract.transfer(accounts[1], web3.toWei(100, 'ether'));
        let balance0 = await TokenContract.balanceOf(accounts[0]);
        assert.equal(balance0.toNumber(), web3.toWei(999999900, 'ether'));

        let balance1 = await TokenContract.balanceOf(accounts[1]);
        assert.equal(balance1.toNumber(), web3.toWei(100, 'ether'));
    });

    it('Should throw an error when trying to transfer more than balance', async function() {
        let transferError;
        let token = await DebitumToken.new(web3.eth.accounts[0]);
        try {
            await token.transfer(web3.eth.accounts[1], web3.toWei(1000000001, 'ether'));
        } catch(error) {
            transferError = error;
        }
        assert.notEqual(transferError, undefined, 'Error must be thrown, when user tries to send more tokens when user has');
    });

    it("Ether cannot be sent to token contract", async function() {
        let transferError;
        let token = await DebitumToken.new(web3.eth.accounts[0]);

        try {
            await token.sendTransaction(
                {
                    from: web3.eth.accounts[0],
                    to: contract.address,
                    value: web3.toWei(4, 'ether'),
                }
            );
        } catch (error) {
            transferError = error;
        }

        assert.notEqual(transferError, undefined, 'Error must be thrown, when user tries to send eher to contract');
    });

    it("Tokens may not by sent to another contract if it does not implement ERC23Receiver standard", async function() {
        let transferError;
        let tokenReceiver = await ERC23Receiver.new(false);
        var token = await DebitumToken.new(web3.eth.accounts[0]);
        try {
            await token.transfer(tokenReceiver.address, web3.toWei(1, 'ether'));
        } catch (error) {
            transferError = error;
        }

        assert.equal((await token.balanceOf(tokenReceiver.address)).toNumber(), web3.toWei(0, 'ether'), "Contract has to receive tokens");
    });

    it("Tokens may by sent to another contract if it implement ERC23Receiver standard", async function() {
        let tokenReceiver = await ERC23Receiver.new(true);
        var token = await DebitumToken.new(web3.eth.accounts[0]);
        await token.transfer(tokenReceiver.address, web3.toWei(1, 'ether'));

        assert.equal((await token.balanceOf(tokenReceiver.address)).toNumber(), web3.toWei(1, 'ether'), "Contract has to receive tokens");
    });

    it("Till token is freezed, only owner can transfer", async function() {
        let transferError;
        var token = await DebitumToken.new(web3.eth.accounts[0]);
        await token.transfer(web3.eth.accounts[1], web3.toWei(3, 'ether'));
        try {
            await token.transfer(web3.eth.accounts[2], web3.toWei(1, 'ether') , {from: accounts[1], gass: 3000000});
        }catch (error) {
            transferError = error;
        }
        await token.unfreeze();
        await token.transfer(web3.eth.accounts[2], web3.toWei(1, 'ether') , {from: accounts[1], gass: 3000000});
        assert.notEqual(transferError, undefined, 'Error must be thrown, when user tries to send tokens till them are not unfreezed');

        assert.equal((await token.balanceOf(web3.eth.accounts[1])).toNumber(), web3.toWei(2, 'ether'), "Account 1 has to receive tokens");
        assert.equal((await token.balanceOf(web3.eth.accounts[2])).toNumber(), web3.toWei(1, 'ether'), "Account 2 has to receive tokens");
    });

    describe('Validating allowance updates to spender', function() {
        let preApproved;
        let token;

        it('Allowance starts with zero', async function() {
            token = await DebitumToken.new(web3.eth.accounts[0]);
            preApproved = await token.allowance(accounts[0], accounts[1]);
            assert.equal(preApproved, 0);
        })

        it('Final allowance calculated correctly  after increases and decreases', async function() {
            await token.increaseApproval(accounts[1], 50);
            let postIncrease = await token.allowance(accounts[0], accounts[1]);
            assert.equal(preApproved.plus(50).toNumber(), postIncrease.toNumber());
            await token.decreaseApproval(accounts[1], 10);
            let postDecrease = await token.allowance(accounts[0], accounts[1]);
            assert.equal(postIncrease.minus(10).toNumber(), postDecrease.toNumber());
        })
    });

});