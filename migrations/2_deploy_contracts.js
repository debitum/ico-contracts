let MultisigWallet = artifacts.require("./MultisigWallet.sol");
let Crowdsale = artifacts.require("./Crowdsale.sol");
let owners = [web3.eth.accounts[0], web3.eth.accounts[1], web3.eth.accounts[2], web3.eth.accounts[3], web3.eth.accounts[4]];
let start = 1512658800;
let end = 1513868400;
let requiredConfirmation = 3;

module.exports = function (deployer) {
    deployer.deploy(MultisigWallet, owners, requiredConfirmation).then(function () {
        return deployer.deploy(Crowdsale, start, end, MultisigWallet.address, 0, 0, 0, 0, 0, 0);
    });
};
