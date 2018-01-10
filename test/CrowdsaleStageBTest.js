
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
        crowdsale = await Crowdsale.new(now, now + 3600, accounts[7], token.address, [accounts[7]], [], []);
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
        assert.equal((await token.balanceOf(web3.eth.accounts[6])).toNumber(), web3.toWei(9300, 'ether'), "Investor gets 9300 tokens for 1.2 ether contribution")
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
            [web3.toWei(1, 'ether'), web3.toWei(2, 'ether'),web3.toWei(3, 'ether'), web3.toWei(4, 'ether'),web3.toWei(5, 'ether')],
            [7800, 7500, 7150, 6850, 6500]
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
        assert.equal(rate.toNumber(), 7800, "Firs step rate is equal to 7800");

        rate = await crowdsale.currentRate(web3.toWei(499.9999, 'ether'));
        assert.equal(rate.toNumber(), 7800, "Firs step rate is equal to 7800");

        rate = await crowdsale.currentRate(web3.toWei(500.0001, 'ether'));
        assert.equal(rate.toNumber(), 7500, "Second step rate bottom is equal to 7500");

        rate = await crowdsale.currentRate(web3.toWei(5999.999, 'ether'));
        assert.equal(rate.toNumber(), 7500, "Second step rate top is equal to 7500");

        rate = await crowdsale.currentRate(web3.toWei(6000.0001, 'ether'));
        assert.equal(rate.toNumber(), 7150, "Third step rate is equal to 7150");

        rate = await crowdsale.currentRate(web3.toWei(13999.999, 'ether'));
        assert.equal(rate.toNumber(), 7150, "Third step rate is equal to 7150");

        rate = await crowdsale.currentRate(web3.toWei(14000.0001, 'ether'));
        assert.equal(rate.toNumber(), 6850, "Fourth step rate is equal to 6850");

        rate = await crowdsale.currentRate(web3.toWei(19999.999, 'ether'));
        assert.equal(rate.toNumber(), 6850, "Third step rate is equal to 6850");

        rate = await crowdsale.currentRate(web3.toWei(20000.0001, 'ether'));
        assert.equal(rate.toNumber(), 0, "When hard cap is reached then token rate is equal to 0");
    });

    it("Contributors amount is monitored", async function () {
        await crowdsale.sendTransaction(
            {
                from: web3.eth.accounts[2],
                to: contract.address,
                value: web3.toWei(0.1, 'ether'),
            }
        );


        await crowdsale.sendTransaction(
            {
                from: web3.eth.accounts[1],
                to: contract.address,
                value: web3.toWei(0.2, 'ether'),
            }
        );

        await crowdsale.sendTransaction(
            {
                from: web3.eth.accounts[2],
                to: contract.address,
                value: web3.toWei(0.2, 'ether'),
            }
        );

        await crowdsale.sendTransaction(
            {
                from: web3.eth.accounts[3],
                to: contract.address,
                value: web3.toWei(0.4, 'ether'),
            }
        );

        let uniqueContributors = await crowdsale.uniqueContributors();
        assert.equal(uniqueContributors.toNumber(), 3, "Contrac counts unique contributors");

        let contributor1 = await crowdsale.contributors(0);
        let contribution1 = await crowdsale.investedAmountOf(contributor1);
        assert.equal(contributor1, web3.eth.accounts[2], "Contrac shows first contributor");
        assert.equal(contribution1.toNumber(), web3.toWei(0.3, 'ether'), "Contrac shows first contributor investments");

        let contributor2 = await crowdsale.contributors(1);
        let contribution2 = await crowdsale.investedAmountOf(contributor2);
        assert.equal(contributor2, web3.eth.accounts[1], "Contrac shows second contributor");
        assert.equal(contribution2.toNumber(), web3.toWei(0.2, 'ether'), "Contrac shows second contributor investments");

        let contributor3 = await crowdsale.contributors(2);
        let contribution3 = await crowdsale.investedAmountOf(contributor3);
        assert.equal(contributor3, web3.eth.accounts[3], "Contrac shows third contributor");
        assert.equal(contribution3.toNumber(), web3.toWei(0.4, 'ether'), "Contrac shows third contributor investments");

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
            [web3.toWei(1, 'ether'), web3.toWei(2, 'ether'),web3.toWei(3, 'ether'), web3.toWei(4, 'ether'),web3.toWei(5, 'ether')],
            [7800, 7500, 7150, 6850, 6500]
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
            [web3.toWei(1, 'ether'), web3.toWei(2, 'ether'),web3.toWei(3, 'ether'), web3.toWei(4, 'ether'),web3.toWei(5, 'ether')],
            [7800, 7500, 7150, 6850, 6500]
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
            [web3.toWei(1, 'ether'), web3.toWei(2, 'ether'),web3.toWei(3, 'ether'), web3.toWei(4, 'ether'),web3.toWei(5, 'ether')],
            [7800, 7500, 7150, 6850, 6500]
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

