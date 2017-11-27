pragma solidity 0.4.18;

import './zeppelin/StandardToken.sol';
import './zeppelin/SafeERC20.sol';
import './zeppelin/Ownable.sol';

import './zeppelin/SafeMath.sol';
import './interface/iERC223Receiver.sol';

/**
 * @title TokenVesting
 * @dev A token holder contract that can release its token balance gradually like a
 * typical vesting scheme, with a cliff and vesting period. Optionally revocable by the
 * owner.
 */
contract TokenVesting is Ownable, ERC223Receiver {
  using SafeMath for uint256;
  using SafeERC20 for StandardToken;

  event Released(uint256 _amount, uint _createdOn);
  event BeneficiaryAdded(address _beneficiary, uint256 _amount, uint _createdOn);
  event BeneficiaryRemoved(address _beneficiary, uint _createdOn);

  uint public endDate;

  StandardToken public token;
  bool public released;


  mapping (address => uint256) public beneficiaries;
  address[] public beneficiaryOwners;
  uint256 public totalVestingTokenAmount;

  modifier canRelease() {
    require(!released);
    require(now >= endDate);
    _;
  }

  modifier canRemoveBeneficiary(address _beneficiary) {
    require(beneficiaries[_beneficiary] > 0);
    require(!released);
    _;
  }

  modifier tokenAmountEnoughForVesting(uint256 additionalSupply) {
    require(additionalSupply > 0);
    require(token.balanceOf(address(this)) >= totalVestingTokenAmount.add(additionalSupply));
    _;
  }

  /**
   * @dev Creates a vesting contract that vests its balance of ERC20 token to the
   * beneficiaries, gradually in a linear fashion until _end. By then all
   * of the balance will have vested.
   * @param _token address of the token contract
   * @param _end timestamp of period till which the tokens will vest
   */
  function TokenVesting(StandardToken _token, uint _end) public {
      require(address(_token) != 0x0);
      token = _token;
      endDate = _end;
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

      beneficiaries[_beneficiary] = beneficiaries[_beneficiary].add(_tokenAmount);
      totalVestingTokenAmount = totalVestingTokenAmount.add(_tokenAmount);
      BeneficiaryAdded(_beneficiary, _tokenAmount, now);
  }

  /**
  * @notice Withdraw tokens for msg.sender
  */
  function withdraw()
    public
    canRelease {
      withdrawFor(msg.sender);
  }

  /**
  * @notice Withdraw tokens for particular owner
  */
  function withdrawFor(address _owner)
    public
    canRelease {
      if(beneficiaries[_owner] > 0) {
          uint256 beneficiary;
          beneficiary = beneficiaries[_owner];
          beneficiaries[_owner] = 0;
          token.safeTransfer(_owner, beneficiary);
      }
  }

  /**
   * @notice Transfers vested tokens to beneficiaries.
   */
  function release()
    public
    canRelease
  {
      uint256 beneficiary;
      for (uint i = 0; i < beneficiaryOwners.length; i++) {
        if(beneficiaries[beneficiaryOwners[i]] > 0){
            beneficiary = beneficiaries[beneficiaryOwners[i]];
            beneficiaries[beneficiaryOwners[i]] = 0;
            token.safeTransfer(beneficiaryOwners[i], beneficiary);
        }
      }
      released = true;
      token.safeTransfer(owner, token.balanceOf(address(this)));
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
      uint256 beneficiary = beneficiaries[_beneficiary];
      beneficiaries[_beneficiary] = 0;
      token.safeTransfer(owner, beneficiary);
      totalVestingTokenAmount = totalVestingTokenAmount.sub(beneficiary);

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

  function tokenFallback(address /*_origin*/, uint /*_value*/, bytes /*_data*/) public returns (bool ok) {
    require(supportsToken(msg.sender));
    return true;
  }

  function supportsToken(address _token) public view returns (bool){
    return _token == address(token);
  }

}
