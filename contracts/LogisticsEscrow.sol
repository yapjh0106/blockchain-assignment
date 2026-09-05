// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./UserRegistry.sol";
import "./CarrierReputationToken.sol";

contract LogisticsEscrow {

    // =========================
    // ENUMS
    // =========================

    enum AgreementStatus {
        Created,
        Funded,
        InProgress,
        Completed,
        Refunded,
        Rejected
    }

    enum MilestoneType {
        Pickup,
        Delivery
    }

    enum MilestoneStatus {
        Pending,
        Submitted,
        Verified
    }

    // =========================
    // STRUCT
    // =========================

    struct Agreement {
        uint256 id;
        address shipper;
        address carrier;

        uint256 totalAmount;
        uint256 escrowBalance;

        uint256 pickupAmount;
        uint256 deliveryAmount;

        uint256 deadline;
        uint256 createdAt;

        MilestoneStatus pickupStatus;
        MilestoneStatus deliveryStatus;

        AgreementStatus status;
    }

    // =========================
    // CONTRACT REFERENCES
    // =========================

    UserRegistry public userRegistry;
    CarrierReputationToken public reputationToken;

    // =========================
    // STORAGE
    // =========================

    mapping(uint256 => Agreement) public agreements;

    uint256 public agreementCount;

    // 10 CRP for each successfully verified milestone
    uint256 public constant REPUTATION_REWARD = 10;

    // =========================
    // EVENTS
    // =========================

    event AgreementCreated(
        uint256 indexed id,
        address indexed shipper,
        address indexed carrier,
        uint256 totalAmount,
        uint256 pickupAmount,
        uint256 deliveryAmount,
        uint256 deadline
    );

    event AgreementFunded(
        uint256 indexed id,
        uint256 amount
    );

    event MilestoneSubmitted(
        uint256 indexed id,
        MilestoneType milestone,
        address indexed carrier
    );

    event MilestoneVerified(
        uint256 indexed id,
        MilestoneType milestone,
        address indexed shipper
    );

    event MilestoneRejected(
        uint256 indexed id,
        MilestoneType milestone,
        address indexed shipper,
        string comment
    );

    event PaymentReleased(
        uint256 indexed id,
        MilestoneType milestone,
        uint256 amount,
        address indexed to
    );

    event AgreementCancelled(
        uint256 indexed id,
        address indexed cancelledBy,
        string reason,
        uint256 refundAmount
    );

    event RefundIssued(
        uint256 indexed id,
        uint256 amount,
        address indexed to
    );
// =========================
    // CONSTRUCTOR
    // =========================

    constructor(
        address _userRegistry,
        address _reputationToken
    ) {
        require(
            _userRegistry != address(0),
            "Invalid UserRegistry address"
        );

        require(
            _reputationToken != address(0),
            "Invalid reputation token address"
        );

        userRegistry = UserRegistry(_userRegistry);
        reputationToken = CarrierReputationToken(_reputationToken);
    }

    // =========================
    // MODIFIER
    // =========================

    modifier agreementExists(uint256 _id) {
        require(
            _id > 0 && _id <= agreementCount,
            "Agreement does not exist"
        );
        _;
    }

    // =========================
    // CREATE AGREEMENT
    // =========================

    function createAgreement(
        address _carrier,
        uint256 _totalAmount,
        uint256 _pickupAmount,
        uint256 _deliveryAmount,
        uint256 _deadline
    )
        public
    {
        require(
            userRegistry.isRegistered(msg.sender),
            "Shipper is not registered"
        );

        require(
            userRegistry.getUserRole(msg.sender)
                == UserRegistry.Role.Shipper,
            "Only Shipper can create agreement"
        );

        require(
            userRegistry.isRegistered(_carrier),
            "Carrier is not registered"
        );

        require(
            userRegistry.getUserRole(_carrier)
                == UserRegistry.Role.Carrier,
            "Selected address is not a Carrier"
        );

        require(
            msg.sender != _carrier,
            "Shipper cannot be Carrier"
        );

        require(
            _totalAmount > 0,
            "Total amount must be greater than zero"
        );

        require(
            _pickupAmount + _deliveryAmount == _totalAmount,
            "Milestone amounts must equal total amount"
        );

        require(
            _deadline > block.timestamp,
            "Deadline must be in the future"
        );

        agreementCount++;

        agreements[agreementCount] = Agreement({
            id: agreementCount,
            shipper: msg.sender,
            carrier: _carrier,
            totalAmount: _totalAmount,
            escrowBalance: 0,
            pickupAmount: _pickupAmount,
            deliveryAmount: _deliveryAmount,
            deadline: _deadline,
            createdAt: block.timestamp,
            pickupStatus: MilestoneStatus.Pending,
            deliveryStatus: MilestoneStatus.Pending,
            status: AgreementStatus.Created
        });

        emit AgreementCreated(agreementCount, msg.sender, _carrier, _totalAmount, _pickupAmount, _deliveryAmount, _deadline);
    }

    // =========================
    // FUND AGREEMENT
    // =========================

    function fundAgreement(
        uint256 _id
    )
        public
        payable
        agreementExists(_id)
    {
        Agreement storage agreement = agreements[_id];

        require(
            msg.sender == agreement.shipper,
            "Only Shipper can fund agreement"
        );

        require(
            agreement.status == AgreementStatus.Created,
            "Agreement cannot be funded"
        );

        require(
            msg.value == agreement.totalAmount,
            "Incorrect funding amount"
        );

        agreement.escrowBalance = msg.value;

        agreement.status = AgreementStatus.Funded;

        emit AgreementFunded(_id, msg.value);
    }

    // =========================
    // SUBMIT MILESTONE
    // =========================

    function submitMilestone(
        uint256 _id,
        MilestoneType _milestone
    )
        public
        agreementExists(_id)
    {
        Agreement storage agreement = agreements[_id];

        require(
            msg.sender == agreement.carrier,
            "Only Carrier can submit milestone"
        );

        require(
            agreement.status == AgreementStatus.Funded ||
            agreement.status == AgreementStatus.InProgress,
            "Agreement is not active"
        );

        require(
            block.timestamp <= agreement.deadline,
            "Agreement deadline has passed"
        );

        // -------------------------
        // PICKUP
        // -------------------------

        if (_milestone == MilestoneType.Pickup) {

            require(
                agreement.pickupStatus == MilestoneStatus.Pending,
                "Pickup milestone cannot be submitted"
            );

            agreement.pickupStatus = MilestoneStatus.Submitted;

            agreement.status = AgreementStatus.InProgress;
        }

        // -------------------------
        // DELIVERY
        // -------------------------

        else {

            require(
                agreement.pickupStatus == MilestoneStatus.Verified,
                "Pickup must be verified first"
            );

            require(
                agreement.deliveryStatus == MilestoneStatus.Pending,
                "Delivery milestone cannot be submitted"
            );

            agreement.deliveryStatus = MilestoneStatus.Submitted;
        }

        emit MilestoneSubmitted(_id, _milestone, msg.sender);
    }

    // =========================
    // VERIFY MILESTONE
    // =========================

    function verifyMilestone(
        uint256 _id,
        MilestoneType _milestone
    )
        public
        agreementExists(_id)
    {
        Agreement storage agreement = agreements[_id];

        require(
            msg.sender == agreement.shipper,
            "Only Shipper can verify milestone"
        );

        require(
            agreement.status == AgreementStatus.InProgress,
            "Agreement is not in progress"
        );

        require(
            block.timestamp <= agreement.deadline,
            "Agreement deadline has passed"
        );

        // -------------------------
        // PICKUP
        // -------------------------

        if (_milestone == MilestoneType.Pickup) {

            require(
                agreement.pickupStatus == MilestoneStatus.Submitted,
                "Pickup has not been submitted"
            );

            agreement.pickupStatus = MilestoneStatus.Verified;

            emit MilestoneVerified(_id, _milestone, msg.sender);

            _releasePayment(
                _id,
                MilestoneType.Pickup
            );
        }

        // -------------------------
        // DELIVERY
        // -------------------------

        else {

            require(
                agreement.deliveryStatus == MilestoneStatus.Submitted,
                "Delivery has not been submitted"
            );

            agreement.deliveryStatus = MilestoneStatus.Verified;

            emit MilestoneVerified(_id, _milestone, msg.sender);

            _releasePayment(
                _id,
                MilestoneType.Delivery
            );

            agreement.status = AgreementStatus.Completed;
        }

        // Award reputation after successful milestone verification
        reputationToken.mint(
            agreement.carrier,
            REPUTATION_REWARD
        );
    }

    // =========================
    // RELEASE PAYMENT
    // =========================

    function _releasePayment(
        uint256 _id,
        MilestoneType _milestone
    )
        internal
    {
        Agreement storage agreement = agreements[_id];

        uint256 paymentAmount;

        if (_milestone == MilestoneType.Pickup) {

            paymentAmount = agreement.pickupAmount;
        }

        else {

            paymentAmount = agreement.deliveryAmount;
        }

        require(
            agreement.escrowBalance >= paymentAmount,
            "Insufficient escrow balance"
        );

        // Update state before sending ETH
        agreement.escrowBalance -= paymentAmount;

        (bool success, ) = payable(
            agreement.carrier
        ).call{
            value: paymentAmount
        }("");

        require(
            success,
            "Payment transfer failed"
        );

        emit PaymentReleased(_id, _milestone, paymentAmount, agreement.carrier);
    }

    // =========================
    // CLAIM REFUND
    // =========================

    function claimRefund(
        uint256 _id
    )
        public
        agreementExists(_id)
    {
        Agreement storage agreement = agreements[_id];

        require(
            msg.sender == agreement.shipper,
            "Only Shipper can claim refund"
        );

        require(
            block.timestamp > agreement.deadline,
            "Deadline has not passed"
        );

        require(
            agreement.status != AgreementStatus.Completed,
            "Agreement already completed"
        );

        require(
            agreement.status != AgreementStatus.Refunded,
            "Agreement already refunded"
        );

        require(
            agreement.escrowBalance > 0,
            "No escrow balance available"
        );

        uint256 refundAmount = agreement.escrowBalance;

        // Update state before sending ETH
        agreement.escrowBalance = 0;

        agreement.status = AgreementStatus.Refunded;

        (bool success, ) = payable(
            agreement.shipper
        ).call{
            value: refundAmount
        }("");

        require(
            success,
            "Refund transfer failed"
        );

        emit RefundIssued(_id, refundAmount, agreement.shipper);
    }

    // =========================
    // GET AGREEMENT
    // =========================

    function getAgreement(
        uint256 _id
    )
        public
        view
        agreementExists(_id)
        returns (Agreement memory)
    {
        return agreements[_id];
    }

    // =========================
    // GET ESCROW BALANCE
    // =========================

    function getEscrowBalance(
        uint256 _id
    )
        public
        view
        agreementExists(_id)
        returns (uint256)
    {
        return agreements[_id].escrowBalance;
    }

    // =========================
    // CANCEL AGREEMENT
    // =========================

    function cancelAgreementByShipper(uint256 _id, string calldata _reason) public agreementExists(_id) {
        Agreement storage agreement = agreements[_id];

        require(msg.sender == agreement.shipper, "Only Shipper can cancel");
        require(agreement.status == AgreementStatus.Created, "Shipper can only cancel before funding");

        agreement.status = AgreementStatus.Rejected;
        
        emit AgreementCancelled(_id, msg.sender, _reason, 0);
    }

    function cancelAgreementByCarrier(uint256 _id, string calldata _reason) public agreementExists(_id) {
        Agreement storage agreement = agreements[_id];

        require(msg.sender == agreement.carrier, "Only Carrier can cancel");
        require(agreement.status == AgreementStatus.Funded, "Carrier can only cancel after funded");
        require(block.timestamp <= agreement.deadline, "Carrier cannot cancel expired agreement");

        uint256 refundAmount = agreement.escrowBalance;
        agreement.escrowBalance = 0;
        agreement.status = AgreementStatus.Rejected;

        if (refundAmount > 0) {
            (bool success, ) = payable(agreement.shipper).call{value: refundAmount}("");
            require(success, "Refund transfer failed");
            emit RefundIssued(_id, refundAmount, agreement.shipper);
        }

        emit AgreementCancelled(_id, msg.sender, _reason, refundAmount);
    }


    // =========================
    // REJECT MILESTONE
    // =========================

    function rejectMilestone(
        uint256 _id,
        MilestoneType _milestone,
        string calldata _comment
    )
        public
        agreementExists(_id)
    {
        Agreement storage agreement = agreements[_id];

        require(
            msg.sender == agreement.shipper,
            "Only Shipper can reject milestone"
        );

        require(
            agreement.status == AgreementStatus.InProgress,
            "Agreement is not in progress"
        );

        if (_milestone == MilestoneType.Pickup) {
            require(
                agreement.pickupStatus == MilestoneStatus.Submitted,
                "Pickup not submitted"
            );
            agreement.pickupStatus = MilestoneStatus.Pending;
        } else if (_milestone == MilestoneType.Delivery) {
            require(
                agreement.deliveryStatus == MilestoneStatus.Submitted,
                "Delivery not submitted"
            );
            agreement.deliveryStatus = MilestoneStatus.Pending;
        } else {
            revert("Invalid milestone type");
        }

        emit MilestoneRejected(_id, _milestone, msg.sender, _comment);
    }

    

}
