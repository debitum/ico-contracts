let Crowdsale = artifacts.require("./CrowdsaleStageB.sol");
let DebitumToken = artifacts.require("./DebitumToken.sol");

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

    async function expectError( promise ) {
        try {
            await promise;
        } catch (error) {
            return;
        }
        assert.fail('Expected throw not received');
    }


});

