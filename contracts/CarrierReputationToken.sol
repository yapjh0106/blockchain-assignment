// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CarrierReputationToken is ERC20 {

    // Account that owns and manages this token contract
    address public owner;

    // Only this address can mint reputation points
    address public authorizedMinter;


    // =====================================================
    // EVENTS
    // =====================================================

    event ReputationAwarded(
        address indexed carrier,
        uint256 amount,
        uint256 timestamp
    );


    // =====================================================
    // CONSTRUCTOR
    // =====================================================

    constructor()
        ERC20(
            "Carrier Reputation Point",
            "CRP"
        )
    {
        // The deployment account becomes owner
        owner = msg.sender;

        // Initially, deployment account is also minter
        authorizedMinter = msg.sender;
    }


    // =====================================================
    // MODIFIERS
    // =====================================================

    modifier onlyOwner() {

        require(
            msg.sender == owner,
            "Only owner can perform this action"
        );

        _;
    }


    modifier onlyAuthorizedMinter() {

        require(
            msg.sender == authorizedMinter,
            "Not authorized to mint"
        );

        _;
    }


    // =====================================================
    // TOKEN DECIMALS
    // =====================================================

    function decimals()
        public
        pure
        override
        returns (uint8)
    {
        return 0;
    }


    // =====================================================
    // SET AUTHORIZED MINTER
    // =====================================================

    function setAuthorizedMinter(
        address minter
    )
        public
        onlyOwner
    {
        require(
            minter != address(0),
            "Invalid minter address"
        );

        authorizedMinter = minter;
    }


    // =====================================================
    // MINT REPUTATION
    // =====================================================

    function mint(
        address carrier,
        uint256 amount
    )
        public
        onlyAuthorizedMinter
    {
        require(
            carrier != address(0),
            "Invalid carrier address"
        );

        require(
            amount > 0,
            "Amount must be greater than zero"
        );

        _mint(
            carrier,
            amount
        );


        emit ReputationAwarded(
            carrier,
            amount,
            block.timestamp
        );
    }
}