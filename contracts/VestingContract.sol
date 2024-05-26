// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VestingContract is ReentrancyGuard, Context, Ownable {
  event ScheduleCreated(address indexed _beneficiary, uint256 indexed _amount, uint256 indexed _startTimestamp, uint256 _duration);

  event ScheduleCancelled(address indexed _beneficiary, address indexed _cancelledBy, uint256 _remainingBalance, uint256 _canceledTimestamp);

  event Withdraw(address indexed _beneficiary, uint256 indexed _amount, uint256 indexed _time);

  struct Schedule {
    uint256 startTimestamp;
    uint256 endTimestamp;
    uint256 canceledTimestamp;
    uint256 amount;
    uint256 totalDrawn;
    uint256 lastDrawnAt;
    uint256 withdrawRate;
  }

  // Vested address to its schedule
  mapping(address => Schedule) private vestingSchedule;

  // AAG token contract
  IERC20 public token;
  uint256 private constant ONE_DAY_IN_SECONDS = 1 days;

  address public recoveryWallet;

  bool public paused;

  constructor(IERC20 _token, address _owner, address _recoveryWallet) {
    token = _token;
    require(_owner != address(0), "Owner cannot be empty");
    transferOwnership(_owner);
    require(_recoveryWallet != address(0), "Recovery wallet cannot be empty");
    recoveryWallet = _recoveryWallet;
    paused = true;
  }

  function setStatus(bool _paused) external onlyOwner {
    paused = _paused;
  }

  // Create vesting schedule
  function createVestingSchedule(
    address _beneficiary,
    uint256 _amount,
    uint256 _startTimestamp,
    uint256 _durationInDays
  ) external onlyOwner {
    require(_beneficiary != address(0), "Beneficiary cannot be empty");
    require(_amount > 0, "Amount cannot be empty");
    require(_durationInDays > 0, "Duration cannot be empty");
    require(_startTimestamp > block.timestamp, "Can not set the date in the past");
    // Ensure one per address
    require(vestingSchedule[_beneficiary].amount == 0, "Schedule already exists");

    // Create schedule
    uint256 _durationInSecs = _durationInDays * ONE_DAY_IN_SECONDS;
    vestingSchedule[_beneficiary] = Schedule({
      startTimestamp: _startTimestamp,
      endTimestamp: _startTimestamp + _durationInSecs,
      canceledTimestamp: 0,
      amount: _amount,
      totalDrawn: 0,
      lastDrawnAt: 0,
      withdrawRate: _amount / _durationInSecs
    });

    emit ScheduleCreated(_beneficiary, _amount, vestingSchedule[_beneficiary].startTimestamp, _durationInDays);

    // Transfer tokens in the vesting contract on behalf of the beneficiary
    require(token.transferFrom(_msgSender(), address(this), _amount), "Unable to transfer tokens to vesting contract");
  }

  // Cancel vesting schedule for beneficiary
  function cancelVestingForBeneficiary(address _beneficiary) external onlyOwner {
    Schedule storage item = vestingSchedule[_beneficiary];
    require(item.canceledTimestamp == 0, "Can not cancel twice");
    require(item.endTimestamp > block.timestamp, "Vesting is already finished");

    uint256 availableAmount = getAvailableWithdrawAmountForSchedule(item);

    item.canceledTimestamp = block.timestamp;

    uint256 finalAmountForBeneficiary = availableAmount + item.totalDrawn;
    uint256 amountToRetrieveToOwner = item.amount - finalAmountForBeneficiary;

    // Set final amount for beneficiary
    item.amount = finalAmountForBeneficiary;

    // Return unvested tokens to owner
    require(token.transfer(recoveryWallet, amountToRetrieveToOwner), "Unable to transfer tokens");

    emit ScheduleCancelled(_beneficiary, _msgSender(), availableAmount, vestingSchedule[_beneficiary].canceledTimestamp);
  }

  // Emergency withdrawal (Whole balance)
  function emergencyWithdrawAllTokens() external onlyOwner {
    uint256 balance = token.balanceOf(address(this));
    // Return all tokens to the owner
    require(token.transfer(recoveryWallet, balance), "Unable to transfer tokens");
  }

  function withdraw() external nonReentrant {
    require(paused == false, "Claiming not available yet");
    Schedule memory schedule = vestingSchedule[_msgSender()];
    require(schedule.amount > 0, "There is no schedule currently in flight");

    // available right now
    uint256 amount = getAvailableWithdrawAmountForSchedule(schedule);
    require(amount > 0, "Nothing to withdraw");

    // Update last drawn to now
    vestingSchedule[_msgSender()].lastDrawnAt = block.timestamp;

    // Increase total drawn amount
    vestingSchedule[_msgSender()].totalDrawn = schedule.totalDrawn + amount;

    // Issue tokens to beneficiary
    require(token.transfer(_msgSender(), amount), "Unable to transfer tokens");

    emit Withdraw(_msgSender(), amount, block.timestamp);
  }

  // Accessors
  function tokenBalance() external view returns (uint256) {
    return token.balanceOf(address(this));
  }

  function vestingScheduleForBeneficiary(address _beneficiary)
    external
    view
    returns (
      uint256 _startTimestamp,
      uint256 _endTimestamp,
      uint256 _canceledTimestamp,
      uint256 _amount,
      uint256 _totalDrawn,
      uint256 _lastDrawnAt,
      uint256 _withdrawRate,
      uint256 _remainingBalance
    )
  {
    Schedule memory schedule = vestingSchedule[_beneficiary];
    return (
      schedule.startTimestamp,
      schedule.endTimestamp,
      schedule.canceledTimestamp,
      schedule.amount,
      schedule.totalDrawn,
      schedule.lastDrawnAt,
      schedule.withdrawRate,
      schedule.amount - schedule.totalDrawn
    );
  }

  function getAvailableWithdrawAmountForAddress(address _beneficiary) external view returns (uint256 _amount) {
    Schedule memory schedule = vestingSchedule[_beneficiary];
    return getAvailableWithdrawAmountForSchedule(schedule);
  }

  function getAvailableWithdrawAmountForSchedule(Schedule memory _schedule) internal view returns (uint256 _amount) {
    // Vesting haven't started
    if (block.timestamp <= _schedule.startTimestamp) {
      return 0;
    }

    // Ended
    if (block.timestamp > _schedule.endTimestamp && _schedule.canceledTimestamp == 0) {
      return _schedule.amount - _schedule.totalDrawn;
    }

    // Canceled
    if (block.timestamp > _schedule.canceledTimestamp && _schedule.canceledTimestamp != 0) {
      uint256 timeVestedSinceCanceled = _schedule.canceledTimestamp - _schedule.startTimestamp;
      return timeVestedSinceCanceled * _schedule.withdrawRate - _schedule.totalDrawn;
    }

    // Active
    uint256 timePassedFromVestingStart = block.timestamp - _schedule.startTimestamp;
    return timePassedFromVestingStart * _schedule.withdrawRate - _schedule.totalDrawn;
  }
}
