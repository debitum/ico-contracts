pragma solidity ^0.4.11;

import "./zeppelin/SafeMath.sol";
import "./zeppelin/Ownable.sol";
import "./DebitumToken.sol";


/**
 * Contract for token sales.
 *
 * Handle
 * - start and end dates
 * - accepting investments
 * - minimum funding goal and refund
 * - various statistics during the crowdfund
 * - different pricing strategies
 */
contract Crowdsale is Ownable {
    using SafeMath for uint256;

    // Max size of owners that can be added to administration board
    uint constant public MAX_OWNER_COUNT = 5;

    // Debitum token we are selling
    DebitumToken public token;

    // address where funds are collected
    address public wallet;

    // Server side address that allowed add contributors (Ethereum addresses) that can participate in crowdsale
    address public signerAddress;

    // How much ETH each address has invested in crowdsale
    mapping (address => uint256) public investedAmountOf;

    // How much tokens crowdsale has credited for each investor address
    mapping (address => uint256) public tokenAmountOf;

    // Dictionary which shows has account (investors) addresses registered for crowdsale
    mapping (address => bool) public isRegisteredEthereumAddress;

    // Registered crowdsale participants Ethereum aacounts
    address[] public crowdsaleParticipants;

    // Can account register verified crowdsale participants
    mapping (address => bool) public isCrowdsaleParticipantSigner;

    // The UNIX timestamp that defines start date of the crowdsale
    uint256 public startsAt;

    // The UNIX timestamp that defines end date of the crowdsale
    uint256 public endsAt;

    // The number of tokens already sold through this contract
    uint public tokensSold = 0;

    // How many wei of funding was already raised
    uint public weiRaised = 0;

    // Is crowdsale finalized
    bool public finalized;

    uint256 public FIRST_STEP_UPPER_LIMIT = 4000 * 1 ether;
    uint256 public FIRST_STEP_RATE = 3750;

    uint256 public SECOND_STEP_UPPER_LIMIT = 50000 * 1 ether;
    uint256 public SECOND_STEP_RATE = 3300;

    uint256 public HARD_CAP = 200000 * 1 ether;
    uint256 private CROWDFUND_HARD_CAP = HARD_CAP;
    uint256 public THIRD_STEP_RATE = 2888;

    // Max amount of ether which could be invested for ether account which not proceeded verification
    uint256 public NOT_VERIFIED_WEI_LIMIT = 30 * 1 ether;

    /**
      * event for participant verification logging
      * @param participant who paid for the tokens
      * @param verificationCode weis paid for purchase
      * @param createdOn time of log
      */
    event ParticipantVerified(address participant, string verificationCode, uint256 createdOn);

    /**
      * event for token purchase logging
      * @param purchaser who paid for the tokens
      * @param value weis paid for purchase
      * @param amount amount of tokens purchased
      */
    event TokenPurchased(address purchaser, uint256 value, uint256 amount);

    /**
      * event for investment return (if FIRST_STEP_UPPER_LIMIT is not reached) logging
      * @param investor who paid for the tokens
      * @param amount weis returned
      * @param createdOn time of log
      */
    event InvestmentReturned(address investor, uint256 amount, uint256 createdOn);

    /**
      * event for tokens assignment to investor logging
      * @param investor who paid for the tokens
      * @param amount of tokens to be assigned
      * @param createdOn time of log
      */
    event TokenSentToInvestor(address investor, uint256 amount, uint256 createdOn);

    /**
      * event for crowdsale finalization logging
      * @param finalizer account who iniciated finalization
      * @param createdOn time of log
      */
    event CrowdsaleFinalized(address finalizer, uint256 createdOn);


    modifier investmentCanProceed() {
        assert(!isContract(msg.sender));
        assert(now >= startsAt && now <= endsAt);
        assert(msg.value >= 0.1 * 1 ether);
        assert(weiRaised < CROWDFUND_HARD_CAP);
        _;
    }

    modifier isCrowdsaleFinished() {
        assert(now > endsAt || weiRaised >= CROWDFUND_HARD_CAP);
        _;
    }

    modifier canChangeHardCap(uint256 _newHardCap, address signer) {
        assert(isCrowdsaleParticipantSigner[signer]);
        assert(_newHardCap > SECOND_STEP_UPPER_LIMIT && _newHardCap <= HARD_CAP);
        assert(_newHardCap > weiRaised);
        _;
    }

    modifier canAddCrowdsaleParticipants(address signer) {
        assert(isCrowdsaleParticipantSigner[signer]);
        _;
    }

    modifier verifiedForCrowdsale(address participant, uint256 weiAmount) {
        assert(isRegisteredEthereumAddress[participant] || tokenAmountOf[participant].safeAdd(weiAmount) <= NOT_VERIFIED_WEI_LIMIT);
        _;
    }


    modifier minimalCapReached() {
        assert(weiRaised >= FIRST_STEP_UPPER_LIMIT);
        _;
    }

    modifier notFinalized() {
        assert(!finalized);
        _;
    }

    /** State machine
       *
       * - Prefunding: We have not passed start time yet
       * - Funding: Active crowdsale
       * - Success: Minimum funding goal reached
       * - Failure: Minimum funding goal not reached before ending time
       * - Finalized: The finalized has been called and succesfully executed
       */
    enum State{PreFunding, Funding, Success, Failure, Finalized}


    function Crowdsale(
        uint _start,
        uint _end,
        address _wallet,
        uint256 _firstStepUpperLimit,
        uint256 _firstStepRate,
        uint256 _secondStepUpperLimit,
        uint256 _secondStepRate,
        uint256 _crowdfundHardCap,
        uint256 _thirdStepRate
    ) {
        require(_start > 0);
        require(_end > 0);
        require(_start < _end);

        owner = msg.sender;

        if ( _firstStepUpperLimit > 0
            && _firstStepRate > 0
            && _secondStepUpperLimit > 0
            && _secondStepRate > 0
            && _crowdfundHardCap > 0
            && _thirdStepRate > 0)
        {
            FIRST_STEP_UPPER_LIMIT = _firstStepUpperLimit;
            FIRST_STEP_RATE = _firstStepRate;

            SECOND_STEP_UPPER_LIMIT = _secondStepUpperLimit;
            SECOND_STEP_RATE = _secondStepRate;

            HARD_CAP = _crowdfundHardCap;
            CROWDFUND_HARD_CAP = _crowdfundHardCap;
            THIRD_STEP_RATE = _thirdStepRate;
        }

        token = new DebitumToken();

        isCrowdsaleParticipantSigner[msg.sender] = true;

        wallet = _wallet;
        startsAt = _start;
        endsAt = _end;
    }

    function () payable {
        buyTokens();
    }

    /**
      * Add verified crowdsale participant
      * @param _participant crowdsale participant who passed verification process
      * @param _verificationCode code assigned for participant in verifiaction process
      */
    function signCrowdsaleParticipant(address _participant, string _verificationCode)
        public
        canAddCrowdsaleParticipants(msg.sender)
    {
        if (!isRegisteredEthereumAddress[_participant]) {
            crowdsaleParticipants.push(_participant);
        }
        isRegisteredEthereumAddress[_participant] = true;
        ParticipantVerified(_participant, _verificationCode, now);
    }

    // token purchase function
    function buyTokens()
        public
        investmentCanProceed
        verifiedForCrowdsale(msg.sender, msg.value)
        payable
    {
        uint256 weiAmount = investmentWeiLimit(msg.value);

        // calculate token amount to be transferred
        uint256 tokens = calculateTokenAmountFor(weiRaised, weiAmount);

        weiRaised = weiRaised.safeAdd(weiAmount);

        investedAmountOf[msg.sender] = investedAmountOf[msg.sender].safeAdd(weiRaised);
        tokenAmountOf[msg.sender] = tokenAmountOf[msg.sender].safeAdd(tokens);

        TokenPurchased(msg.sender, weiAmount, tokens);
    }

    function changeHardCap(uint256 _newHardCap)
        external
        canChangeHardCap(_newHardCap, msg.sender)
    {
        CROWDFUND_HARD_CAP = _newHardCap;
    }

    /**
      * Calculate token amount for purchase
      * @param _weiRaised wei already raised
      * @param _weiAmount invested wei amount for token purchase
      */
    function calculateTokenAmountFor(uint256 _weiRaised, uint256 _weiAmount) constant  public returns(uint256) {
        if(_weiAmount == 0) {
            return 0;
        } else {
            uint256 tokenAmount = 0;
            _weiAmount = investmentWeiLimit(_weiAmount);
            if (weiLimitOfCurrentStep(_weiRaised) <= _weiAmount) {
                tokenAmount = weiLimitOfCurrentStep(_weiRaised).safeMul(currentRate(_weiRaised));
                uint256 tokenAmountNextStep = calculateTokenAmountFor(_weiRaised.safeAdd(weiLimitOfCurrentStep(_weiRaised)), _weiAmount.safeSub(weiLimitOfCurrentStep(_weiRaised)));
                tokenAmount = tokenAmount.safeAdd(tokenAmountNextStep);
            } else {
                tokenAmount = _weiAmount.safeMul(currentRate(_weiRaised));
            }

            return tokenAmount;
        }
    }

    /**
      * Calculate wei limit which can be invested to get tokens by current step rate
      * @param _weiRaised wei already raised
      */
    function weiLimitOfCurrentStep(uint256 _weiRaised) constant public returns(uint256) {
        if (_weiRaised < FIRST_STEP_UPPER_LIMIT) {
            return FIRST_STEP_UPPER_LIMIT.safeSub(_weiRaised);
        } else if (_weiRaised < SECOND_STEP_UPPER_LIMIT ) {
            return SECOND_STEP_UPPER_LIMIT.safeSub(_weiRaised);
        } else if (_weiRaised < CROWDFUND_HARD_CAP) {
            return CROWDFUND_HARD_CAP.safeSub(_weiRaised);
        } else {
            return 0;
        }
    }

    /**
      * Calculate wei limit which can be invested in crowdsale.
      * Function used to determine if user can invest all wanted wei amount.
      * @param _weiAmount wei that investor want to invest
      */
    function investmentWeiLimit(uint256 _weiAmount) constant private returns(uint256) {
        if (CROWDFUND_HARD_CAP <= weiRaised.safeAdd(_weiAmount)) {
            return CROWDFUND_HARD_CAP.safeSub(weiRaised);
        } else {
            return _weiAmount;
        }
    }

    /**
      * Calculate token rate by already raised wei.
      * @param _weiRaised wei that already was raised
      */
    function currentRate(uint256 _weiRaised) constant public  returns(uint256) {
        if (_weiRaised < FIRST_STEP_UPPER_LIMIT) {
            return FIRST_STEP_RATE;
        } else if (_weiRaised < SECOND_STEP_UPPER_LIMIT) {
            return SECOND_STEP_RATE;
        } else if (_weiRaised < CROWDFUND_HARD_CAP) {
            return THIRD_STEP_RATE;
        } else {
            return 0;
        }
    }

    /**
      * Initiate crwodsale finalization.
      * After initiation tokens will be send to investors
      * if minimal amount of wei is invested
      * otherwise all invested wei are returned to investors.
      */
    function finalizeCrowdsale()
        public
        isCrowdsaleFinished
        notFinalized
    {
        finalized = true;
        uint256 amount;
        if(FIRST_STEP_UPPER_LIMIT <= weiRaised){
            uint soldTokenAmount;
            for (uint i = 0; i < crowdsaleParticipants.length; i++) {
                if (tokenAmountOf[crowdsaleParticipants[i]] > 0){
                    amount = tokenAmountOf[crowdsaleParticipants[i]];
                    tokenAmountOf[crowdsaleParticipants[i]] = 0;
                    token.transfer(crowdsaleParticipants[i], amount);
                    TokenSentToInvestor(crowdsaleParticipants[i], amount, now);
                    soldTokenAmount = soldTokenAmount.safeAdd(amount);
                }
            }
            //uint reserve = token.totalSupply().safeDiv(HUNDRED_PERCENT).safeMul(RESERVE_PERCENT_OF_TOTAL);
            uint reserve = token.totalSupply().safeSub(soldTokenAmount);
            token.transfer(address(wallet), reserve);
        } else {
            for (uint j = 0; j < crowdsaleParticipants.length; j++) {
                if (investedAmountOf[crowdsaleParticipants[j]] > 0){
                    amount = investedAmountOf[crowdsaleParticipants[j]];
                    investedAmountOf[crowdsaleParticipants[j]] = 0;
                    crowdsaleParticipants[j].transfer(amount);
                    InvestmentReturned(crowdsaleParticipants[j], amount, now);
                }
            }
            token.transfer(address(wallet), token.totalSupply());
        }

        CrowdsaleFinalized(msg.sender, now);

    }

    // @notice Send ether to the fund collection wallet
    function forwardFunds()
        public
        minimalCapReached
    {
        wallet.transfer(this.balance);
    }

    function isContract(address _addr) private returns (bool is_contract) {
        uint length;
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }


}
