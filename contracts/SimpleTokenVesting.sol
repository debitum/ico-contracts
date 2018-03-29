pragma solidity ^0.4.18;

import "./zeppelin/StandardToken.sol";
import "./zeppelin/SafeERC20.sol";
import "./zeppelin/Ownable.sol";
import "./zeppelin/SafeMath.sol";


/**
 * @title TokenVesting
 * @dev A token holder contract that can release its token balance.
 */
contract SimpleTokenVesting is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for StandardToken;

    event Released(uint256 amount, uint releaseDate);

    // beneficiary of tokens after they are released
    address public beneficiary;

    uint256 public vestedDate;

    mapping(address => uint256) public released;

    modifier vested() {
        require(now >= vestedDate);
        _;
    }

    /**
     * @dev Creates a vesting contract that vests its balance of any ERC20 token to the
     * _beneficiary
     * @param _beneficiary address of the beneficiary to whom vested tokens are transferred
     * @param _vestedDate the period in which the tokens will vest
     */
    function SimpleTokenVesting(address _beneficiary, uint256 _vestedDate) public {
        require(_beneficiary != address(0));
        require(_vestedDate >= now);

        beneficiary = _beneficiary;
        vestedDate = _vestedDate;
    }

    /**
     * @notice Transfers vested tokens to beneficiary.
     * @param token ERC20 token which is being vested
     */
    function release(StandardToken token)
    vested
    public
    {
        uint256 unreleased = token.balanceOf(this);

        require(unreleased > 0);

        released[token] = released[token].add(unreleased);

        token.safeTransfer(beneficiary, unreleased);

        Released(unreleased, now);
    }

    /// @dev Implementation of ERC223 receiver fallback function in order to protect
    /// @dev sending tokens (standard ERC223) to smart tokens who doesn't except them
    function tokenFallback(address /*_origin*/, uint /*_value*/, bytes /*_data*/) pure public returns (bool ok) {
        return true;
    }

}
