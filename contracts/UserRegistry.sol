// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract UserRegistry {

    enum Role {
        None,
        Shipper,
        Carrier,
        Admin
    }

    mapping(address => Role) public userRoles;
    mapping(address => bool) public registeredUsers;
    mapping(address => string) public userNames;
    address public admin;

    event UserRegistered(
        address indexed user,
        Role role,
        string name,
        uint256 timestamp
    );

    constructor() {
        admin = msg.sender;
        registeredUsers[msg.sender] = true;
        userRoles[msg.sender] = Role.Admin;
        userNames[msg.sender] = "Super Admin";

        emit UserRegistered(
            msg.sender,
            Role.Admin,
            "Super Admin",
            block.timestamp
        );
    }

    function registerUser(Role role, string memory _name) public {
        require(!registeredUsers[msg.sender], "User already registered");
        require(role == Role.Shipper || role == Role.Carrier, "Can only register as Shipper or Carrier");
        require(bytes(_name).length > 0, "Name is required");

        registeredUsers[msg.sender] = true;
        userRoles[msg.sender] = role;
        userNames[msg.sender] = _name;

        emit UserRegistered(
            msg.sender,
            role,
            _name,
            block.timestamp
        );
    }

    function addAdmin(address _newAdmin, string memory _name) public {
        require(userRoles[msg.sender] == Role.Admin, "Only admin can add another admin");
        require(!registeredUsers[_newAdmin], "User already registered");
        require(bytes(_name).length > 0, "Name is required");

        registeredUsers[_newAdmin] = true;
        userRoles[_newAdmin] = Role.Admin;
        userNames[_newAdmin] = _name;

        emit UserRegistered(
            _newAdmin,
            Role.Admin,
            _name,
            block.timestamp
        );
    }

    function getUserRole(address _user) public view returns (Role) {
        return userRoles[_user];
    }

    function isRegistered(address _user) public view returns (bool) {
        return registeredUsers[_user];
    }
}