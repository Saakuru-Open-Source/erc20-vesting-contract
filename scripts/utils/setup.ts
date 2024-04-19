import * as ethers from 'ethers';
import * as dotenv  from 'dotenv';
import { networks } from '../../helpers/networks';
import { ERC20, VestingContract } from '../../dist/types';

dotenv.config();

console.log('Running... ', process.env.NETWORK);

const vesting = require(`../../deployments/${process.env.NETWORK}/VestingContract.json`);
const erc20Abi = require('../../abi/contracts/mocks/ERC20.sol/MockERC20.json');

export const deployments = {
  vesting,
};

const rpcUrl = networks[process.env.NETWORK || ''].url;
const provider = ethers.getDefaultProvider(rpcUrl);

export const wallet = new ethers.Wallet(networks[process.env.NETWORK || '0'].accounts[0], provider);

export const getContracts = () => {
  return {
    vesting: new ethers.Contract(vesting.address, vesting.abi, wallet) as VestingContract,
    erc20: new ethers.Contract(process.env.ERC20, erc20Abi, wallet) as ERC20,
  };
};

export const txConfig = {
  gasPrice: networks[process.env.NETWORK || ''].gasPrice !== undefined ? networks[process.env.NETWORK || ''].gasPrice : undefined,
  gasLimit: 10000000,
};