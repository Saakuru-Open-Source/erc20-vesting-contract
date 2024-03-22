import * as dotenv  from 'dotenv';
import { getContracts } from './utils/setup';
import { BigNumber } from 'ethers';

dotenv.config();

console.log('Running... ', process.env.NETWORK);

const main = async () => {

  const contracts = getContracts();

  await contracts.vesting.getAvailableWithdrawAmountForAddress(process.env.OWNER);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
