import * as dotenv  from 'dotenv';
import { getContracts, txConfig } from './utils/setup';
import { BigNumber } from 'ethers';
import moment from 'moment';
import { ethers } from 'hardhat';

dotenv.config();

console.log('Running... ', process.env.NETWORK);

const main = async () => {

  const contracts = getContracts();


  
  // console.log('allowance', (await contracts.erc20.allowance(process.env.OWNER, contracts.vesting.address)).div(BigNumber.from(10).pow(18)).toString());

  // const allowanceTx = await contracts.erc20.approve(contracts.vesting.address, BigNumber.from(10).pow(18).mul(1000000), txConfig);

  // console.log(await allowanceTx.wait());

  // console.log('allowance', (await contracts.erc20.allowance(process.env.OWNER, contracts.vesting.address)).div(BigNumber.from(10).pow(18)).toString());

  const startTimestamp = moment().add(2, 'minutes').unix();
  const walletNew = ethers.Wallet.createRandom();

  const tx = await contracts.vesting.createVestingSchedule(
    walletNew.address,
    BigNumber.from(10).pow(18).mul(1231),
    startTimestamp,
    3,
    txConfig,
  );

  console.log(await tx.wait());

  const vestingSchedule = await contracts.vesting.vestingScheduleForBeneficiary(walletNew.address);

  console.log(vestingSchedule);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
