let Crowdsale = artifacts.require("./CrowdsaleStageB.sol");
let DebitumToken = artifacts.require("./DebitumToken.sol");
let MultiSigWallet = artifacts.require("./MultiSigWallet.sol");
let ERC23Receiver = artifacts.require("./helpers/ERC23ReceiverMock.sol");

contract('CrowdsaleStageB.sol', function (accounts) {
    let crowdsale;
    let token;
    let kraken_wallet = web3.eth.accounts[7];


    beforeEach('setup contract for each test', async function () {
        token = await DebitumToken.new(accounts[0]);
        await token.unfreeze();

        let now = Math.round(new Date().getTime() / 1000);
        crowdsale = await Crowdsale.new(now, now + 3600, accounts[7], token.address, [accounts[7]], 0, 0, 0, 0);
        let totalSupply = (await token.totalSupply()).toNumber();
        await token.transfer(crowdsale.address, totalSupply);
    });


    it("Should throw error when contribution made from known exchange addresses", async function () {

        expectError(
            crowdsale.sendTransaction(
            {
                from: kraken_wallet,
                to: contract.address,
                value: web3.toWei(1.2, 'ether'),
            }
        ));

        crowdsale.sendTransaction(
            {
                from: web3.eth.accounts[6],
                to: contract.address,
                value: web3.toWei(1.2, 'ether'),
            }
        );
        assert.equal((await token.balanceOf(web3.eth.accounts[6])).toNumber(), web3.toWei(3960, 'ether'), "Investor gets 3960 tokens for 1.2 ether contribution")
    });

    it("Let decrease initial hard cap if wei is not raised till new hard cap", async function () {
        //given
        token = await DebitumToken.new(accounts[0]);
        await token.unfreeze();
        let totalSupply = (await token.totalSupply()).toNumber();

        let now = Math.round(new Date().getTime() / 1000);
        crowdsale = await Crowdsale.new(
            now,
            now + 3600,
            accounts[7],
            token.address,
            [accounts[7]],
            web3.toWei(2, 'ether'),
            3300,
            web3.toWei(5, 'ether'),
            2888
        );
        await token.transfer(crowdsale.address, totalSupply);

        //when
        await crowdsale.sendTransaction(
            {
                from: web3.eth.accounts[2],
                to: contract.address,
                value: web3.toWei(3, 'ether'),
            }
        );

        expectError(crowdsale.changeHardCap(web3.toWei(2.9, 'ether')));

        await crowdsale.changeHardCap(web3.toWei(4.1, 'ether'));

        await crowdsale.sendTransaction(
            {
                from: web3.eth.accounts[2],
                to: contract.address,
                value: web3.toWei(5, 'ether'),
            }
        );

        //then
        assert.equal((await  crowdsale.weiRaised()).toNumber(), web3.toWei(4.1, 'ether'), "Wei raised till new hard cap");
    });

    it("Should return token rate by raised wei", async function () {
        let rate = await crowdsale.currentRate(0);
        assert.equal(rate.toNumber(), 3300, "Second step rate is equal to 3300");

        rate = await crowdsale.currentRate(web3.toWei(20999.999, 'ether'));
        assert.equal(rate.toNumber(), 3300, "Second step rate is equal to 3300");

        rate = await crowdsale.currentRate(web3.toWei(21000.0001, 'ether'));
        assert.equal(rate.toNumber(), 2888, "Third step rate is equal to 2888");

        rate = await crowdsale.currentRate(web3.toWei(45999.999, 'ether'));
        assert.equal(rate.toNumber(), 2888, "Third step rate is equal to 2888");

        rate = await crowdsale.currentRate(web3.toWei(46000.0001, 'ether'));
        assert.equal(rate.toNumber(), 0, "When hard cap is reached then token rate is equal to 0");
    });

    it("When hard cap is reached then crowdsale is finished", async function () {
        let now = Math.round(new Date().getTime() / 1000);
        token = await DebitumToken.new();

        crowdsale = await Crowdsale.new(
            now,
            now + 3600,
            accounts[7],
            token.address,
            [accounts[7]],
            web3.toWei(2, 'ether'),
            3300,
            web3.toWei(5, 'ether'),
            2888
        );
        let totalSupply = (await token.totalSupply()).toNumber();
        await token.transfer(crowdsale.address, totalSupply);
        await token.transferOwnership(crowdsale.address);
        let freezed = await token.freezed();

        assert.equal(freezed, true, "In the begining token is freezed");
        await crowdsale.sendTransaction(
            {
                from: web3.eth.accounts[0],
                to: contract.address,
                value: web3.toWei(1.3, 'ether'),
            }
        );

        await crowdsale.sendTransaction(
            {
                from: web3.eth.accounts[1],
                to: contract.address,
                value: web3.toWei(2, 'ether'),
            }
        );

        await crowdsale.sendTransaction(
            {
                from: web3.eth.accounts[2],
                to: contract.address,
                value: web3.toWei(5, 'ether'),
            }
        );
        token = DebitumToken.at(await crowdsale.token());

        await crowdsale.finalizeCrowdsale();
        assert.equal(await token.freezed(), false, "After Stage B end token will be unfreezed");
        assert.equal((await token.balanceOf(web3.eth.accounts[0])).toNumber(), web3.toWei(3300 * 1.3, 'ether'), "First step investor gets 7500 tokens");
        assert.equal((await token.balanceOf(web3.eth.accounts[1])).toNumber(), web3.toWei(6064.4, 'ether'), "Second step investor gets 6600 tokens");
        assert.equal((await token.balanceOf(web3.eth.accounts[2])).toNumber(), web3.toWei(4909.6, 'ether'), "Third step investor gets 5776 tokens");

    });

    it("Hard cap can not be increased above of initial hard cap", async function () {
        //given
        let transferError;
        let now = Math.round(new Date().getTime() / 1000);
        token = await DebitumToken.new();
        await token.unfreeze();
        crowdsale = await Crowdsale.new(
            now,
            now + 3600,
            accounts[7],
            token.address,
            [accounts[7]],
            web3.toWei(2, 'ether'),
            3300,
            web3.toWei(5, 'ether'),
            2888
        );
        let totalSupply = (await token.totalSupply()).toNumber();
        await token.transfer(crowdsale.address, totalSupply);
        await token.transferOwnership(crowdsale.address);

        //when
        await crowdsale.changeHardCap(web3.toWei(4.1, 'ether'));
        try {
            await crowdsale.canChangeHardCap(web3.toWei(5.001, 'ether'));
        }catch (error) {
            transferError = error;
        }

        //then
        assert.notEqual(transferError, undefined, 'Error must be thrown, when new hard cap value is above initial hard cap');
    });

    it("Should count left wei till step limit", async function () {
        let epsilon = 0.0001;

        let limit = await crowdsale.weiLimitOfCurrentStep(0);

        assert.equal(limit.toNumber(), web3.toWei(21000, 'ether'), "Second step eth limit has to be equal to " + (21000));

        limit = await crowdsale.weiLimitOfCurrentStep(web3.toWei(21000, 'ether'));
        assert.equal(limit.toNumber(), web3.toWei(46000 - 21000, 'ether'), "Third step eth limit has to be equal to " + (25000));

        limit = await crowdsale.weiLimitOfCurrentStep(web3.toWei(46000 - epsilon, 'ether'));
        assert.equal(limit.toNumber(), web3.toWei(epsilon, 'ether'));
    });

    it("Only signer can increase ends date", async function () {
        //given
        let transferError;
        let now = Math.round(new Date().getTime() / 1000);
        token = await DebitumToken.new();
        await token.unfreeze();
        crowdsale = await Crowdsale.new(
            now - 50,
            now - 10,
            accounts[7],
            token.address,
            [accounts[7]],
            web3.toWei(2, 'ether'),
            3300,
            web3.toWei(5, 'ether'),
            2888
        );

        expectError(crowdsale.increaseEndsDate(now - 3600));

        //when
        let state = await crowdsale.getState();
        //then
        assert.equal(state.toNumber(), 3, 'If ends date reached then crowdsale is finished');

        //when
        await crowdsale.increaseEndsDate(now + 3600);
        state = await crowdsale.getState();
        //then
        assert.equal(state.toNumber(), 1, 'If ends date increased then crowdsale is in funding state');
    });

    async function expectError( promise ) {
        try {
            await promise;
        } catch (error) {
            return;
        }
        assert.fail('Expected throw not received');
    }


});

