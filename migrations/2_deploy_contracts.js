let DebitumToken = artifacts.require("./DebitumToken.sol");

module.exports = function (deployer) {
    deployer.deploy(DebitumToken);
};
