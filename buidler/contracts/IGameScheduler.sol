//SPDX-License-Identifier: Unlicense
pragma solidity >=0.6.0 <0.7.0;

interface IGameScheduler {
    event StatusChanged(uint8 newStatus);
    event PlayerRegistered(address newPlayer, uint8 nbPlayers);
    event PlayerLost(address indexed player);
    event PlayerWin(address indexed player);
    function getStatus() view external returns (uint8);
    function getRoundCount() view external returns (uint16);
    // function getNbPlayers() view external returns (uint8);
    // function getNextPlayer() view external returns (address);
    function isPlayerRegistered(address player) view external returns (bool);
    function isAvatarTaken(uint8 avatar) view external returns (bool);
    function isUsernameTaken(bytes32 username) view external returns (bool);
    // function getPlayerAtIndex(uint8 index) view external returns (address);
    // function getAvatar(address player) view external returns (uint8);
    // function getUsername(address player) view external returns (bytes32 username);
    function register(bytes32 username, uint8 avatar) external payable;
    function start() external;
    function end() external;
    function playerLost(address player) external;
}