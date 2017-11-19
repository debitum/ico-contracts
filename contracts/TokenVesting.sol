pragma solidity ^0.4.15;

import './zeppelin/StandardToken.sol';
import './zeppelin/SafeERC20.sol';
import './zeppelin/Ownable.sol';

import './zeppelin/SafeMath.sol';
import './interface/iEC23Receiver.sol';

/**
 * @title TokenVesting
 * @dev A token holder contract that can release its token balance gradually like a
 * typical vesting scheme, with a cliff and vesting period. Optionally revocable by the
 * owner.
 */
contract TokenVesting is Ownable, ERC23Receiver {
  using SafeMath for uint256;
  using SafeERC20 for StandardToken;

  event Released(uint256 _amount, uint _createdOn);
  event BeneficiaryAdded(address _beneficiary, uint256 _amount, uint _createdOn);
  event BeneficiaryRemoved(address _beneficiary, uint _createdOn);


  uint public start;
  uint public duration;

  StandardToken public token;
  bool public released;


  mapping (address => uint256) public beneficiaries;
  address[] public beneficiaryOwners;
  uint256 public totalVestingTokenAmount;

  modifier canRelease() {
    require(!released);
    require(now >= start + duration);
    _;
  }

  modifier canRemoveBeneficiary(address _beneficiary) {
    require(beneficiaries[_beneficiary] > 0);
    require(!released);
    _;
  }

  modifier tokenAmountEnoughForVesting(uint256 additionalSupply) {
    require(additionalSupply > 0);
    require(token.balanceOf(address(this)) >= totalVestingTokenAmount.safeAdd(additionalSupply));
    _;
  }

  /**
   * @dev Creates a vesting contract that vests its balance of ERC20 token to the
   * beneficiaries, gradually in a linear fashion until _start + _duration. By then all
   * of the balance will have vested.
   * @param _token address of the token contract
   * @param _duration duration of the period in which the tokens will vest
   */
  function TokenVesting(StandardToken _token, uint _start, uint _duration) {
    require(address(_token) != 0x0);

    duration = _duration;
    start = _start;
    token = _token;
  }

  /**
   * @notice Add beneficiary to contract
   * @param _beneficiary address of account who will retrieve amount of token after period of time
   * @param _tokenAmount amount of tokens which account will retrieve
   */
  function addBeneficiary(address _beneficiary, uint256 _tokenAmount)
    public
    tokenAmountEnoughForVesting(_tokenAmount)
    onlyOwner
  {
      if(beneficiaries[_beneficiary] == 0) {
        beneficiaryOwners.push(_beneficiary);
      }

      beneficiaries[_beneficiary] = beneficiaries[_beneficiary].safeAdd(_tokenAmount);
      totalVestingTokenAmount = totalVestingTokenAmount.safeAdd(_tokenAmount);
      BeneficiaryAdded(_beneficiary, _tokenAmount, now);
  }

  /**
   * @notice Transfers vested tokens to beneficiaries.
   */
  function release()
    public
    canRelease
  {
    for (uint i = 0; i < beneficiaryOwners.length; i++) {
      token.safeTransfer(beneficiaryOwners[i], beneficiaries[beneficiaryOwners[i]]);
    }
    released = true;
    Released(totalVestingTokenAmount, now);
  }

  /**
   * @notice Allows the owner to remove beneficiary from the vesting.
   */
  function removeBeneficiary(address _beneficiary)
     public
     canRemoveBeneficiary(_beneficiary)
     onlyOwner
  {
    token.safeTransfer(owner, beneficiaries[_beneficiary]);
    beneficiaries[_beneficiary] = 0;

    for (uint i = 0; i < beneficiaryOwners.length - 1; i++) {
      if (beneficiaryOwners[i] == _beneficiary) {
        beneficiaryOwners[i] = beneficiaryOwners[beneficiaryOwners.length - 1];
        break;
      }
    }

    delete beneficiaryOwners[beneficiaryOwners.length - 1];
    beneficiaryOwners.length--;

    BeneficiaryRemoved(_beneficiary, now);
  }

  function tokenFallback(address _sender, address _origin, uint _value, bytes _data) public returns (bool ok) {
    return supportsToken(msg.sender);
  }

  function supportsToken(address _token) public returns (bool){
    return _token == address(token);
  }

}
