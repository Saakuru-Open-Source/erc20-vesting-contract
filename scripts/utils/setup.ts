import * as ethers from 'ethers';
import * as dotenv  from 'dotenv';
import { networks } from '../../helpers/networks';
import { VestingContract } from '../../dist/types';

dotenv.config();

console.log('Running... ', process.env.NETWORK);

const vesting = require(`../../deployments/${process.env.NETWORK}/VestingContract.json`);

export const deployments = {
  vesting,
};

const rpcUrl = networks[process.env.NETWORK || ''].url;
const provider = ethers.getDefaultProvider(rpcUrl);

export const wallet = new ethers.Wallet(networks[process.env.NETWORK || '0'].accounts[0], provider);

export const getContracts = () => {
  return {
    vesting: new ethers.Contract(vesting.address, vesting.abi, wallet) as VestingContract,
  };
};

export const txConfig = {
  gasPrice: networks[process.env.NETWORK || ''].gasPrice !== undefined ? networks[process.env.NETWORK || ''].gasPrice : undefined,
  gasLimit: 10000000,
};