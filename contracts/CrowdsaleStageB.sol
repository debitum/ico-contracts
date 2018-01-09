pragma solidity 0.4.18;

import "./zeppelin/SafeMath.sol";
import "./zeppelin/Ownable.sol";
import "./zeppelin/StandardToken.sol";
import "./DebitumToken.sol";
import "./MultisigWallet.sol";



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
contract CrowdsaleStageB is Ownable {
    using SafeMath for uint256;

    // Debitum token we are selling
    DebitumToken public token;

    // address where funds are collected
    MultiSigWallet public wallet;

    // How much ETH each address has invested in crowdsale
    mapping (address => uint256) public investedAmountOf;

    // How much tokens crowdsale has credited for each investor address
    mapping (address => uint256) public tokenAmountOf;

    // Dictionary which shows has account (investors) addresses registered for crowdsale
    mapping (address => bool) public isRegisteredEthereumAddress;

    // Can account register verified crowdsale participants
    mapping (address => bool) public isCrowdsaleParticipantSigner;

    // Crowdsale contributors
    mapping (uint => address) public contributors;

    // Known exchange addresses
    mapping (address => bool) public exchanges;

    // The UNIX timestamp that defines start date of the crowdsale
    uint256 public startsAt;

    // The UNIX timestamp that defines end date of the crowdsale
    uint256 public endsAt;

    // How many wei of funding was already raised
    uint public weiRaised = 0;

    // Is crowdsale finalized
    bool public finalized;

    uint256 public SECOND_STEP_UPPER_LIMIT = 21000 * (10 ** uint256(18));
    uint256 public SECOND_STEP_RATE = 3300;

    uint256 public HARD_CAP = 46000 * 1 ether;
    uint256 private CROWDFUND_HARD_CAP = HARD_CAP;
    uint256 public THIRD_STEP_RATE = 2888;

    // Max amount of ether which could be invested for ether account which not proceeded verification
    uint256 public constant NOT_VERIFIED_WEI_LIMIT = 30 * (10 ** uint256(18));

    // Crowdsale unique contributors number
    uint public uniqueContributors;



    /**
      * event for participant verification logging
      * @param participant who paid for the tokens
      * @param verificationCode weis paid for purchase
      * @param createdOn time of log
      */
    event ParticipantVerified(address indexed participant, string verificationCode, uint256 createdOn);

    /**
      * event for token purchase logging
      * @param purchaser who paid for the tokens
      * @param value weis paid for purchase
      * @param amount amount of tokens purchased
      * @param createdOn time of log
      */
    event TokenPurchased(address indexed purchaser, uint256 value, uint256 amount, uint256 createdOn);

    /**
      * event for investment return (if FIRST_STEP_UPPER_LIMIT is not reached) logging
      * @param investor who paid for the tokens
      * @param amount weis returned
      * @param createdOn time of log
      */
    event InvestmentReturned(address indexed investor, uint256 amount, uint256 createdOn);

    /**
      * event for tokens assignment to investor logging
      * @param investor who paid for the tokens
      * @param amount of tokens to be assigned
      * @param createdOn time of log
      */
    event TokenSentToInvestor(address indexed investor, uint256 amount, uint256 createdOn);

    /**
      * event for crowdsale finalization logging
      * @param finalizer account who iniciated finalization
      * @param createdOn time of log
      */
    event CrowdsaleFinalized(address indexed finalizer, uint256 createdOn);

    modifier investmentCanProceed() {
        require(!isContract(msg.sender));
        require(now >= startsAt && now <= endsAt);
        require(msg.value >= 0.1 * 1 ether);
        require(weiRaised < CROWDFUND_HARD_CAP);
        _;
    }

    modifier isCrowdsaleFinished() {
        require(now > endsAt || weiRaised >= CROWDFUND_HARD_CAP);
        _;
    }

    modifier isNotExchange() {
        require(!exchanges[msg.sender]);
        _;
    }

    modifier canChangeHardCap(uint256 _newHardCap, address signer) {
        require(isCrowdsaleParticipantSigner[signer]);
        require(_newHardCap > SECOND_STEP_UPPER_LIMIT && _newHardCap <= HARD_CAP);
        require(_newHardCap > weiRaised);
        _;
    }

    modifier canIncreaseEndDate(uint256 _endsAt) {
        require(isCrowdsaleParticipantSigner[msg.sender]);
        require(endsAt < _endsAt);
        _;
    }

    modifier canAddCrowdsaleParticipants(address signer) {
        require(isCrowdsaleParticipantSigner[signer]);
        _;
    }

    modifier verifiedForCrowdsale {
        require(isRegisteredEthereumAddress[msg.sender] || investedAmountOf[msg.sender] < NOT_VERIFIED_WEI_LIMIT);
        _;
    }

    modifier notFinalized() {
        require(!finalized);
        _;
    }

    modifier canForwardTokens {
        require(isCrowdsaleParticipantSigner[msg.sender]);
        _;
    }

    /** State machine
       *
       * - Prefunding: We have not passed start time yet
       * - Funding: Active crowdsale
       * - Success: Minimum funding goal reached
       * - Finished: Crowdsale ended
       * - Finalized: The finalized has been called and succesfully executed
       */
    enum State{PreFunding, Funding, Success, Finished, Finalized}


    function CrowdsaleStageB(
        uint _start,
        uint _end,
        MultiSigWallet _wallet,
        DebitumToken _token,
        address[] _exchanges,
        uint256 _secondStepUpperLimit,
        uint256 _secondStepRate,
        uint256 _crowdfundHardCap,
        uint256 _thirdStepRate
    ) public {
        require(_start > 0);
        require(_start < _end);
        require(address(_wallet) != 0x0);

        if (_secondStepUpperLimit > 0
            && _secondStepRate > 0
            && _crowdfundHardCap > 0
            && _thirdStepRate > 0)
        {

            SECOND_STEP_UPPER_LIMIT = _secondStepUpperLimit;
            SECOND_STEP_RATE = _secondStepRate;

            HARD_CAP = _crowdfundHardCap;
            CROWDFUND_HARD_CAP = _crowdfundHardCap;
            THIRD_STEP_RATE = _thirdStepRate;
        }

        token = _token;

        isCrowdsaleParticipantSigner[msg.sender] = true;

        if(_exchanges.length == 0) {
            mapExchanges();
        } else {
            for(uint i=0; i <_exchanges.length; i++) {
                exchanges[_exchanges[i]] = true;
            }
        }

        wallet = _wallet;
        startsAt = _start;
        endsAt = _end;
    }

    function increaseEndsDate(uint256 _endsAt)
        external
        canIncreaseEndDate(_endsAt)
        notFinalized
    {
        endsAt = _endsAt;
    }

    function mapExchanges() private {
        // Bittrex
        exchanges[0xFBb1b73C4f0BDa4f67dcA266ce6Ef42f520fBB98] = true;
        // Kraken_1
        exchanges[0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2] = true;
        // Kraken_2
        exchanges[0x0A869d79a7052C7f1b55a8EbAbbEa3420F0D1E13] = true;
        // Kraken_3
        exchanges[0xE853c56864A2ebe4576a807D26Fdc4A0adA51919] = true;
        // Kraken_4
        exchanges[0x267be1C1D684F78cb4F6a176C4911b741E4Ffdc0] = true;
        // Binance
        exchanges[0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE] = true;
        // HitBtc
        exchanges[0x9C67e141C0472115AA1b98BD0088418Be68fD249] = true;
        // Poloniex Cold wallet
        exchanges[0xb794F5eA0ba39494cE839613fffBA74279579268] = true;
        // Poloniex wallet
        exchanges[0x32Be343B94f860124dC4fEe278FDCBD38C102D88] = true;
        // BitFinex
        exchanges[0x7180EB39A6264938FDB3EfFD7341C4727c382153] = true;
        // BitFinex_1
        exchanges[0xcAfB10eE663f465f9d10588AC44eD20eD608C11e] = true;
        // BitFinex_Wallet1
        exchanges[0x1151314c646Ce4E0eFD76d1aF4760aE66a9Fe30F] = true;
        // BitFinex_Wallet3
        exchanges[0x4fdd5Eb2FB260149A3903859043e962Ab89D8ED4] = true;
        // BitFinex_Wallet4
        exchanges[0x876EabF441B2EE5B5b0554Fd502a8E0600950cFa] = true;
        // Exodus
        exchanges[0x3A9b32a012aAD4722a3CE20aAc3D46556F0b5C03] = true;
    }

    function () public payable {
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
        isRegisteredEthereumAddress[_participant] = true;
        ParticipantVerified(_participant, _verificationCode, now);
    }

    // token purchase function
    function buyTokens()
        public
        investmentCanProceed
        verifiedForCrowdsale
        isNotExchange
        payable
    {
        uint256 weiAmount = investmentWeiLimit(allowedContribution(msg.sender, msg.value));

        // calculate token amount to be transferred
        uint256 tokens = calculateTokenAmountFor(weiRaised, weiAmount);
        weiRaised = weiRaised.add(weiAmount);

        if(investedAmountOf[msg.sender] == 0) {
            contributors[uniqueContributors] = msg.sender;
            uniqueContributors += 1;
        }

        investedAmountOf[msg.sender] = investedAmountOf[msg.sender].add(weiAmount);
        tokenAmountOf[msg.sender] = tokenAmountOf[msg.sender].add(tokens);
        token.transfer(msg.sender, tokens);

        if(weiAmount < msg.value) {
            msg.sender.transfer(msg.value.sub(weiAmount));
        }
        TokenPurchased(msg.sender, weiAmount, tokens, now);
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
    function calculateTokenAmountFor(uint256 _weiRaised, uint256 _weiAmount) view  public returns(uint256) {
        if(_weiAmount == 0) {
            return 0;
        } else {
            uint256 tokenAmount = 0;
            _weiAmount = investmentWeiLimit(_weiAmount);
            if (weiLimitOfCurrentStep(_weiRaised) <= _weiAmount) {
                tokenAmount = weiLimitOfCurrentStep(_weiRaised).mul(currentRate(_weiRaised));
                uint256 tokenAmountNextStep = calculateTokenAmountFor(_weiRaised.add(weiLimitOfCurrentStep(_weiRaised)), _weiAmount.sub(weiLimitOfCurrentStep(_weiRaised)));
                tokenAmount = tokenAmount.add(tokenAmountNextStep);
            } else {
                tokenAmount = _weiAmount.mul(currentRate(_weiRaised));
            }

            return tokenAmount;
        }
    }

    /**
      * Calculate wei limit which can be invested to get tokens by current step rate
      * @param _weiRaised wei already raised
      */
    function weiLimitOfCurrentStep(uint256 _weiRaised) view public returns(uint256) {
        if (_weiRaised < SECOND_STEP_UPPER_LIMIT ) {
            return SECOND_STEP_UPPER_LIMIT.sub(_weiRaised);
        } else if (_weiRaised < CROWDFUND_HARD_CAP) {
            return CROWDFUND_HARD_CAP.sub(_weiRaised);
        } else {
            return 0;
        }
    }

    /**
      * Calculate wei limit which can be invested in crowdsale.
      * Function used to determine if user can invest all wanted wei amount.
      * @param _weiAmount wei that investor want to invest
      */
    function investmentWeiLimit(uint256 _weiAmount) private view returns(uint256) {
        if (CROWDFUND_HARD_CAP <= weiRaised.add(_weiAmount)) {
            return CROWDFUND_HARD_CAP.sub(weiRaised);
        } else {
            return _weiAmount;
        }
    }

    function allowedContribution(address _participant, uint256 _value) public view returns(uint256) {
        if(isRegisteredEthereumAddress[_participant]
            || investedAmountOf[_participant].add(_value) <= NOT_VERIFIED_WEI_LIMIT) {
            return _value;
        } else {
            return NOT_VERIFIED_WEI_LIMIT.sub(investedAmountOf[_participant]);
        }
    }

    /**
      * Calculate token rate by already raised wei.
      * @param _weiRaised wei that already was raised
      */
    function currentRate(uint256 _weiRaised) view public  returns(uint256) {
        if (_weiRaised < SECOND_STEP_UPPER_LIMIT) {
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
        token.unfreeze();
        token.transfer(address(wallet), token.balanceOf(address(this)));
        forwardFunds();
        token.transferOwnership(address(wallet));
        CrowdsaleFinalized(msg.sender, now);
    }


    // @notice Send ether to the fund collection wallet
    function forwardFunds()
        public
    {
        address(wallet).transfer(this.balance);
    }

    function forwardTokens(StandardToken _standardToken)
        public
        canForwardTokens
    {
        require(finalized || address(_standardToken) != address(token));
        _standardToken.transfer(address(wallet), _standardToken.balanceOf(address(this)));
    }

    function isContract(address _addr) private view returns (bool is_contract) {
        uint length;
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }

    function getState() external view returns (State) {
        if (finalized) return State.Finalized;
        else if (now > endsAt || weiRaised >= HARD_CAP) return State.Finished;
        else if (weiRaised >= HARD_CAP) return State.Success;
        else if (now >= startsAt) return State.Funding;
        else return State.PreFunding;
    }



    /** @dev Implementation of ERC223 receiver fallback function in order to protect
     *  @dev sending tokens (standard ERC223) to smart tokens who doesn't except them
     */
    function tokenFallback(address /*_origin*/, uint /*_value*/, bytes /*_data*/) public pure returns (bool ok) {
        return true;
    }

}