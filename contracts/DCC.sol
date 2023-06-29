// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract DCC is Ownable, ERC20Burnable {
    event DccClaimed(address indexed user, uint256 amount);
    event SetInvestor(address indexed user, uint256 pid, uint256 allocPoint);
    event ChangeInvestor(address indexed user, uint256 allocPoint);
    event RemoveInvestor(address indexed user);
    event SetTeamAddress(address indexed user);
    event SetReserveAddress(address indexed user);
    event AddBlackList(address indexed user);
    event RemoveBlackList(address indexed user);

    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    uint256 public constant MAX_SUPPLY = 1e9 * 1e18;
    uint256 public constant MAX = 10000;
    uint256 public constant TEAM_RATE = 2500;
    uint256 public constant INVESTOR_TATE = 3300;
    uint256 public constant RESERVE_RATE = 3300;

    uint256 public immutable duration;

    uint256 public immutable teamLock;
    uint256 public immutable teamStart;

    uint256 public immutable investorLock;
    uint256 public immutable investorStart;

    uint256 public immutable reserveLock;
    uint256 public immutable reserveStart;
    uint256 public immutable initTime;

    address public teamAddress;
    address public reserveAddress;

    mapping(address => uint256) public claimed;
    EnumerableSet.AddressSet private _transferBlacklist;

    struct InvestorInfo {
        address investorAddress;
        uint256 allocPoint;
    }

    InvestorInfo[] public investorInfos;
    mapping(address => uint256) public lpOfPid;
    uint256 public invertorTotalPoint;

    constructor(
        uint256 _duration,
        uint256 _teamLock,
        uint256 _teamStart,
        uint256 _investorLock,
        uint256 _investorStart,
        uint256 _reserveLock,
        uint256 _reserveStart
    ) ERC20("Dcc", "Dcc") {
        duration = _duration;
        teamLock = _teamLock;
        teamStart = _teamStart;
        investorLock = _investorLock;
        investorStart = _investorStart;
        reserveLock = _reserveLock;
        reserveStart = _reserveStart;
        initTime = block.timestamp;
        _mint(msg.sender, MAX_SUPPLY.mul(900).div(MAX));
    }

    function _mint(address account, uint256 amount) internal virtual override {
        require(
            totalSupply().add(amount) <= MAX_SUPPLY,
            "DCC: total supply exceeds max supply"
        );
        super._mint(account, amount);
    }

    function isBlackList(address _address) public view returns (bool) {
        return _transferBlacklist.contains(_address);
    }

    function invertorLength() public view returns (uint256) {
        return investorInfos.length;
    }

    function getCycle() public view returns (uint) {
        return (block.timestamp.sub(initTime)).div(duration);
    }

    function removeTransferBlacklist(address _address) external onlyOwner {
        _transferBlacklist.remove(_address);
        emit RemoveBlackList(_address);
    }

    function addTransferBlacklist(address _address) external onlyOwner {
        _transferBlacklist.add(_address);
        emit AddBlackList(_address);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        require(
            !_transferBlacklist.contains(from),
            "DCC: transfer from the blacklisted address"
        );
        require(
            !_transferBlacklist.contains(to),
            "DCC: transfer to the blacklisted address"
        );
        return super._beforeTokenTransfer(from, to, amount);
    }

    function addInvestor(
        address _investor,
        uint256 _allocPoint
    ) public onlyOwner {
        invertorTotalPoint = invertorTotalPoint.add(_allocPoint);
        require(invertorTotalPoint <= MAX, "<=max");
        investorInfos.push(
            InvestorInfo({investorAddress: _investor, allocPoint: _allocPoint})
        );
        lpOfPid[_investor] = invertorLength() - 1;
        emit SetInvestor(_investor, invertorLength() - 1, _allocPoint);
    }

    function setTeamAddress(address _teamAddress) public onlyOwner {
        require(_teamAddress != address(0), "!0");
        uint256 _claimed = claimed[teamAddress];
        delete claimed[teamAddress];
        teamAddress = _teamAddress;
        claimed[teamAddress] = _claimed;
        emit SetTeamAddress(_teamAddress);
    }

    function setReserveAddress(address _reserveAddress) public onlyOwner {
        require(_reserveAddress != address(0), "!0");
        uint256 _claimed = claimed[reserveAddress];
        delete claimed[reserveAddress];
        reserveAddress = _reserveAddress;
        claimed[reserveAddress] = _claimed;
        emit SetReserveAddress(_reserveAddress);
    }

    function setInvestor(
        uint256 _pid,
        address _investor,
        uint256 _allocPoint
    ) public onlyOwner {
        address currnetAddress = investorInfos[_pid].investorAddress;
        invertorTotalPoint = invertorTotalPoint.add(_allocPoint).sub(
            investorInfos[_pid].allocPoint
        );
        require(invertorTotalPoint <= MAX, "<=max");
        if (currnetAddress != _investor) {
            uint256 _claimed = claimed[currnetAddress];
            claimed[_investor] = _claimed;
            investorInfos[_pid].investorAddress = _investor;
            lpOfPid[_investor] = _pid;
            delete claimed[currnetAddress];
            delete lpOfPid[currnetAddress];
        }

        investorInfos[_pid].allocPoint = _allocPoint;
        emit SetInvestor(_investor, _pid, _allocPoint);
    }

    function claimTeam() public onlyOwner {
        require(teamAddress != address(0), "!0");
        uint256 cycle = getCycle();
        if (cycle > teamLock) {
            cycle = teamLock;
        }
        uint256 _claimed = claimed[teamAddress];
        uint256 amount;
        if (cycle > _claimed && cycle >= teamStart) {
            uint256 diff = cycle.sub(_claimed);
            amount = MAX_SUPPLY.mul(TEAM_RATE).div(MAX).mul(diff).div(teamLock);
            _mint(teamAddress, amount);
            claimed[teamAddress] = cycle;
        }
        emit DccClaimed(teamAddress, amount);
    }

    function claimInvestor() public {
        require(invertorLength() > 0, "no investor");
        InvestorInfo memory investorInfo = investorInfos[lpOfPid[msg.sender]];
        require(investorInfo.allocPoint > 0, "no investor");
        require(investorInfo.investorAddress == msg.sender, "no investor");

        uint256 cycle = getCycle();
        if (cycle > investorLock) {
            cycle = investorLock;
        }
        uint256 _claimed = claimed[msg.sender];
        uint256 amount;
        if (cycle > _claimed && cycle >= teamStart) {
            uint256 diff = cycle.sub(_claimed);
            amount = MAX_SUPPLY
                .mul(INVESTOR_TATE)
                .div(MAX)
                .mul(diff)
                .div(reserveLock)
                .mul(investorInfo.allocPoint)
                .div(MAX);
            _mint(msg.sender, amount);
            claimed[msg.sender] = cycle;
        }
        emit DccClaimed(msg.sender, amount);
    }

    function claimReserve() public onlyOwner {
        require(reserveAddress != address(0), "!0");
        uint256 cycle = getCycle();
        if (cycle > reserveLock) {
            cycle = reserveLock;
        }
        uint256 _claimed = claimed[reserveAddress];
        uint256 amount;
        if (cycle > _claimed && cycle >= teamStart) {
            uint256 diff = cycle.sub(_claimed);
            amount = MAX_SUPPLY.mul(RESERVE_RATE).div(MAX).mul(diff).div(
                reserveLock
            );
            _mint(reserveAddress, amount);
            claimed[reserveAddress] = cycle;
        }
        emit DccClaimed(reserveAddress, amount);
    }

    // Generic proxy
    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external onlyOwner returns (bool, bytes memory) {
        (bool success, bytes memory result) = _to.call{value: _value}(_data);
        return (success, result);
    }
}
