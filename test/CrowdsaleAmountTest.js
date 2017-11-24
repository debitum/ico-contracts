let Crowdsale = artifacts.require("./Crowdsale.sol");
let MultiSigWallet = artifacts.require("./MultiSigWallet.sol");

contract('Crowdsale.sol', function (accounts) {
    let crowdsale;

    beforeEach('setup contract for each test', async function () {
        let now = Math.round(new Date().getTime() / 1000);
        crowdsale = await Crowdsale.new(now, now + 3600, accounts[7], 0, 0, 0, 0, 0, 0);
    });

    it("Contribution data is collected for each contributor", async function () {
        let now = Math.round(new Date().getTime() / 1000);
        let additionalOwners = accounts.slice(1, 4);
        let wallet = await MultiSigWallet.new(additionalOwners, 2);
        crowdsale = await Crowdsale.new(
            now,
            now + 3600,
            wallet.address,
            web3.toWei(1, 'ether'),
            3750,
            web3.toWei(2, 'ether'),
            3300,
            web3.toWei(3, 'ether'),
            2888
        );

        await crowdsale.sendTransaction(
            {
                from: web3.eth.accounts[4],
                to: contract.address,
                value: web3.toWei(0.3, 'ether'),
            }
        );
        await crowdsale.sendTransaction(
            {
                from: web3.eth.accounts[4],
                to: contract.address,
                value: web3.toWei(1.2, 'ether'),
            }
        );

        assert.equal((await crowdsale.investedAmountOf(web3.eth.accounts[4])).toNumber(), web3.toWei(1.5, 'ether'), "1.5 ehter was contributed");
        assert.equal((await crowdsale.tokenAmountOf(web3.eth.accounts[4])).toNumber(), web3.toWei(5400, 'ether'), "5400 token was purchased");
    });

});