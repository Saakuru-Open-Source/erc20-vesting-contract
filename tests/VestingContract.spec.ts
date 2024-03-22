import { BigNumber, Wallet } from 'ethers';
import { waffle, ethers } from 'hardhat';
import { MockERC20, VestingContract } from '../dist/types';
import { integrationFixture } from './shared/integration';

const { expect } = require('chai');

describe('VestingContract', function () {
  let users: Wallet[];
  let erc20: MockERC20;
  let vesting: VestingContract;
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
  
  let vestingWalletOwner: Wallet;
  let recoveryWallet: Wallet;
  let beneficiary: Wallet;

  before('create fixture loader', async () => {
    users = await (ethers as any).getSigners();
    loadFixture = waffle.createFixtureLoader(users);
    vestingWalletOwner = users[0];
    recoveryWallet = users[1];
    beneficiary = users[5];
  });
  
  beforeEach('deploy fixture', async () => {
    ({ erc20, vesting } = await loadFixture(integrationFixture));
  });

  const ONE_MILLION_TOKENS = ethers.utils.parseEther("1000000"); // Adjust the amount based on your token's decimals
  const FOUR_YEARS_IN_DAYS = 4 * 365;
  const INITIAL_SUPPLY = ethers.utils.parseEther("1000000000"); // Adjust the amount based on your token's decimals

  it("Set vesting and test data", async () => {
    // Create vesting schedule for 4 years that starts after 1 minute
    // Get current block time
    let block = await ethers.provider.getBlock("latest");
    let blockTime = block.timestamp;
    const vestingStart = BigNumber.from(blockTime).add(60); // Starts after 60 seconds
  
    // Increase token allowance for the vesting contract
    await erc20.connect(vestingWalletOwner).increaseAllowance(vesting.address, ONE_MILLION_TOKENS);
  
    // Create vesting schedule
    await vesting.connect(vestingWalletOwner).createVestingSchedule(beneficiary.address, ONE_MILLION_TOKENS, vestingStart, FOUR_YEARS_IN_DAYS);
  
    // Test balance in the vesting contract
    const vestingContractBalance = await erc20.balanceOf(vesting.address);
    expect(vestingContractBalance).to.equal(ONE_MILLION_TOKENS, "Incorrect balance in the vesting wallet");
  });

  it("Vest for 1 year & withdraw", async () => {
    // Get current block time
    let block = await ethers.provider.getBlock("latest");
    const vestingStart = BigNumber.from(block.timestamp).add(60); // Starts after 60 seconds
        // Increase token allowance for the vesting contract
    await erc20.connect(vestingWalletOwner).increaseAllowance(vesting.address, ONE_MILLION_TOKENS);
  
    // Create vesting schedule
    await vesting.connect(vestingWalletOwner).createVestingSchedule(beneficiary.address, ONE_MILLION_TOKENS, vestingStart, FOUR_YEARS_IN_DAYS);
    const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60;
  
    // Increase time by one year
    await ethers.provider.send('evm_increaseTime', [ONE_YEAR_IN_SECONDS]);
    await ethers.provider.send('evm_mine', []);
  
    // Test available balance
    const available2 = await vesting.getAvailableWithdrawAmountForAddress(beneficiary.address);
    expect(available2.toString().startsWith("249999") && available2.toString().length === 24).to.be.true;
  
    // Withdraw
    await vesting.connect(beneficiary).withdraw();
  
    // Test account balance after withdrawal
    const vestedAndDrawnBalance = await erc20.balanceOf(beneficiary.address);
    expect(vestedAndDrawnBalance.toString().startsWith("249999") && vestedAndDrawnBalance.toString().length === 24).to.be.true;
  });

  it("Vest for 3 more years & withdraw, than wait for 1 more year and withdraw", async () => {
    // Create vesting schedule for 4 years at the setup
    let block = await ethers.provider.getBlock("latest");
    let blockTime = block.timestamp;
    const vestingStart = BigNumber.from(blockTime).add(60); // Starts after 60 seconds
  
    await erc20.connect(vestingWalletOwner).increaseAllowance(vesting.address, ONE_MILLION_TOKENS);
    await vesting.connect(vestingWalletOwner).createVestingSchedule(beneficiary.address, ONE_MILLION_TOKENS, vestingStart, FOUR_YEARS_IN_DAYS);
  
    // Increase time by 3 years and 1 day
    const THREE_YEARS_ONE_DAY_IN_SECONDS = (365 * 3 + 1) * 24 * 60 * 60;
    await ethers.provider.send('evm_increaseTime', [THREE_YEARS_ONE_DAY_IN_SECONDS]);
    await ethers.provider.send('evm_mine', []);
  
    // Check the vesting schedule data after 4 years
    const availableBalance = await vesting.getAvailableWithdrawAmountForAddress(beneficiary.address);
    const vestingContractBalance = await erc20.balanceOf(vesting.address);
    const fullVestingInfo = await vesting.vestingScheduleForBeneficiary(beneficiary.address);
    const beneficiaryBalanceBeforeWithdrawal = await erc20.balanceOf(beneficiary.address);
  
    const balanceToReceive = availableBalance;
    // Test conditions
    expect(vestingContractBalance).to.equal(ONE_MILLION_TOKENS);
    expect(availableBalance.toString().startsWith("750")).to.be.true;
    expect(beneficiaryBalanceBeforeWithdrawal).to.equal(BigNumber.from(0));
    expect(fullVestingInfo._canceledTimestamp).to.equal(BigNumber.from(0));
    expect(fullVestingInfo._amount).to.equal(ONE_MILLION_TOKENS);
    expect(fullVestingInfo._totalDrawn).to.equal(BigNumber.from(0));
    expect(fullVestingInfo._lastDrawnAt).to.be.equal(BigNumber.from(0));
    // expect(fullVestingInfo._remainingBalance.toString().startsWith("ONE_MILLION_TOKENS")).to.be.true;
  
    // Withdraw available balance
    await vesting.connect(beneficiary).withdraw();
  
    // Check balances after withdrawal
    const beneficiaryBalanceAfterWithdrawal = await erc20.balanceOf(beneficiary.address);
    const diff = beneficiaryBalanceAfterWithdrawal.sub(balanceToReceive);
    expect(beneficiaryBalanceAfterWithdrawal).to.be.gt(balanceToReceive).and.lt(balanceToReceive.add(BigNumber.from(10).pow(18)));
  
    const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60;
  
    // Increase time by one year
    await ethers.provider.send('evm_increaseTime', [ONE_YEAR_IN_SECONDS]);
    await ethers.provider.send('evm_mine', []);
    // Withdraw available balance
    await vesting.connect(beneficiary).withdraw();
    // Attempt to withdraw again and expect failure due to nothing to withdraw
    await expect(vesting.connect(beneficiary).withdraw()).to.be.revertedWith("Nothing to withdraw");
  
    // Ensure vesting contract balance is zero after final withdrawal
    const vestingContractBalanceAfter = await erc20.balanceOf(vesting.address);
    expect(vestingContractBalanceAfter).to.equal(BigNumber.from(0));
    const userBalance = await erc20.balanceOf(beneficiary.address);
    expect(userBalance).to.be.equal(ONE_MILLION_TOKENS);
  });
  
  it("Handle insufficient balance and duplicated vesting", async () => {
    // Create an initial vesting schedule
    let block = await ethers.provider.getBlock("latest");
    let blockTime = block.timestamp;
    const initialVestingStart = BigNumber.from(blockTime).add(60); // Starts after 60 seconds
    await erc20.connect(vestingWalletOwner).increaseAllowance(vesting.address, ONE_MILLION_TOKENS);
    await vesting.connect(vestingWalletOwner).createVestingSchedule(beneficiary.address, ONE_MILLION_TOKENS, initialVestingStart, FOUR_YEARS_IN_DAYS);
  
    // Fetch balance before actions
    const adminBalancePre = await erc20.balanceOf(vestingWalletOwner.address);
  
    // Attempt to create a second schedule for the same beneficiary, expecting failure due to duplication
    const secondVestingStart = initialVestingStart.add(300); // 5 minutes later to ensure difference
    await expect(
      vesting.connect(vestingWalletOwner).createVestingSchedule(beneficiary.address, ONE_MILLION_TOKENS, secondVestingStart, FOUR_YEARS_IN_DAYS)
    ).to.be.revertedWith("Schedule already exists");
  
    // Attempt to create a vesting schedule with insufficient allowance
    const tooMuchTokens = ethers.utils.parseEther("2200000000"); // An exaggerated amount to ensure failure
    await expect(
      vesting.connect(vestingWalletOwner).createVestingSchedule(users[6].address, tooMuchTokens, secondVestingStart, FOUR_YEARS_IN_DAYS)
    ).to.be.revertedWith("ERC20: insufficient allowance");
  
    // Verify admin balance has not changed
    const adminBalance = await erc20.balanceOf(vestingWalletOwner.address);
    expect(adminBalance).to.equal(adminBalancePre, "Admin balance should stay unchanged");
  });
  
  it("Set vesting for two years and cancel after 6 months", async () => {
    // Create a vesting schedule for 2 years
    let block = await ethers.provider.getBlock("latest");
    let blockTime = block.timestamp;
    const vestingStart = BigNumber.from(blockTime).add(60); // Starts after 60 seconds
    const HALF_MILLION_TOKENS = ethers.utils.parseEther("500000"); // 500,000 tokens
    const TWO_YEARS_IN_DAYS = 2 * 365;
  
    await erc20.connect(vestingWalletOwner).increaseAllowance(vesting.address, HALF_MILLION_TOKENS);
    await vesting.connect(vestingWalletOwner).createVestingSchedule(beneficiary.address, HALF_MILLION_TOKENS, vestingStart, TWO_YEARS_IN_DAYS);
  
    // Fast-forward time by 6 months (approx. 180 days)
    await ethers.provider.send('evm_increaseTime', [180 * 24 * 60 * 60]);
    await ethers.provider.send('evm_mine', []);
  
    // Cancel the vesting schedule after 6 months
    await vesting.connect(vestingWalletOwner).cancelVestingForBeneficiary(beneficiary.address);
  
    // Get the updated vesting schedule details
    const fullVestingInfo = await vesting.vestingScheduleForBeneficiary(beneficiary.address);
    expect(fullVestingInfo._canceledTimestamp).to.be.gt(BigNumber.from(0), "Vesting schedule should be marked as canceled");
    
    // Verify the deducted amount corresponds to 6 months of vesting
    const apxVested = BigNumber.from("123287219368340933946678"); // APX 1/4 of the total amount
    expect(fullVestingInfo._amount).to.be.equal(apxVested, "Vesting amount should be reduced by 6 months worth of tokens"); 
  
    // Verify unused tokens are transferred back to the vesting wallet owner
    const vestingWalletOwnerBalance = await erc20.balanceOf(vestingWalletOwner.address);
    expect(vestingWalletOwnerBalance).to.be.eq(INITIAL_SUPPLY.sub(HALF_MILLION_TOKENS), "Unused tokens should be transferred back to the admin");
    const recoveryWalletBalance = await erc20.balanceOf(recoveryWallet.address);
    expect(recoveryWalletBalance).to.be.eq(BigNumber.from(HALF_MILLION_TOKENS).sub(apxVested), "Unused tokens should be transferred back to the recovery wallet");

    await vesting.connect(beneficiary).withdraw();
    const beneficiaryBalance = await erc20.balanceOf(beneficiary.address);
    expect(beneficiaryBalance).to.be.eq(apxVested, "Beneficiary should be able to withdraw after cancellation");
  });
  
  it("Check if vesting is canceled properly", async () => {
    // Setup: Create a vesting schedule to be canceled
    const HALF_MILLION_TOKENS = ethers.utils.parseEther("500000");
    let block = await ethers.provider.getBlock("latest");
    let blockTime = block.timestamp;
    let vestingStart = BigNumber.from(blockTime).add(60); // Starts after 60 seconds
    const TWO_YEARS_IN_DAYS = 2 * 365;
  
    await erc20.connect(vestingWalletOwner).increaseAllowance(vesting.address, HALF_MILLION_TOKENS);
    await vesting.connect(vestingWalletOwner).createVestingSchedule(beneficiary.address, HALF_MILLION_TOKENS, vestingStart, TWO_YEARS_IN_DAYS);
  
    // Fast-forward time by 180 days
    await ethers.provider.send('evm_increaseTime', [60]);
    await ethers.provider.send('evm_mine', []);

    // Immediately cancel the vesting schedule
    await vesting.connect(vestingWalletOwner).cancelVestingForBeneficiary(beneficiary.address);
  
   expect(await vesting.getAvailableWithdrawAmountForAddress(beneficiary.address)).to.be.gt(0, "Available balance should be 0 after cancellation");

    // Verify available balance right after cancellation
    let availableImmediatelyAfterCancel = await vesting.getAvailableWithdrawAmountForAddress(beneficiary.address);
    // Fast-forward time by 180 days
    await ethers.provider.send('evm_increaseTime', [180 * 24 * 60 * 60]);
    await ethers.provider.send('evm_mine', []);
  
    // Verify available balance remains the same after 180 days
    let available180DaysAfterCancel = await vesting.getAvailableWithdrawAmountForAddress(beneficiary.address);
    expect(available180DaysAfterCancel).to.equal(availableImmediatelyAfterCancel, "Available balance should remain the same after 180 days, indicating cancellation");
  
    block = await ethers.provider.getBlock("latest");
    blockTime = block.timestamp;
    vestingStart = BigNumber.from(blockTime).add(60); // Starts after 60 seconds
    // Attempt to create another schedule for the same beneficiary should fail due to cancellation
    await expect(
      vesting.connect(vestingWalletOwner).createVestingSchedule(beneficiary.address, HALF_MILLION_TOKENS, vestingStart, TWO_YEARS_IN_DAYS)
    ).to.be.revertedWith("Schedule already exists");
  
    // Withdraw the available balance post-cancellation
    await vesting.connect(beneficiary).withdraw();
  
    // Verify the balance post-withdrawal matches the expected amount withdrawn
    let balanceAfterWithdrawal = await erc20.balanceOf(beneficiary.address);
    expect(balanceAfterWithdrawal).to.equal(availableImmediatelyAfterCancel, "Balance after withdrawal does not match expected amount");
  
    // Verify vesting details post-withdrawal
    const vestingDetailsPostWithdrawal = await vesting.vestingScheduleForBeneficiary(beneficiary.address);
    expect(vestingDetailsPostWithdrawal._remainingBalance).to.equal(0, "Remaining balance should be 0 after withdrawal");
    expect(vestingDetailsPostWithdrawal._totalDrawn).to.equal(availableImmediatelyAfterCancel, "Total drawn does not match expected amount");
    expect(vestingDetailsPostWithdrawal._lastDrawnAt).to.be.gt(BigNumber.from(0), "Last drawn at should be updated");
  });
  
  it("Create schedules, but execute emergency withdrawal", async () => {
    // Assuming vestingWalletOwner and beneficiary setup is done in a beforeEach or similar
  
    const TOTAL_VESTING_AMOUNT = ethers.utils.parseEther("500000"); // Sum of vesting amounts
    const VESTING_AMOUNT_ACCOUNT_7 = ethers.utils.parseEther("300000");
    const VESTING_AMOUNT_ACCOUNT_8 = ethers.utils.parseEther("200000");
    let block = await ethers.provider.getBlock("latest");
    let blockTime = block.timestamp;
    const vestingStart = BigNumber.from(blockTime).add(60); // Starts after 60 seconds
    const ONE_YEAR_IN_DAYS = 365;
  
    // Prefund the vesting contract by transferring tokens from the owner
    await erc20.connect(vestingWalletOwner).increaseAllowance(vesting.address, TOTAL_VESTING_AMOUNT);
  
    // Create vesting schedules
    await vesting.connect(vestingWalletOwner).createVestingSchedule(users[7].address, VESTING_AMOUNT_ACCOUNT_7, vestingStart, ONE_YEAR_IN_DAYS);
    await vesting.connect(vestingWalletOwner).createVestingSchedule(users[8].address, VESTING_AMOUNT_ACCOUNT_8, vestingStart, ONE_YEAR_IN_DAYS);
  
    // Verify the balance inside the vesting contract before emergency withdrawal
    let balanceInVestingBefore = await erc20.balanceOf(vesting.address);
    expect(balanceInVestingBefore).to.equal(TOTAL_VESTING_AMOUNT);
  
    // Fast forward time by 3 days to simulate passage of time before emergency withdrawal
    await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]); // 3 days in seconds
    await ethers.provider.send("evm_mine", []);
  
    // Execute emergency withdrawal
    await vesting.connect(vestingWalletOwner).emergencyWithdrawAllTokens();
  
    // Check the balance inside the vesting contract after emergency withdrawal
    let balanceInVestingAfter = await erc20.balanceOf(vesting.address);
    expect(balanceInVestingAfter).to.equal(0);
  
    // Verify the tokens were returned to the vesting wallet owner
    let balanceInRecoveryAdminAfter = await erc20.balanceOf(recoveryWallet.address);
    // Assuming initial balance is known or can be calculated based on test setup
    expect(balanceInRecoveryAdminAfter).to.be.equal(TOTAL_VESTING_AMOUNT, "Tokens should be returned to the vesting wallet owner");
  });
});

